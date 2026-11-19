# Pipeline Examples — working configs to adapt

Concrete files behind `cicd-pipeline.md`, `production-readiness.md`,
`release-strategies.md` and `post-deploy-watch.md`. Pin action and image
versions to what the project already uses; check current versions before
copying.

## GitHub Actions — test, build, deploy with a manual gate

```yaml
# .github/workflows/deploy.yml
name: deploy
on:
  push: { branches: [main] }
  workflow_dispatch:

concurrency: { group: deploy-${{ github.ref }}, cancel-in-progress: false }   # never two deploys at once

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run lint && npm run typecheck && npm test -- --run

  build:
    needs: test
    runs-on: ubuntu-latest
    permissions: { contents: read, packages: write }
    outputs: { image: ${{ steps.meta.outputs.image }} }
    steps:
      - uses: actions/checkout@v4
      - id: meta
        run: echo "image=ghcr.io/${{ github.repository }}:${{ github.sha }}" >> "$GITHUB_OUTPUT"
      - uses: docker/login-action@v3
        with: { registry: ghcr.io, username: ${{ github.actor }}, password: ${{ secrets.GITHUB_TOKEN }} }
      - uses: docker/build-push-action@v6
        with: { push: true, tags: ${{ steps.meta.outputs.image }}, cache-from: type=gha, cache-to: type=gha,mode=max }

  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - run: ./scripts/deploy.sh staging "${{ needs.build.outputs.image }}"
      - run: ./scripts/smoke.sh https://staging.example.com

  deploy-production:
    needs: [build, deploy-staging]
    runs-on: ubuntu-latest
    environment: production          # required reviewers configured on the environment = manual gate
    steps:
      - run: ./scripts/deploy.sh production "${{ needs.build.outputs.image }}"
      - run: ./scripts/smoke.sh https://example.com
```

The same immutable image (tagged by commit SHA) moves from staging to
production — never rebuild for production.

## Smoke test script

```bash
#!/usr/bin/env bash
# scripts/smoke.sh <base-url>
set -euo pipefail
BASE="$1"
check() {   # path, expected status
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE$1")
  [ "$code" = "$2" ] && echo "ok  $1 $code" || { echo "FAIL $1 got $code want $2"; exit 1; }
}
for i in $(seq 1 30); do curl -sf "$BASE/healthz" >/dev/null && break; sleep 2; done
check /healthz 200
check /readyz 200
check / 200
check /api/products?limit=1 200
check /admin 302
```

## Health and readiness endpoints

```ts
// liveness: the process is alive. Never check dependencies here.
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// readiness: can this instance serve traffic right now?
app.get("/readyz", async (_req, res) => {
  try {
    await Promise.race([db.query("select 1"), timeout(1000)]);
    await Promise.race([redis.ping(), timeout(500)]);
    res.status(200).json({ ok: true, version: process.env.GIT_SHA });
  } catch (e) {
    res.status(503).json({ ok: false, error: String(e) });
  }
});

// graceful shutdown: stop taking traffic, finish in-flight requests
process.on("SIGTERM", () => {
  ready = false;                                // readyz starts returning 503
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 25_000).unref();
});
```

## Kubernetes — probes, rollout, resources

```yaml
apiVersion: apps/v1
kind: Deployment
metadata: { name: web }
spec:
  replicas: 3
  revisionHistoryLimit: 5
  strategy: { type: RollingUpdate, rollingUpdate: { maxUnavailable: 0, maxSurge: 1 } }
  selector: { matchLabels: { app: web } }
  template:
    metadata: { labels: { app: web } }
    spec:
      terminationGracePeriodSeconds: 30
      containers:
        - name: web
          image: ghcr.io/org/web:3f9c2a1
          ports: [{ containerPort: 3000 }]
          readinessProbe: { httpGet: { path: /readyz, port: 3000 }, periodSeconds: 5, failureThreshold: 3 }
          livenessProbe:  { httpGet: { path: /healthz, port: 3000 }, initialDelaySeconds: 10, periodSeconds: 10 }
          startupProbe:   { httpGet: { path: /healthz, port: 3000 }, failureThreshold: 30, periodSeconds: 2 }
          resources:
            requests: { cpu: 100m, memory: 256Mi }
            limits:   { memory: 512Mi }
          lifecycle: { preStop: { exec: { command: ["sleep", "5"] } } }   # let the load balancer drain
```

```bash
kubectl rollout status deploy/web --timeout=5m
kubectl rollout history deploy/web
kubectl rollout undo deploy/web                  # back to the previous revision
kubectl rollout undo deploy/web --to-revision=7
```

## Rollback by platform

| Platform | Roll back |
|---|---|
| Kubernetes | `kubectl rollout undo deploy/<name>` |
| Docker Compose on a VPS | `IMAGE_TAG=<previous-sha> docker compose up -d` (keep the previous tag recorded) |
| Vercel | Promote the previous deployment (dashboard or `vercel rollback`) |
| Fly.io | `fly releases` then `fly deploy --image <previous-image>` |
| Database migration | Only expand-contract migrations are safely reversible; restore from backup otherwise |

Write the rollback command into the deploy notes **before** deploying.

## Docker Compose deploy on a VPS (zero-downtime-ish)

```bash
#!/usr/bin/env bash
# scripts/deploy.sh <env> <image>
set -euo pipefail
ENV="$1"; IMAGE="$2"
ssh deploy@"$ENV".example.com bash -s <<EOF
  set -euo pipefail
  cd /srv/app
  echo "\$(grep IMAGE= .env || true)" >> deploy-history.log
  sed -i "s|^IMAGE=.*|IMAGE=$IMAGE|" .env
  docker compose pull web
  docker compose up -d --no-deps --wait web     # --wait uses the healthcheck
EOF
```

```yaml
# compose.yaml (service excerpt)
services:
  web:
    image: ${IMAGE}
    restart: unless-stopped
    env_file: .env.production
    healthcheck: { test: ["CMD", "wget", "-qO-", "http://localhost:3000/readyz"], interval: 10s, retries: 3, start_period: 20s }
```

## Post-deploy watch (first 30 minutes)

```bash
# Error rate and latency from logs (example: JSON logs with status and duration_ms)
kubectl logs deploy/web --since=10m | jq -r 'select(.status>=500) | .path' | sort | uniq -c | sort -rn | head
kubectl logs deploy/web --since=10m | jq -s 'map(.duration_ms) | sort | .[(length*0.95|floor)]'   # p95
```

Compare against the same window before the deploy. Roll back first,
investigate second, when error rate or p95 crosses the threshold agreed in
`post-deploy-watch.md`.

## Feature flag around a risky change

```ts
if (await flags.isEnabled("new-checkout", { userId })) {
  return newCheckout(req);
}
return legacyCheckout(req);
```

Ship dark, enable for staff, then 5 % → 25 % → 100 %, watching errors at
each step. The rollback is turning the flag off — faster than a redeploy.
