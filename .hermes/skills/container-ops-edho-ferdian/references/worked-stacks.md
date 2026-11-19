# Worked Stacks — production Dockerfiles and a dev compose file

Complete, commented files for the three stacks that come up most, plus a
dev environment. Adapt base image versions to what the project pins;
check current tags before copying.

## Next.js (standalone output)

```js
// next.config.js
module.exports = { output: "standalone" };
```

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/api/healthz || exit 1
CMD ["node", "server.js"]
```

Typical size: ~150–200 MB vs 1 GB+ for a naive `COPY . . && npm install`.
`NEXT_PUBLIC_*` values are baked in at build time — pass them as build
args, not runtime env.

## Python (FastAPI with uv)

```dockerfile
# syntax=docker/dockerfile:1
FROM python:3.12-slim AS build
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen --no-dev --no-install-project
COPY . .
RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen --no-dev

FROM python:3.12-slim
WORKDIR /app
RUN useradd --create-home --uid 10001 app
COPY --from=build --chown=app:app /app /app
ENV PATH="/app/.venv/bin:$PATH" PYTHONUNBUFFERED=1
USER app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
```

Pin the uv image to a version tag in real projects instead of `latest`.

## Go (static binary, distroless)

```dockerfile
# syntax=docker/dockerfile:1
FROM golang:1.23 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY . .
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/api /api
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/api"]
```

~10–20 MB. Distroless has no shell: debug with
`docker run --rm -it --entrypoint=sh` on the build stage instead, or use
the `:debug` variant temporarily.

## .dockerignore (always)

```text
.git
node_modules
.next
dist
build
coverage
.env*
!.env.example
*.log
.venv
__pycache__
```

A missing `.dockerignore` sends secrets and gigabytes into the build
context.

## Dev environment with compose

```yaml
# compose.yaml
services:
  app:
    build: { context: ., target: deps }          # reuse the deps stage, run the dev server
    command: npm run dev
    ports: ["3000:3000"]
    env_file: .env.development
    environment:
      DATABASE_URL: postgres://app:app@db:5432/app
      REDIS_URL: redis://redis:6379
      WATCHPACK_POLLING: "true"                 # file watching on Windows/WSL bind mounts
    volumes:
      - .:/app
      - /app/node_modules                       # keep the container's node_modules
    depends_on:
      db: { condition: service_healthy }
      redis: { condition: service_started }

  db:
    image: postgres:16-alpine
    environment: { POSTGRES_USER: app, POSTGRES_PASSWORD: app, POSTGRES_DB: app }
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U app"], interval: 5s, retries: 10 }

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  mailpit:                                      # catches outgoing email in dev
    image: axllent/mailpit
    ports: ["8025:8025", "1025:1025"]

volumes:
  pgdata:
```

```bash
docker compose up -d --wait
docker compose logs -f app
docker compose exec db psql -U app
docker compose down            # keeps data; `down -v` deletes the volume (ask first)
```

## Check what you built

```bash
docker build -t app:check .
docker image ls app:check --format "{{.Size}}"
docker history app:check --no-trunc | head -20           # which layer is big
docker run --rm app:check id                              # not root
docker scout cves app:check 2>/dev/null || npx --yes trivy image app:check   # known CVEs, if available
```

## Common mistakes → fix

| Mistake | Fix |
|---|---|
| `COPY . .` before installing dependencies | Copy lockfiles first, install, then copy source (layer cache) |
| `npm install` in the image | `npm ci` with the committed lockfile |
| Running as root | `USER` with a non-root user |
| Secrets as `ARG`/`ENV` | Build secrets (`--mount=type=secret`) or runtime env |
| `latest` base tags | Pin versions (and digests for production) |
| No healthcheck | `HEALTHCHECK` or orchestrator probes |
