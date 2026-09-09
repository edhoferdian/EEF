# Debugging & Image-Size Reduction

This file covers debugging technique and size reduction **for build speed
and image size**,
not the security angle — a pinned digest, a non-root user, or
`.dockerignore` as a secret-exposure control live in
`security-review-edho-ferdian/references/domain-specific.md` §Container
instead.

## Debugging a failing or crashing container

Work from evidence outward — don't guess at a Dockerfile fix before you've
looked at what's actually happening.

**1. Logs first.**

```bash
docker compose logs -f app           # follow app logs live
docker compose logs --tail=50 db     # last 50 lines from a specific service
```

A container that exits immediately after start usually has its failure
reason in the last few log lines — a missing environment variable, a failed
migration, a port already in use.

**2. Inspect the running (or last-run) state.**

```bash
docker compose ps                     # which services are up, restarting, or exited
docker compose top                    # processes running inside each container
docker stats                          # live CPU/memory usage per container
docker inspect <container>            # full config, exit code, restart count
```

`docker inspect`'s `State.ExitCode` and `State.Error` fields are often more
informative than the log tail for a container that crashes before it can
log anything meaningful.

**3. Get a shell inside a running container** to poke at the actual
filesystem/environment rather than reasoning about it from outside:

```bash
docker compose exec app sh                    # shell into a running container
docker compose exec db psql -U postgres       # or a service-specific client
```

If the container isn't staying up long enough to `exec` into, override the
entrypoint to get a shell instead of running the normal command:

```bash
docker compose run --rm --entrypoint sh app
```

**4. Network issues** — most "container can't reach another container"
problems are DNS or the wrong network, not a firewall:

```bash
docker compose exec app nslookup db                       # does service-name DNS resolve?
docker compose exec app wget -qO- http://api:3000/health   # can it actually connect?
docker network ls
docker network inspect <project>_default                   # which services share a network?
```

A service that isn't on the same Compose network as the one it's trying to
reach will fail DNS resolution entirely — check `docker network inspect`
before assuming it's an application-level bug.

**5. Rebuild from a clean cache when in doubt** — a stale layer cache
occasionally masks a real fix:

```bash
docker compose build --no-cache app
docker compose up --build
```

## Image size reduction (non-security)

**Multi-stage builds are the primary lever, not the base image.** Dropping
build-only dependencies (compilers, dev packages, the full `node_modules`
including devDependencies) from the final stage typically removes far more
size than switching base images:

```dockerfile
# Build stage carries the full toolchain
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --production   # drop devDependencies before copying forward

# Final stage only gets the compiled output + pruned deps
FROM node:22-alpine AS production
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
CMD ["node", "dist/server.js"]
```

`npm prune --production` (or the equivalent for the ecosystem — `pip`
doesn't carry a direct analogue, but a separate `requirements-dev.txt` not
installed in the final stage achieves the same thing) before copying
`node_modules` forward is what actually removes the bulk of unnecessary
weight — the base image swap below is a secondary optimization on top of
this.

**Choosing a base image — the slim/alpine trade-off:**

| Base | Size | Trade-off |
|---|---|---|
| Full distro (e.g. `node:22`, `python:3.12`) | Largest | Full glibc compatibility, easiest for native-dependency packages to build/run |
| `-slim` variant (Debian-based, stripped) | Medium | Still glibc-based (fewer surprises with native deps), smaller than full |
| `-alpine` | Smallest | Uses musl libc, not glibc — some native-dependency packages (particularly ones with compiled C extensions) fail to build or behave differently; verify the exact dependency tree before committing to Alpine, don't assume it "just works" the way the full image does |

Don't reach for Alpine automatically because it's smallest — a project with
heavy native-dependency packages (certain Python C-extension packages,
some Node native modules) can spend more engineering time working around
musl-libc incompatibilities than the image-size savings are worth. `-slim`
is often the better default when in doubt: most of the size win, none of
the libc surprise.

**`.dockerignore` for build-context size** (distinct from its
security role of keeping secrets out of the build context — see the
security skill for that angle): a large build context slows every build
even when most of it never ends up in an image layer, because Docker has to
send the entire context to the build daemon before evaluating the first
instruction:

```
node_modules
.git
dist
coverage
*.log
.next
.cache
tests/
```

Excluding `node_modules` and `.git` in particular can turn a multi-second
context-upload step into a near-instant one on a large repo — independent
of anything the resulting image will actually contain.

## Local dev-environment parity with production

Divergence between the dev Compose setup and the production image is a
common source of "works on my machine" — design against it up front rather
than accepting it as inevitable:

- **Same base image family** in dev and prod stages (see the multi-stage
  pattern in `references/build-and-compose.md`) — a dev container built
  from a different base than production means dependency behavior can
  differ in ways that only surface after deploy.
- **Same health-check semantics.** If production relies on a `HEALTHCHECK`
  or an orchestrator's readiness probe, run something equivalent in dev so
  a broken health check is caught locally, not first in a deploy.
- **Same environment-variable shape**, different values — dev and
  production should read the same variable names (`DATABASE_URL`,
  `REDIS_URL`, etc.) so a missing-env-var bug reproduces locally instead of
  only in a deployed environment.
- **Accept the deliberate divergences** (bind-mounted source for hot
  reload, a dev-only debugger port, `NODE_ENV=development` toggling verbose
  logging) but keep them isolated to an override file (see
  `references/build-and-compose.md` §Override files) rather than scattered
  conditionals inside the shared Dockerfile/compose base — that isolation
  is what makes it easy to see exactly where dev and prod diverge and
  confirm the divergence is intentional.

## Related

- `references/build-and-compose.md` — multi-stage build structure and
  compose service design (the setup half of this same surface).
- `security-review-edho-ferdian/references/domain-specific.md` §Container —
  non-root user, `cap_drop`, `read_only`, pinned digests, secrets-in-layers,
  and `.dockerignore` as a security control.
