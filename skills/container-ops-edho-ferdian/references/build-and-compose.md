# Multi-Stage Builds & Compose Design

Adapted from ECC `docker-patterns`, fetched 2026-09-04. Security-specific
Dockerfile/compose hardening (non-root user, `cap_drop`, `read_only`,
pinned digests, secret management) is out of scope for this file — see
`security-review-edho-ferdian/references/domain-specific.md` §Container.

## Multi-stage build design

Structure a Dockerfile as named stages so each stage does one job, and
later stages copy only what they need from earlier ones — this is what
makes both fast rebuilds and small final images possible:

```dockerfile
# Stage: dependencies — isolated so dependency install is cached separately
# from source-code changes
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage: dev — hot reload, full toolchain, never shipped
FROM node:22-alpine AS dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Stage: build — compiles/bundles, still has full dependency tree
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --production

# Stage: production — only the compiled output + production deps
FROM node:22-alpine AS production
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

The `dev` and `production` stages both build from the same `deps` stage but
never appear in each other's image — a dev container gets the full
toolchain and bind-mounted source; a production image gets neither. Target
the right stage from Compose (`build.target: dev`) or your build pipeline
(`--target production`).

## Layer-cache ordering for fast rebuilds

Docker caches each layer and invalidates everything **after** the first
changed layer. Order instructions from least-frequently-changing to
most-frequently-changing:

1. Base image and OS-level packages (changes rarely).
2. Dependency manifests (`package.json`/`package-lock.json`,
   `requirements.txt`, `go.mod`) copied **alone**, then the install command
   — so dependency install is cached even when only source code changes.
3. Application source code, copied last.

```dockerfile
# GOOD — dependency layer survives source-code-only changes
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# BAD — any source change invalidates the dependency-install layer too,
# forcing a full reinstall on every rebuild
COPY . .
RUN npm ci
```

This ordering is the single highest-leverage change for rebuild speed on a
project with a slow dependency install — it turns "every rebuild reinstalls
everything" into "dependency install only reruns when the lockfile
changes."

## docker-compose service/network/volume design

### A standard web app stack

```yaml
services:
  app:
    build:
      context: .
      target: dev
    ports:
      - "3000:3000"
    volumes:
      - .:/app                # bind mount for hot reload
      - /app/node_modules      # anonymous volume — preserves container deps
                                # from being shadowed by the bind mount above
    environment:
      - DATABASE_URL=postgres://postgres:postgres@db:5432/app_dev
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    command: npm run dev

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: app_dev
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:
```

The anonymous volume on `/app/node_modules` matters: without it, the bind
mount `.:/app` would shadow the `node_modules` installed inside the image
during build with whatever (or nothing) exists on the host, breaking the
container. This is a common "works in the image, breaks with the bind
mount" surprise worth designing around up front rather than debugging later.

### Service discovery

Services on the same Compose network resolve each other by service name —
no manual DNS or hardcoded IPs:

```
postgres://postgres:postgres@db:5432/app_dev   # "db" resolves to the db service
redis://redis:6379/0                            # "redis" resolves to the redis service
```

### Network segmentation

Put services on separate networks when one shouldn't be reachable from
another — e.g. a database that only the API layer should reach, not the
frontend:

```yaml
services:
  frontend:
    networks: [frontend-net]
  api:
    networks: [frontend-net, backend-net]
  db:
    networks: [backend-net]        # unreachable from frontend

networks:
  frontend-net:
  backend-net:
```

### Volume strategy

- **Named volume** (`pgdata:`) — Docker-managed, persists across container
  restarts and recreation. Use for anything that must survive `docker
  compose down` (without `-v`).
- **Bind mount** (`.:/app`) — maps a host directory in, for live-editing
  source during development. Never use for data that must persist
  independently of the host checkout.
- **Anonymous volume** (`/app/node_modules`) — protects container-generated
  content from being shadowed by an overlapping bind mount, as above.

### Override files for dev vs. production

```yaml
# docker-compose.override.yml — auto-loaded, dev-only
services:
  app:
    environment:
      - DEBUG=app:*
    ports:
      - "9229:9229"   # debugger port

# docker-compose.prod.yml — explicit, applied on top of the base file
services:
  app:
    build:
      target: production
    restart: always
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
```

```bash
docker compose up                                              # dev (auto-loads override)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d   # production
```

This split keeps one base file describing the services and lets dev- vs.
prod-only concerns live in separate, explicit files rather than a tangle of
conditionals in one Compose file.

## Related

- `references/debugging-and-sizing.md` — what to do once a build or a
  running container is misbehaving.
- `security-review-edho-ferdian/references/domain-specific.md` §Container —
  the hardening half of this same Dockerfile/compose surface.
