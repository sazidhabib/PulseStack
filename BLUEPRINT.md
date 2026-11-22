# PulseStack — Project Blueprint

> Enterprise Multi-Tenant Background Job & Health Monitoring SaaS

**Created:** 2026-11-22
**Status:** Design Approved — Ready for Implementation
**Timeline:** 2–3 weeks aggressive sprint (solo developer)

---

## Table of Contents

- [1. Understanding Summary](#1-understanding-summary)
- [2. Assumptions](#2-assumptions)
- [3. Architecture Overview](#3-architecture-overview)
- [4. Monorepo Structure](#4-monorepo-structure)
- [5. Data Flow](#5-data-flow)
- [6. Database Schema](#6-database-schema)
- [7. API Endpoints](#7-api-endpoints)
- [8. Authentication System](#8-authentication-system)
- [9. BullMQ Queue Architecture](#9-bullmq-queue-architecture)
- [10. Real-Time (WebSocket)](#10-real-time-websocket)
- [11. Error Handling Strategy](#11-error-handling-strategy)
- [12. Testing Strategy](#12-testing-strategy)
- [13. Docker & CI/CD](#13-docker--cicd)
- [14. Frontend Architecture](#14-frontend-architecture)
- [15. Decision Log](#15-decision-log)
- [16. Project Plan](#16-project-plan)

---

## 1. Understanding Summary

- **What:** PulseStack — a multi-tenant SaaS platform for monitoring HTTP endpoints with scheduled health checks, real-time latency telemetry via WebSocket, webhook notifications on status changes, and an incident audit log.
- **Why:** Recruiter-ready portfolio showpiece proving TypeScript mastery, clean architecture, Redis/BullMQ queue design, and testing discipline — while also being genuinely usable and a learning vehicle.
- **Who:** Built solo, structured for team-scale maintainability. Target demo audience is recruiters and hiring managers evaluating full-stack/backend TypeScript skills.
- **Architecture:** Turborepo monorepo with pnpm workspaces — `apps/web` (Next.js 16), `apps/api` (Express + clean custom architecture), `apps/worker` (BullMQ consumer), `packages/shared` (Zod schemas, types, utilities).
- **Multi-tenancy:** Row-level `tenant_id` (orgId) isolation with a scoped data-access layer in a single PostgreSQL database via Drizzle ORM.
- **Auth:** Custom dual-token JWT (access + refresh with rotation and reuse detection), plus a 1-click demo login.
- **Key constraints:** 2–3 week aggressive sprint, 80%+ test coverage (Vitest + Supertest + Playwright), fully Dockerized, CI/CD via GitHub Actions.

---

## 2. Assumptions

1. **MVP features:** HTTP(S) ping, cron-scheduled checks, webhook dispatch on status change, incident timeline/audit log. Status pages, email/Slack notifications, TCP check, SSL monitoring = post-MVP.
2. **Deployment:** Vercel (web) + Railway (API + worker + PostgreSQL + Redis) for the live demo. Docker Compose for local dev and repo showcase.
3. **Real-time:** WebSocket from the Express API server for live dashboard telemetry, backed by Redis Pub/Sub for cross-process communication.
4. **Database:** PostgreSQL with Drizzle ORM. Row-level `orgId` isolation with a scoped query layer.
5. **Testing:** Vitest for unit, Supertest for API integration, Playwright for E2E auth + dashboard flows.
6. **No paid external services** in MVP (no Twilio, no SendGrid, no Stripe billing).
7. **Demo account** (`demo@pulsestack.io`) with pre-seeded data for recruiters to explore immediately.
8. **Schema-per-tenant was considered and rejected** — Drizzle ORM lacks native dynamic schema switching. Row-level `orgId` is the industry standard (Slack, Notion, Vercel) and fully sufficient.

---

## 3. Architecture Overview

**Approach Chosen:** Separate API + Worker processes (Approach A)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Turborepo Monorepo                               │
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │  apps/web    │    │  apps/api    │    │ apps/worker  │              │
│  │  Next.js 16  │───▶│  Express     │    │ BullMQ       │              │
│  │  (UI only)   │    │  REST + WS   │    │ Consumer     │              │
│  └──────────────┘    └──────┬───────┘    └──────┬───────┘              │
│                             │                    │                      │
│                    ┌────────┴────────────────────┴─────────┐           │
│                    │         packages/db                    │           │
│                    │    Drizzle ORM + Tenant Scoping        │           │
│                    └────────┬────────────────────┬─────────┘           │
│                             │                    │                      │
│                    ┌────────▼────────┐  ┌───────▼────────┐            │
│                    │   PostgreSQL    │  │     Redis       │            │
│                    │  (persistent)   │  │ (queues + pub/  │            │
│                    │                 │  │  sub + cache)   │            │
│                    └─────────────────┘  └────────────────┘            │
└─────────────────────────────────────────────────────────────────────────┘
```

### Why 3 Separate Processes?

| Process | Responsibility | Scaling |
|---------|---------------|---------|
| `apps/web` | UI rendering, static assets | Scales on Vercel edge |
| `apps/api` | REST endpoints, auth, WebSocket connections | Scales horizontally, stateless (except WS) |
| `apps/worker` | CPU-bound health checks, webhook delivery | Scales independently, add more workers without touching API |

---

## 4. Monorepo Structure

```
pulsestack/
├── apps/
│   ├── web/                        # Next.js 16 — Frontend Only
│   │   ├── app/                    # App Router
│   │   │   ├── (auth)/             # Auth pages (no dashboard layout)
│   │   │   │   ├── login/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── register/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── layout.tsx      # Minimal centered layout
│   │   │   ├── (dashboard)/        # Authenticated dashboard layout
│   │   │   │   ├── layout.tsx      # Sidebar + header + WS provider
│   │   │   │   ├── page.tsx        # Dashboard overview
│   │   │   │   ├── monitors/
│   │   │   │   │   ├── page.tsx           # List all monitors
│   │   │   │   │   ├── new/
│   │   │   │   │   │   └── page.tsx       # Create monitor form
│   │   │   │   │   └── [id]/
│   │   │   │   │       └── page.tsx       # Monitor detail + live chart
│   │   │   │   ├── incidents/
│   │   │   │   │   └── page.tsx           # Incident timeline
│   │   │   │   └── settings/
│   │   │   │       ├── page.tsx           # Org settings
│   │   │   │       └── webhooks/
│   │   │   │           └── page.tsx       # Webhook management
│   │   │   ├── layout.tsx          # Root layout
│   │   │   └── page.tsx            # Landing / redirect
│   │   ├── components/
│   │   │   ├── ui/                 # Shadcn UI components
│   │   │   ├── charts/            # Recharts/Tremor telemetry visualizers
│   │   │   ├── monitors/          # Monitor-specific components
│   │   │   ├── incidents/         # Incident-specific components
│   │   │   └── layout/            # Sidebar, Header, Navigation
│   │   ├── hooks/
│   │   │   ├── use-websocket.ts   # WebSocket connection + reconnect
│   │   │   ├── use-auth.ts        # Token management, refresh logic
│   │   │   └── use-monitors.ts    # Data fetching hooks
│   │   ├── lib/
│   │   │   ├── api-client.ts      # Axios/fetch wrapper with auth interceptor
│   │   │   └── utils.ts
│   │   ├── providers/
│   │   │   ├── auth-provider.tsx   # Auth context (tokens, user state)
│   │   │   └── ws-provider.tsx     # WebSocket context
│   │   ├── Dockerfile
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   │
│   ├── api/                        # Express — REST API + WebSocket Server
│   │   ├── src/
│   │   │   ├── controllers/        # Thin route handlers
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── monitor.controller.ts
│   │   │   │   ├── incident.controller.ts
│   │   │   │   └── webhook.controller.ts
│   │   │   ├── services/           # Business logic layer
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── monitor.service.ts
│   │   │   │   ├── incident.service.ts
│   │   │   │   ├── webhook.service.ts
│   │   │   │   └── token.service.ts    # JWT create/verify/rotate
│   │   │   ├── middleware/
│   │   │   │   ├── authenticate.ts     # Verify access token
│   │   │   │   ├── tenant-scope.ts     # Extract orgId, inject scoped DB
│   │   │   │   ├── validate.ts         # Zod schema validator
│   │   │   │   ├── rate-limit.ts       # Express rate limiter
│   │   │   │   └── error-handler.ts    # Global error boundary
│   │   │   ├── routes/
│   │   │   │   ├── auth.routes.ts
│   │   │   │   ├── monitor.routes.ts
│   │   │   │   ├── incident.routes.ts
│   │   │   │   ├── webhook.routes.ts
│   │   │   │   └── index.ts           # Route aggregator
│   │   │   ├── ws/
│   │   │   │   ├── ws-server.ts       # WebSocket upgrade handler
│   │   │   │   ├── ws-manager.ts      # Connection registry (by orgId)
│   │   │   │   └── redis-subscriber.ts # Subscribe to health-check results
│   │   │   ├── config/
│   │   │   │   └── env.ts             # Zod-validated env variables
│   │   │   ├── container.ts           # Manual dependency injection
│   │   │   └── server.ts              # Express app entry point
│   │   ├── tests/
│   │   │   ├── unit/                  # Service layer unit tests
│   │   │   └── integration/           # Supertest API tests
│   │   ├── vitest.config.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── worker/                     # BullMQ Consumer
│       ├── src/
│       │   ├── jobs/
│       │   │   ├── health-check.job.ts     # Ping URL, record result
│       │   │   └── webhook-dispatch.job.ts # Send webhook, log delivery
│       │   ├── queues/
│       │   │   ├── health-check.queue.ts   # Queue + repeatable job setup
│       │   │   └── webhook.queue.ts        # Queue + retry config
│       │   ├── utils/
│       │   │   ├── http-ping.ts            # HTTP request + timing logic
│       │   │   └── webhook-signer.ts       # HMAC signature for webhooks
│       │   ├── config/
│       │   │   └── env.ts
│       │   └── worker.ts                   # Entry point — starts all workers
│       ├── tests/
│       │   └── unit/
│       ├── vitest.config.ts
│       ├── Dockerfile
│       └── package.json
│
├── packages/
│   ├── db/                         # Drizzle ORM — Shared Database Layer
│   │   ├── schema/
│   │   │   ├── organizations.ts
│   │   │   ├── users.ts
│   │   │   ├── monitors.ts
│   │   │   ├── health-check-results.ts
│   │   │   ├── incidents.ts
│   │   │   ├── webhooks.ts
│   │   │   ├── webhook-deliveries.ts
│   │   │   ├── refresh-tokens.ts
│   │   │   └── index.ts            # Re-export all schemas
│   │   ├── migrations/             # Generated SQL migration files
│   │   ├── scoped.ts               # Tenant-scoped query builder
│   │   ├── client.ts               # Drizzle client factory
│   │   ├── seed.ts                 # Demo data seeder
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   │
│   ├── shared/                     # Cross-App Shared Code
│   │   ├── schemas/                # Zod validation schemas
│   │   │   ├── auth.schema.ts      # loginSchema, registerSchema
│   │   │   ├── monitor.schema.ts   # createMonitorSchema, updateMonitorSchema
│   │   │   ├── webhook.schema.ts
│   │   │   └── index.ts
│   │   ├── types/                  # TypeScript interfaces
│   │   │   ├── api.types.ts        # API request/response types
│   │   │   ├── monitor.types.ts
│   │   │   ├── ws.types.ts         # WebSocket event types
│   │   │   └── index.ts
│   │   ├── constants/
│   │   │   ├── monitor-status.ts   # 'up' | 'down' | 'degraded' | 'unknown'
│   │   │   ├── queue-names.ts      # Queue name constants
│   │   │   └── index.ts
│   │   ├── errors/
│   │   │   ├── app-error.ts        # Base AppError class
│   │   │   ├── not-found.ts
│   │   │   ├── unauthorized.ts
│   │   │   ├── validation.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── tsconfig/                   # Shared TypeScript Configs
│       ├── base.json
│       ├── nextjs.json
│       └── node.json
│
├── docker-compose.yml              # Postgres + Redis + API + Worker + Web
├── docker-compose.dev.yml          # Dev overrides (volumes, hot reload)
├── turbo.json                      # Turborepo pipeline config
├── pnpm-workspace.yaml
├── .env.example                    # Environment variable template
├── .github/
│   └── workflows/
│       └── ci.yml                  # Test + lint + typecheck on every PR
├── BLUEPRINT.md                    # This file
└── README.md                       # Project overview + setup guide
```

---

## 5. Data Flow

### Primary Health Check Flow

```
                        ┌──────────────┐
                        │   User       │
                        │   Browser    │
                        └──────┬───────┘
                               │ HTTPS
                        ┌──────▼───────┐
                        │  apps/web    │
                        │  Next.js 16  │
                        └──────┬───────┘
                               │ REST API calls
                        ┌──────▼───────┐
                        │  apps/api    │
                        │  Express     │◄─────── WebSocket ──── Browser
                        └──┬───┬───┬───┘
                           │   │   │
              ┌────────────┘   │   └────────────────┐
              ▼                ▼                     ▼
     ┌────────────┐    ┌────────────┐    ┌──────────────────┐
     │ PostgreSQL │    │   Redis    │    │ Redis Pub/Sub    │
     │  (data)    │    │  (queues)  │    │ (real-time feed) │
     └────────────┘    └─────┬──────┘    └────────▲─────────┘
                             │                    │
                      ┌──────▼───────┐            │
                      │ apps/worker  │            │
                      │ BullMQ       │────────────┘
                      │ Consumer     │
                      └──────┬───────┘
                             │ HTTP ping
                      ┌──────▼───────┐
                      │  Monitored   │
                      │  Endpoint    │
                      └──────────────┘
```

### Step-by-Step Flow

1. **User creates a monitor** → `POST /api/monitors` → API validates input (Zod), saves to PostgreSQL, calls BullMQ to create a repeatable job with the monitor's `intervalSeconds`.
2. **BullMQ schedules the job** → Worker picks up the repeatable job on schedule.
3. **Worker pings the endpoint** → Sends HTTP GET/HEAD, measures latency, captures status code.
4. **Worker saves result** → Inserts into `healthCheckResults` table.
5. **Worker detects status change** → Compares current vs previous status. If changed: creates/resolves an `incident`, enqueues a `webhook-dispatch` job.
6. **Worker publishes to Redis Pub/Sub** → `channel: health-check:${orgId}`, payload: `{ monitorId, status, latencyMs, checkedAt }`.
7. **API receives Pub/Sub event** → Finds all WebSocket connections for that `orgId`, pushes the event to connected clients.
8. **Dashboard updates live** → Frontend receives WS message, updates chart and status indicator in real-time.
9. **Webhook dispatch job runs** → Worker sends POST to configured webhook URL with HMAC-signed payload, logs the delivery result.

---

## 6. Database Schema

### Entity Relationship Diagram

```
┌──────────────────┐       ┌──────────────────┐
│  organizations   │       │     users        │
│──────────────────│       │──────────────────│
│  id (PK)         │◄──┐   │  id (PK)         │
│  name            │   │   │  email           │
│  slug (unique)   │   │   │  passwordHash    │
│  plan            │   └───│  orgId (FK)      │
│  createdAt       │       │  role            │
│  updatedAt       │       │  createdAt       │
└────────┬─────────┘       └──────┬───────────┘
         │                        │
         │ 1:N                    │ 1:N
         │                        │
         ▼                        ▼
┌──────────────────┐       ┌──────────────────┐
│    monitors      │       │  refreshTokens   │
│──────────────────│       │──────────────────│
│  id (PK)         │       │  id (PK)         │
│  orgId (FK)      │       │  userId (FK)     │
│  name            │       │  token (hashed)  │
│  url             │       │  family          │
│  method          │       │  expiresAt       │
│  intervalSeconds │       │  revokedAt       │
│  timeout         │       │  createdAt       │
│  expectedStatus  │       └──────────────────┘
│  headers (jsonb) │
│  isActive        │
│  status          │
│  lastCheckedAt   │
│  createdAt       │
│  updatedAt       │
└──┬────────┬──────┘
   │        │
   │ 1:N    │ 1:N
   ▼        ▼
┌──────────────────┐    ┌──────────────────┐
│healthCheckResults│    │   incidents      │
│──────────────────│    │──────────────────│
│  id (PK)         │    │  id (PK)         │
│  monitorId (FK)  │    │  monitorId (FK)  │
│  orgId (FK)      │    │  orgId (FK)      │
│  statusCode      │    │  type            │
│  latencyMs       │    │  startedAt       │
│  status          │    │  resolvedAt      │
│  errorMessage    │    │  cause           │
│  checkedAt       │    │  createdAt       │
│  INDEX(orgId,    │    └──────────────────┘
│   monitorId,     │
│   checkedAt DESC)│
└──────────────────┘

┌──────────────────┐       ┌──────────────────┐
│    webhooks      │       │webhookDeliveries │
│──────────────────│       │──────────────────│
│  id (PK)         │◄──┐   │  id (PK)         │
│  orgId (FK)      │   │   │  webhookId (FK)  │
│  url             │   └───│  orgId (FK)      │
│  secret          │       │  event           │
│  events (text[]) │       │  payload (jsonb) │
│  isActive        │       │  responseStatus  │
│  createdAt       │       │  success         │
│  updatedAt       │       │  attemptCount    │
└──────────────────┘       │  deliveredAt     │
                           └──────────────────┘
```

### Table Definitions

#### organizations

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default `gen_random_uuid()` |
| name | text | NOT NULL |
| slug | text | UNIQUE, NOT NULL |
| plan | enum(`free`, `pro`) | default `free` |
| createdAt | timestamp | default `now()` |
| updatedAt | timestamp | |

#### users

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| email | text | UNIQUE, NOT NULL |
| passwordHash | text | NOT NULL |
| name | text | |
| role | enum(`owner`, `admin`, `viewer`) | default `viewer` |
| orgId | uuid | FK → organizations.id |
| createdAt | timestamp | |
| updatedAt | timestamp | |

#### monitors

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| orgId | uuid | FK → organizations.id |
| name | text | NOT NULL |
| url | text | NOT NULL |
| method | enum(`GET`, `HEAD`) | default `GET` |
| intervalSeconds | int | NOT NULL, default `60` |
| timeout | int | default `30000` (ms) |
| expectedStatus | int | default `200` |
| headers | jsonb | default `{}` |
| isActive | boolean | default `true` |
| status | enum(`up`, `down`, `degraded`, `unknown`) | default `unknown` |
| lastCheckedAt | timestamp | nullable |
| createdAt | timestamp | |
| updatedAt | timestamp | |

#### healthCheckResults

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| monitorId | uuid | FK → monitors.id |
| orgId | uuid | FK → organizations.id (denormalized) |
| statusCode | int | nullable (null if timeout/DNS fail) |
| latencyMs | int | NOT NULL |
| status | enum(`up`, `down`, `degraded`) | |
| errorMessage | text | nullable |
| checkedAt | timestamp | NOT NULL |
| **INDEX** | | `(orgId, monitorId, checkedAt DESC)` |

#### incidents

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| monitorId | uuid | FK → monitors.id |
| orgId | uuid | FK → organizations.id |
| type | enum(`down`, `degraded`, `recovered`) | |
| startedAt | timestamp | NOT NULL |
| resolvedAt | timestamp | nullable (null = ongoing) |
| cause | text | nullable |
| createdAt | timestamp | |

#### webhooks

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| orgId | uuid | FK → organizations.id |
| url | text | NOT NULL |
| secret | text | NOT NULL (HMAC signing secret) |
| events | text[] | default `['monitor.down', 'monitor.up']` |
| isActive | boolean | default `true` |
| createdAt | timestamp | |
| updatedAt | timestamp | |

#### webhookDeliveries

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| webhookId | uuid | FK → webhooks.id |
| orgId | uuid | FK → organizations.id |
| event | text | NOT NULL |
| payload | jsonb | NOT NULL |
| responseStatus | int | nullable |
| success | boolean | NOT NULL |
| attemptCount | int | default `1` |
| deliveredAt | timestamp | |
| **INDEX** | | `(orgId, webhookId, deliveredAt DESC)` |

#### refreshTokens

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| userId | uuid | FK → users.id |
| token | text | UNIQUE, NOT NULL (hashed) |
| family | uuid | NOT NULL (rotation family) |
| expiresAt | timestamp | NOT NULL |
| revokedAt | timestamp | nullable |
| createdAt | timestamp | |

### Tenant Scoping Layer

```typescript
// packages/db/scoped.ts
// Every data access goes through this — impossible to forget tenant filter

export function createTenantScope(db: DrizzleDB, orgId: string) {
  return {
    monitors: {
      findAll: () =>
        db.select().from(monitors).where(eq(monitors.orgId, orgId)),
      findById: (id: string) =>
        db.select().from(monitors)
          .where(and(eq(monitors.id, id), eq(monitors.orgId, orgId))),
      create: (data: NewMonitor) =>
        db.insert(monitors).values({ ...data, orgId }).returning(),
      update: (id: string, data: Partial<Monitor>) =>
        db.update(monitors).set({ ...data, updatedAt: new Date() })
          .where(and(eq(monitors.id, id), eq(monitors.orgId, orgId)))
          .returning(),
      delete: (id: string) =>
        db.delete(monitors)
          .where(and(eq(monitors.id, id), eq(monitors.orgId, orgId))),
    },
    healthChecks: {
      findByMonitor: (monitorId: string, limit = 100) =>
        db.select().from(healthCheckResults)
          .where(and(
            eq(healthCheckResults.orgId, orgId),
            eq(healthCheckResults.monitorId, monitorId)
          ))
          .orderBy(desc(healthCheckResults.checkedAt))
          .limit(limit),
      create: (data: NewHealthCheckResult) =>
        db.insert(healthCheckResults).values({ ...data, orgId }).returning(),
    },
    incidents: {
      findAll: () =>
        db.select().from(incidents)
          .where(eq(incidents.orgId, orgId))
          .orderBy(desc(incidents.startedAt)),
      findOpen: () =>
        db.select().from(incidents)
          .where(and(
            eq(incidents.orgId, orgId),
            isNull(incidents.resolvedAt)
          )),
    },
    webhooks: {
      findAll: () =>
        db.select().from(webhooks).where(eq(webhooks.orgId, orgId)),
      findByEvent: (event: string) =>
        db.select().from(webhooks)
          .where(and(
            eq(webhooks.orgId, orgId),
            eq(webhooks.isActive, true),
            arrayContains(webhooks.events, [event])
          )),
    },
  };
}
```

---

## 7. API Endpoints

### Authentication

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/auth/register` | Create account + org | Public |
| POST | `/api/auth/login` | Email/password login → access + refresh tokens | Public |
| POST | `/api/auth/refresh` | Rotate refresh token → new token pair | Refresh token (cookie) |
| POST | `/api/auth/logout` | Revoke refresh token family | Authenticated |
| POST | `/api/auth/demo` | 1-click demo login → access + refresh tokens | Public |
| GET | `/api/auth/me` | Get current user + org info | Authenticated |

### Monitors

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/monitors` | List all monitors for tenant | Authenticated |
| POST | `/api/monitors` | Create a new monitor | Authenticated (owner/admin) |
| GET | `/api/monitors/:id` | Get monitor details | Authenticated |
| PATCH | `/api/monitors/:id` | Update monitor config | Authenticated (owner/admin) |
| DELETE | `/api/monitors/:id` | Delete monitor + stop scheduled job | Authenticated (owner/admin) |
| GET | `/api/monitors/:id/results` | Paginated health check history | Authenticated |
| GET | `/api/monitors/:id/stats` | Uptime %, avg latency, p95, p99 | Authenticated |
| POST | `/api/monitors/:id/pause` | Pause scheduled checks | Authenticated (owner/admin) |
| POST | `/api/monitors/:id/resume` | Resume scheduled checks | Authenticated (owner/admin) |

### Incidents

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/incidents` | List all incidents (filterable by status) | Authenticated |
| GET | `/api/incidents/:id` | Get incident detail with timeline | Authenticated |

### Webhooks

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/webhooks` | List all webhook configs | Authenticated |
| POST | `/api/webhooks` | Create webhook endpoint | Authenticated (owner/admin) |
| PATCH | `/api/webhooks/:id` | Update webhook config | Authenticated (owner/admin) |
| DELETE | `/api/webhooks/:id` | Delete webhook | Authenticated (owner/admin) |
| GET | `/api/webhooks/:id/deliveries` | Delivery history (success/fail) | Authenticated |
| POST | `/api/webhooks/:id/test` | Send a test webhook delivery | Authenticated (owner/admin) |

### Organization

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/org` | Get current org details | Authenticated |
| PATCH | `/api/org` | Update org name/settings | Authenticated (owner) |

### WebSocket

| Path | Description |
|------|-------------|
| `ws://host/ws` | Real-time telemetry stream (authenticated via token in handshake query param) |

#### WebSocket Events (Server → Client)

```typescript
// packages/shared/types/ws.types.ts

type WsEvent =
  | { type: 'health-check:result'; data: { monitorId: string; status: string; latencyMs: number; statusCode: number | null; checkedAt: string } }
  | { type: 'monitor:status-changed'; data: { monitorId: string; from: string; to: string; changedAt: string } }
  | { type: 'incident:created'; data: { incidentId: string; monitorId: string; type: string; startedAt: string } }
  | { type: 'incident:resolved'; data: { incidentId: string; monitorId: string; resolvedAt: string } }
```

### Request/Response Conventions

```typescript
// All successful responses
{ "success": true, "data": T }

// Paginated responses
{ "success": true, "data": T[], "meta": { "page": number, "limit": number, "total": number } }

// Error responses
{ "success": false, "error": { "code": string, "message": string, "details"?: unknown } }
```

---

## 8. Authentication System

### Dual-Token JWT with Refresh Rotation

```
┌────────────────────────────────────────────────────────────────────┐
│                     Authentication Flow                            │
│                                                                    │
│  LOGIN                                                             │
│  ──────                                                            │
│  Client ──POST /auth/login──▶ API                                 │
│                                 │ verify password (bcrypt)         │
│                                 │ generate access token (15min)    │
│                                 │ generate refresh token (7days)   │
│                                 │ hash refresh token → save to DB  │
│                                 │ set family = new UUID            │
│  Client ◀── { accessToken } ───┤                                  │
│          + Set-Cookie: refresh  │                                  │
│            (httpOnly, secure,   │                                  │
│             sameSite: strict)   │                                  │
│                                                                    │
│  REFRESH                                                           │
│  ───────                                                           │
│  Client ──POST /auth/refresh──▶ API                               │
│    (cookie sent automatically)   │ find token in DB                │
│                                  │ check: not revoked + not expired│
│                                  │ revoke old token                │
│                                  │ generate new access + refresh   │
│                                  │ SAME family UUID                │
│  Client ◀── { accessToken } ────┤                                 │
│          + Set-Cookie: refresh   │                                 │
│            (new token)           │                                 │
│                                                                    │
│  REUSE DETECTION (stolen token)                                    │
│  ───────────────────────────────                                   │
│  Attacker ──POST /auth/refresh──▶ API                             │
│    (uses already-revoked token)    │ find token: REVOKED!          │
│                                    │ ⚠️ BREACH DETECTED           │
│                                    │ revoke ALL tokens in family   │
│                                    │ user must re-login            │
│  Attacker ◀── 401 Unauthorized ───┤                               │
│  User    ◀── forced re-login ─────┤                               │
│                                                                    │
│  DEMO LOGIN                                                       │
│  ──────────                                                        │
│  Client ──POST /auth/demo──▶ API                                  │
│                                │ find/create demo user             │
│                                │ same token flow as login          │
│  Client ◀── tokens ───────────┤  (demo org is read-only)          │
└────────────────────────────────────────────────────────────────────┘
```

### Token Configuration

| Token | Lifetime | Storage | Contains |
|-------|----------|---------|----------|
| Access Token | 15 minutes | In-memory (JS variable) | `{ userId, orgId, role, type: 'access' }` |
| Refresh Token | 7 days | httpOnly cookie | `{ userId, family, type: 'refresh' }` |

### Key Security Details

- Passwords hashed with **bcrypt** (cost factor 12)
- Refresh tokens stored as **SHA-256 hashes** in the database (never stored raw)
- Access tokens are **never stored** — stateless verification via JWT signature
- **CSRF protection**: refresh cookie is `sameSite: strict` + only used on the `/auth/refresh` endpoint
- **Rate limiting**: login endpoint rate-limited to 5 attempts per 15 minutes per IP

---

## 9. BullMQ Queue Architecture

### Queue Definitions

```
┌──────────────────────────────────────────────────────────────────┐
│                     BullMQ Queues                                 │
│                                                                   │
│  Queue: "health-check"                                           │
│  ─────────────────────                                           │
│  Type: Repeatable jobs (one per active monitor)                  │
│  Schedule: Based on monitor.intervalSeconds (default 60s)        │
│  Concurrency: 10 (process 10 pings in parallel)                 │
│  Retry: 0 (health checks don't retry — a failure IS the data)   │
│  Job data: { monitorId, orgId, url, method, timeout,            │
│              expectedStatus, headers }                           │
│                                                                   │
│  Queue: "webhook-dispatch"                                       │
│  ─────────────────────────                                       │
│  Type: On-demand (enqueued on status change)                     │
│  Concurrency: 5                                                  │
│  Retry: 3 attempts with exponential backoff                      │
│    - Attempt 1: immediate                                        │
│    - Attempt 2: after 30 seconds                                 │
│    - Attempt 3: after 2 minutes                                  │
│    - Attempt 4 (final): after 10 minutes                         │
│  Job data: { webhookId, orgId, url, secret, event, payload }    │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Health Check Job Processor

```typescript
// apps/worker/src/jobs/health-check.job.ts (pseudo-code)

async function processHealthCheck(job: Job<HealthCheckJobData>) {
  const { monitorId, orgId, url, method, timeout, expectedStatus } = job.data;

  // 1. Ping the endpoint
  const result = await httpPing(url, { method, timeout });

  // 2. Determine status
  const status = determineStatus(result, expectedStatus);
  //   - statusCode === expectedStatus → 'up'
  //   - statusCode exists but !== expectedStatus → 'degraded'
  //   - timeout or network error → 'down'

  // 3. Save result to DB
  await db.insert(healthCheckResults).values({
    monitorId, orgId,
    statusCode: result.statusCode,
    latencyMs: result.latencyMs,
    status,
    errorMessage: result.error,
    checkedAt: new Date(),
  });

  // 4. Check for status change
  const monitor = await db.select().from(monitors).where(eq(monitors.id, monitorId));
  const previousStatus = monitor.status;

  if (status !== previousStatus) {
    // 4a. Update monitor status
    await db.update(monitors).set({ status, lastCheckedAt: new Date() });

    // 4b. Create or resolve incident
    if (status === 'down' || status === 'degraded') {
      await db.insert(incidents).values({
        monitorId, orgId,
        type: status,
        startedAt: new Date(),
        cause: result.error || `HTTP ${result.statusCode}`,
      });
    } else if (status === 'up' && (previousStatus === 'down' || previousStatus === 'degraded')) {
      await db.update(incidents)
        .set({ resolvedAt: new Date() })
        .where(and(
          eq(incidents.monitorId, monitorId),
          isNull(incidents.resolvedAt)
        ));
    }

    // 4c. Enqueue webhook dispatch
    const webhooks = await scopedDb.webhooks.findByEvent(`monitor.${status}`);
    for (const webhook of webhooks) {
      await webhookQueue.add('dispatch', {
        webhookId: webhook.id, orgId,
        url: webhook.url, secret: webhook.secret,
        event: `monitor.${status}`,
        payload: { monitorId, monitorName: monitor.name, status, previousStatus, checkedAt: new Date() },
      });
    }
  } else {
    // Just update lastCheckedAt
    await db.update(monitors).set({ lastCheckedAt: new Date() });
  }

  // 5. Publish to Redis Pub/Sub for real-time
  await redis.publish(`health-check:${orgId}`, JSON.stringify({
    type: 'health-check:result',
    data: { monitorId, status, latencyMs: result.latencyMs, statusCode: result.statusCode, checkedAt: new Date() },
  }));
}
```

### Webhook Dispatch Job Processor

```typescript
// apps/worker/src/jobs/webhook-dispatch.job.ts (pseudo-code)

async function processWebhookDispatch(job: Job<WebhookDispatchJobData>) {
  const { webhookId, orgId, url, secret, event, payload } = job.data;

  // 1. Sign the payload with HMAC-SHA256
  const signature = createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  // 2. Send the webhook
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PulseStack-Signature': signature,
        'X-PulseStack-Event': event,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    // 3. Log delivery
    await db.insert(webhookDeliveries).values({
      webhookId, orgId, event,
      payload,
      responseStatus: response.status,
      success: response.ok,
      attemptCount: job.attemptsMade + 1,
      deliveredAt: new Date(),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    // Log failed delivery
    await db.insert(webhookDeliveries).values({
      webhookId, orgId, event, payload,
      responseStatus: null,
      success: false,
      attemptCount: job.attemptsMade + 1,
      deliveredAt: new Date(),
    });
    throw error; // BullMQ will retry based on backoff config
  }
}
```

### Monitor Lifecycle → Queue Management

| Action | Queue Effect |
|--------|-------------|
| Create monitor (active) | Add repeatable job with `every: intervalSeconds * 1000` |
| Update monitor interval | Remove old repeatable job, add new one |
| Pause monitor | Remove repeatable job |
| Resume monitor | Re-add repeatable job |
| Delete monitor | Remove repeatable job, clean up completed/failed jobs |

---

## 10. Real-Time (WebSocket)

### Architecture

```
┌───────────┐  health-check result  ┌──────────┐  Redis Pub/Sub  ┌───────────┐
│  Worker   │ ───────────────────▶  │  Redis   │ ─────────────▶  │  API      │
│           │  publish to channel   │          │                  │  Server   │
└───────────┘  health-check:{orgId} └──────────┘                  └─────┬─────┘
                                                                        │
                                                                        │ forward to
                                                                        │ matching WS
                                                                        │ connections
                                                               ┌────────▼────────┐
                                                               │  WS Connection  │
                                                               │  Registry       │
                                                               │                 │
                                                               │  Map<orgId,     │
                                                               │    Set<socket>> │
                                                               └────────┬────────┘
                                                                        │
                                                                ┌───────▼───────┐
                                                                │   Browser     │
                                                                │   Dashboard   │
                                                                └───────────────┘
```

### WebSocket Connection Manager

```typescript
// apps/api/src/ws/ws-manager.ts (pseudo-code)

class WebSocketManager {
  // orgId → Set of connected sockets
  private connections = new Map<string, Set<WebSocket>>();

  addConnection(orgId: string, ws: WebSocket) {
    if (!this.connections.has(orgId)) {
      this.connections.set(orgId, new Set());
    }
    this.connections.get(orgId)!.add(ws);

    ws.on('close', () => this.removeConnection(orgId, ws));
  }

  broadcast(orgId: string, event: WsEvent) {
    const sockets = this.connections.get(orgId);
    if (!sockets) return;

    const message = JSON.stringify(event);
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }
}
```

### WebSocket Authentication

1. Client connects: `ws://host/ws?token=<accessToken>`
2. Server verifies the JWT on upgrade handshake
3. Extracts `orgId` from token payload
4. Registers connection under that `orgId`
5. If token is invalid/expired → reject upgrade with 401

### Client-Side Hook

```typescript
// apps/web/hooks/use-websocket.ts (pseudo-code)

function useWebSocket() {
  const { accessToken } = useAuth();
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    const socket = new WebSocket(`${WS_URL}/ws?token=${accessToken}`);

    socket.onmessage = (event) => {
      const wsEvent: WsEvent = JSON.parse(event.data);
      // dispatch to appropriate handler based on wsEvent.type
    };

    // Reconnect on close with exponential backoff
    socket.onclose = () => {
      setTimeout(() => reconnect(), backoffMs);
    };

    setWs(socket);
    return () => socket.close();
  }, [accessToken]);
}
```

---

## 11. Error Handling Strategy

### Layered Error Handling

```
┌─────────────────────────────────────────────────────┐
│                   Error Hierarchy                    │
│                                                     │
│  AppError (base)                                    │
│  ├── ValidationError    (400)  — Zod parse failure  │
│  ├── UnauthorizedError  (401)  — Bad/expired token  │
│  ├── ForbiddenError     (403)  — Wrong role/tenant  │
│  ├── NotFoundError      (404)  — Resource not found │
│  ├── ConflictError      (409)  — Duplicate email    │
│  └── RateLimitError     (429)  — Too many requests  │
│                                                     │
│  Unknown errors → 500 Internal Server Error         │
│  (logged with full stack, sanitized response)       │
└─────────────────────────────────────────────────────┘
```

### Global Error Handler Middleware

```typescript
// apps/api/src/middleware/error-handler.ts (pseudo-code)

function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  // Unknown error — log full details, return sanitized response
  logger.error('Unhandled error', { error: err, path: req.path, method: req.method });

  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  });
}
```

### Worker Error Handling

| Scenario | Handling |
|----------|---------|
| Health check timeout | Record as `status: 'down'`, `errorMessage: 'TIMEOUT'` |
| DNS resolution failure | Record as `status: 'down'`, `errorMessage: 'ENOTFOUND'` |
| Connection refused | Record as `status: 'down'`, `errorMessage: 'ECONNREFUSED'` |
| Webhook delivery failure | Retry with exponential backoff (3 attempts), log each attempt |
| BullMQ job crash | BullMQ auto-marks as failed, appears in failed job list |
| Redis connection lost | BullMQ auto-reconnects, jobs resume when Redis is back |

---

## 12. Testing Strategy

### Test Pyramid

```
         ┌──────────┐
         │  E2E     │  Playwright (5-10 tests)
         │          │  Auth flow, dashboard, monitor CRUD
         ├──────────┤
         │          │
         │  API     │  Supertest (20-30 tests)
         │  Integ.  │  All endpoints, auth, error cases
         │          │
         ├──────────┤
         │          │
         │  Unit    │  Vitest (40-60 tests)
         │          │  Services, job processors, utils
         │          │  Token logic, tenant scoping, Zod
         │          │
         └──────────┘
```

### Unit Tests (Vitest)

| Module | What to Test |
|--------|-------------|
| `token.service.ts` | Token generation, verification, expiry, rotation, reuse detection |
| `auth.service.ts` | Password hashing, login logic, demo user creation |
| `monitor.service.ts` | CRUD logic, validation, interval boundaries |
| `health-check.job.ts` | Status determination logic (`up`/`down`/`degraded`), status change detection |
| `webhook-dispatch.job.ts` | HMAC signing, delivery logging, retry behavior |
| `http-ping.ts` | Latency measurement, timeout handling, error capture |
| `webhook-signer.ts` | HMAC signature generation + verification |
| `scoped.ts` | Tenant scoping always applies `orgId` filter |
| Zod schemas | Valid/invalid input variations |
| `env.ts` | Missing env vars throw descriptive errors |

### API Integration Tests (Supertest)

| Area | What to Test |
|------|-------------|
| Auth | Register → login → refresh → logout → reuse detection |
| Auth | Demo login creates/reuses demo account |
| Auth | Expired token returns 401, invalid token returns 401 |
| Monitors | Full CRUD lifecycle, pagination, stats endpoint |
| Monitors | Tenant isolation: User A cannot see User B's monitors |
| Webhooks | CRUD + test delivery endpoint |
| Incidents | List filtering (open/resolved), incident detail |
| Validation | Bad inputs return 400 with Zod error details |
| Rate limiting | Login endpoint blocks after 5 attempts |

### E2E Tests (Playwright)

| Flow | Steps |
|------|-------|
| Registration | Register → redirect to dashboard → see empty state |
| Login/Logout | Login → see dashboard → logout → redirect to login |
| Demo Login | Click "Demo Login" button → see pre-seeded dashboard |
| Monitor CRUD | Create monitor → see in list → edit → delete |
| Dashboard | View monitor detail → see real-time chart updating |

### Test Infrastructure

```yaml
# docker-compose.test.yml — test-specific services
services:
  test-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: pulsestack_test
    tmpfs: /var/lib/postgresql/data   # RAM disk for speed

  test-redis:
    image: redis:7-alpine
```

### Coverage Target

| Package | Target |
|---------|--------|
| `apps/api` | 80%+ |
| `apps/worker` | 80%+ |
| `packages/db` | 70%+ |
| `packages/shared` | 90%+ |
| **Overall** | **80%+** |

---

## 13. Docker & CI/CD

### Docker Compose (Local Development)

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    environment:
      POSTGRES_USER: pulsestack
      POSTGRES_PASSWORD: pulsestack
      POSTGRES_DB: pulsestack
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    ports: ["4000:4000"]
    depends_on: [postgres, redis]
    environment:
      DATABASE_URL: postgresql://pulsestack:pulsestack@postgres:5432/pulsestack
      REDIS_URL: redis://redis:6379
      JWT_ACCESS_SECRET: dev-access-secret
      JWT_REFRESH_SECRET: dev-refresh-secret

  worker:
    build:
      context: .
      dockerfile: apps/worker/Dockerfile
    depends_on: [postgres, redis]
    environment:
      DATABASE_URL: postgresql://pulsestack:pulsestack@postgres:5432/pulsestack
      REDIS_URL: redis://redis:6379

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    ports: ["3000:3000"]
    depends_on: [api]
    environment:
      NEXT_PUBLIC_API_URL: http://api:4000
      NEXT_PUBLIC_WS_URL: ws://api:4000

volumes:
  postgres_data:
```

### Dockerfile Pattern (Multi-Stage)

```dockerfile
# apps/api/Dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm turbo build --filter=api

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 4000
CMD ["node", "dist/server.js"]
```

### GitHub Actions CI

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo typecheck

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo lint

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: pulsestack_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports: ["6379:6379"]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo test -- --coverage
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/pulsestack_test
          REDIS_URL: redis://localhost:6379

  e2e:
    runs-on: ubuntu-latest
    needs: [test]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: npx playwright install --with-deps chromium
      - run: docker compose -f docker-compose.yml up -d
      - run: pnpm --filter web test:e2e
      - run: docker compose down
```

---

## 14. Frontend Architecture

### UI Stack

| Tool | Purpose |
|------|---------|
| Next.js 16 | App Router, Server Components, file-based routing |
| Tailwind CSS 4 | Utility-first styling |
| Shadcn UI | Component library (Button, Card, Table, Dialog, Form, etc.) |
| Recharts / Tremor | Latency charts, uptime visualizers |
| React Hook Form + Zod | Form management with shared Zod schemas |

### Page Layout

```
┌────────────────────────────────────────────────────────┐
│  Header   [PulseStack Logo]            [User] [Logout] │
├──────────┬─────────────────────────────────────────────┤
│          │                                             │
│ Sidebar  │   Main Content Area                        │
│          │                                             │
│ Dashboard│   ┌─────────────────────────────────────┐  │
│ Monitors │   │  Monitor: Production API             │  │
│ Incidents│   │  Status: ● UP  Uptime: 99.7%        │  │
│ Settings │   │                                       │  │
│  ├ Org   │   │  ┌───────────────────────────────┐   │  │
│  └ Hooks │   │  │  Latency Chart (real-time)     │   │  │
│          │   │  │  ~~~~/\~~~~~/\~~~~/\~~~~        │   │  │
│          │   │  │  50ms  120ms  45ms  200ms       │   │  │
│          │   │  └───────────────────────────────┘   │  │
│          │   │                                       │  │
│          │   │  Recent Checks  |  Incidents          │  │
│          │   │  ✅ 200 45ms    |  🔴 Down 2h ago     │  │
│          │   │  ✅ 200 52ms    |  🟢 Recovered 1h    │  │
│          │   │  ❌ Timeout     |                      │  │
│          │   └─────────────────────────────────────┘  │
└──────────┴─────────────────────────────────────────────┘
```

### Key Frontend Patterns

| Pattern | Implementation |
|---------|---------------|
| Auth state | React Context with `accessToken` in memory, refresh via httpOnly cookie |
| API calls | Fetch wrapper with automatic token refresh on 401 |
| Real-time | WebSocket context provider, components subscribe to events |
| Forms | React Hook Form + Zod (same schema as API validation) |
| Loading states | Suspense boundaries + skeleton loaders |
| Error boundaries | Catch rendering errors, show fallback UI |
| Optimistic updates | Instant UI feedback on CRUD, rollback on API error |

---

## 15. Decision Log

| # | Decision | Alternatives Considered | Why Chosen |
|---|----------|------------------------|------------|
| 1 | **Turborepo monorepo with pnpm** | Separate repos; plain monorepo; Nx | Best balance: organized like enterprise, deployed as one, no vendor lock-in. pnpm is fast and strict. |
| 2 | **Express + clean custom architecture** | NestJS; Hono | Shows you can build DI, service layers, middleware from scratch — proves understanding, not framework dependence. |
| 3 | **Custom dual-token JWT** | NextAuth.js; Supabase Auth | Most technically impressive for recruiters. Shows deep auth understanding: rotation, reuse detection, family-based revocation. |
| 4 | **Row-level tenant_id isolation** | Schema-per-tenant; separate databases | Drizzle lacks native dynamic schema switching. Row-level is the industry standard (Slack, Notion). Schema-per-tenant would eat the 2-3 week timeline. |
| 5 | **Separate API + Worker processes** | Next.js API routes + worker; embedded worker in API | Shows distributed systems thinking. Each process scales independently. Worker CPU spikes don't block API. |
| 6 | **WebSocket (not SSE)** | Server-Sent Events; polling | Full duplex needed for future features. More impressive. SSE is simpler but uni-directional. |
| 7 | **Redis Pub/Sub for cross-process** | Direct DB polling; shared in-memory | Worker and API are separate processes — Redis Pub/Sub is the natural bridge. Already running Redis for BullMQ. |
| 8 | **Drizzle ORM** | Prisma; Knex; raw SQL | Type-safe, lightweight, SQL-like syntax, no code generation step. Better DX than Prisma for experienced developers. |
| 9 | **Vercel + Railway** | DigitalOcean Droplet; Fly.io; AWS | Free/cheap, supports Docker natively, managed Postgres + Redis. Combined with Docker Compose in repo, shows full DevOps capability. |
| 10 | **MVP: HTTP ping + webhooks + incidents** | Full feature set from day 1 | 2-3 weeks demands focus. These 4 features demonstrate the full architecture (queue, real-time, CRUD, audit). Status pages, email, TCP, SSL = post-MVP. |

---

## 16. Project Plan

### Overview

**Duration:** 21 days (3 weeks)
**Work style:** Solo developer, aggressive sprint
**Daily commitment:** 4-6 focused hours

### Phase Breakdown

```
Week 1: Foundation + Core Backend
├── Phase 1 (Days 1-2):  Monorepo Scaffolding
├── Phase 2 (Days 3-4):  Database + Auth System
└── Phase 3 (Days 5-7):  Core API Endpoints

Week 2: Queue Engine + Real-Time + Frontend Start
├── Phase 4 (Days 8-10):  BullMQ Workers
├── Phase 5 (Days 11-12): WebSocket Real-Time
└── Phase 6 (Days 13-14): Frontend Shell + Auth Pages

Week 3: Frontend Completion + Testing + Ship
├── Phase 7 (Days 15-17): Dashboard + Visualizations
├── Phase 8 (Days 18-19): Testing (80%+ coverage)
└── Phase 9 (Days 20-21): Demo Seeder + CI/CD + Deploy
```

---

### Phase 1: Monorepo Scaffolding (Days 1-2)

**Goal:** `docker compose up` boots the full stack (even if apps do nothing yet)

- [ ] Initialize Turborepo with pnpm workspaces
- [ ] Configure `pnpm-workspace.yaml`, `turbo.json`
- [ ] Set up shared TypeScript configs (`packages/tsconfig/`)
- [ ] Scaffold `apps/api` — Express hello-world with TypeScript + tsx (dev)
- [ ] Scaffold `apps/worker` — BullMQ hello-world
- [ ] Reconfigure `apps/web` — existing Next.js 16 project (move into monorepo)
- [ ] Set up `packages/shared` — initial Zod schemas + types + error classes
- [ ] Set up `packages/db` — Drizzle config, client factory
- [ ] Write `docker-compose.yml` (Postgres + Redis + API + Worker + Web)
- [ ] Write `docker-compose.dev.yml` (dev overrides with volume mounts)
- [ ] Write all Dockerfiles (multi-stage builds)
- [ ] Configure `.env.example` with all required env vars
- [ ] Verify: `docker compose up` starts everything, `pnpm turbo build` succeeds

**Deliverable:** Running monorepo with Docker, all apps boot and connect to Postgres + Redis.

---

### Phase 2: Database + Auth System (Days 3-4)

**Goal:** Users can register, login, refresh tokens, and logout via API

- [ ] Define all Drizzle schema files in `packages/db/schema/`
- [ ] Run `drizzle-kit generate` to create initial migration
- [ ] Run migration against Docker Postgres
- [ ] Implement tenant-scoped query builder (`packages/db/scoped.ts`)
- [ ] Implement `token.service.ts` — JWT sign/verify, refresh rotation, reuse detection
- [ ] Implement `auth.service.ts` — register (bcrypt), login, demo login
- [ ] Implement `auth.controller.ts` + `auth.routes.ts`
- [ ] Implement middleware: `authenticate.ts`, `tenant-scope.ts`, `validate.ts`
- [ ] Implement global `error-handler.ts` middleware
- [ ] Implement Zod-validated env config (`config/env.ts`)
- [ ] Set up manual dependency injection container (`container.ts`)
- [ ] Test with curl/Postman: register → login → access protected route → refresh → logout

**Deliverable:** Complete auth system with token rotation working end-to-end.

---

### Phase 3: Core API Endpoints (Days 5-7)

**Goal:** Full CRUD for monitors, webhooks, incidents via REST API

- [ ] Implement `monitor.service.ts` + `monitor.controller.ts` + routes
  - [ ] GET /api/monitors (list, with pagination)
  - [ ] POST /api/monitors (create + validate with Zod)
  - [ ] GET /api/monitors/:id (detail)
  - [ ] PATCH /api/monitors/:id (update)
  - [ ] DELETE /api/monitors/:id
  - [ ] GET /api/monitors/:id/results (paginated history)
  - [ ] GET /api/monitors/:id/stats (uptime %, avg/p95/p99 latency)
  - [ ] POST /api/monitors/:id/pause
  - [ ] POST /api/monitors/:id/resume
- [ ] Implement `webhook.service.ts` + `webhook.controller.ts` + routes
  - [ ] Full CRUD
  - [ ] GET /api/webhooks/:id/deliveries
  - [ ] POST /api/webhooks/:id/test
- [ ] Implement `incident.service.ts` + `incident.controller.ts` + routes
  - [ ] GET /api/incidents (filterable)
  - [ ] GET /api/incidents/:id
- [ ] Implement GET /api/org + PATCH /api/org
- [ ] Implement rate limiting middleware on auth endpoints
- [ ] Verify all endpoints with curl/Postman, verify tenant isolation

**Deliverable:** Complete REST API — all CRUD operations, tenant-scoped, rate-limited.

---

### Phase 4: BullMQ Workers (Days 8-10)

**Goal:** Health checks run on schedule, status changes create incidents, webhooks fire

- [ ] Set up `health-check.queue.ts` — queue definition, repeatable job config
- [ ] Set up `webhook.queue.ts` — queue definition, retry/backoff config
- [ ] Implement `http-ping.ts` utility — HTTP request with timing, timeout, error capture
- [ ] Implement `health-check.job.ts` processor
  - [ ] Ping URL, measure latency
  - [ ] Determine status (up/down/degraded)
  - [ ] Save result to `healthCheckResults`
  - [ ] Detect status change → create/resolve incident
  - [ ] Enqueue webhook dispatch on status change
  - [ ] Publish to Redis Pub/Sub
- [ ] Implement `webhook-signer.ts` — HMAC-SHA256 payload signing
- [ ] Implement `webhook-dispatch.job.ts` processor
  - [ ] Sign payload, send POST, log delivery
  - [ ] Retry with exponential backoff on failure
- [ ] Wire monitor CRUD to queue management (create/update/delete monitor → add/remove repeatable job)
- [ ] Test: create monitor → see health checks running → trigger status change → verify incident created → verify webhook fires

**Deliverable:** Fully automated health check pipeline — monitors ping on schedule, incidents auto-created, webhooks dispatched.

---

### Phase 5: WebSocket Real-Time (Days 11-12)

**Goal:** Dashboard receives live health check results as they happen

- [ ] Implement `ws-server.ts` — WebSocket upgrade handler with JWT auth on handshake
- [ ] Implement `ws-manager.ts` — connection registry (Map<orgId, Set<WebSocket>>)
- [ ] Implement `redis-subscriber.ts` — subscribe to `health-check:*` channels
- [ ] Wire: Redis Pub/Sub event → WS Manager → broadcast to org's connections
- [ ] Handle: connection cleanup on close, reconnect handling
- [ ] Test with `wscat` or browser DevTools: connect → see live events flowing

**Deliverable:** Real-time event stream working — health check results, status changes, incidents pushed to connected clients.

---

### Phase 6: Frontend Shell + Auth Pages (Days 13-14)

**Goal:** Users can register, login, see an authenticated dashboard shell

- [ ] Install Shadcn UI + configure components
- [ ] Build auth layout (`(auth)/layout.tsx`) — centered, clean
- [ ] Build login page with React Hook Form + Zod validation
- [ ] Build register page with React Hook Form + Zod validation
- [ ] Add "Demo Login" button (1-click, calls `/auth/demo`)
- [ ] Implement `auth-provider.tsx` — context, token management, auto-refresh
- [ ] Implement `api-client.ts` — fetch wrapper, 401 interceptor → auto-refresh
- [ ] Build dashboard layout (`(dashboard)/layout.tsx`) — sidebar + header
- [ ] Implement route protection — redirect to login if unauthenticated
- [ ] Test: full auth flow in browser (register → login → dashboard → logout)

**Deliverable:** Working frontend auth — register, login, demo login, protected dashboard shell.

---

### Phase 7: Dashboard + Visualizations (Days 15-17)

**Goal:** Complete, polished dashboard with real-time charts

- [ ] Build dashboard overview page — summary cards (total monitors, up/down count, active incidents)
- [ ] Build monitors list page — table with status indicators, latency sparklines
- [ ] Build monitor detail page:
  - [ ] Status badge, uptime %, avg latency
  - [ ] Real-time latency line chart (Recharts/Tremor) — fed by WebSocket
  - [ ] Health check history table (paginated)
  - [ ] Related incidents list
- [ ] Build create/edit monitor forms — React Hook Form + Zod
- [ ] Build incidents timeline page — chronological list with status badges, duration
- [ ] Build settings pages:
  - [ ] Organization settings
  - [ ] Webhook management (CRUD + delivery log viewer)
- [ ] Implement `ws-provider.tsx` — WebSocket context, auto-reconnect
- [ ] Implement `use-websocket.ts` hook — subscribe to events, update UI
- [ ] Add loading skeletons, empty states, error boundaries
- [ ] Responsive design — works on mobile + desktop
- [ ] Dark mode support (Tailwind dark variant)

**Deliverable:** Fully functional, polished dashboard — real-time charts, full CRUD, incident timeline.

---

### Phase 8: Testing — 80%+ Coverage (Days 18-19)

**Goal:** Comprehensive test suite proving quality

- [ ] **Unit tests (Vitest):**
  - [ ] `token.service` — generation, verification, rotation, reuse detection
  - [ ] `auth.service` — register, login, password hashing
  - [ ] `monitor.service` — CRUD logic, validation edge cases
  - [ ] `health-check.job` — status determination, status change detection
  - [ ] `webhook-dispatch.job` — HMAC signing, delivery logging
  - [ ] `http-ping` — latency measurement, timeout, error capture
  - [ ] `scoped.ts` — tenant filter always applied
  - [ ] All Zod schemas — valid + invalid inputs
  - [ ] `env.ts` — missing vars throw
- [ ] **API integration tests (Supertest):**
  - [ ] Auth flow: register → login → refresh → logout → reuse detection
  - [ ] Demo login flow
  - [ ] Monitor CRUD: create, read, update, delete, list (paginated)
  - [ ] Tenant isolation: User A can't access User B's data
  - [ ] Webhook CRUD + test delivery
  - [ ] Incidents: list, filter, detail
  - [ ] Validation: bad input returns 400 with details
  - [ ] Auth: expired token → 401, missing token → 401
  - [ ] Rate limiting: auth endpoints block after threshold
- [ ] **E2E tests (Playwright):**
  - [ ] Register → redirect to dashboard
  - [ ] Login → see dashboard → logout → redirect
  - [ ] Demo login → see pre-seeded data
  - [ ] Create monitor → see in list → edit → delete
  - [ ] Dashboard real-time update (monitor detail chart)
- [ ] Run coverage report — verify 80%+
- [ ] Fix any gaps

**Deliverable:** 80%+ test coverage, all tests green.

---

### Phase 9: Demo Seeder + CI/CD + Deploy (Days 20-21)

**Goal:** Live demo accessible at a public URL, CI pipeline running

- [ ] Write `packages/db/seed.ts` — demo data seeder
  - [ ] Demo org: "PulseStack Demo"
  - [ ] Demo user: `demo@pulsestack.io` / auto-login (no password needed via demo endpoint)
  - [ ] 3-5 pre-configured monitors (mix of up/down/degraded)
  - [ ] 7 days of simulated health check history (realistic latency patterns)
  - [ ] 2-3 historical incidents
  - [ ] 1 configured webhook
- [ ] Set up GitHub Actions CI (`.github/workflows/ci.yml`)
  - [ ] Typecheck on every PR
  - [ ] Lint on every PR
  - [ ] Unit + integration tests with Postgres + Redis services
  - [ ] E2E tests
- [ ] Deploy `apps/web` to Vercel
  - [ ] Configure environment variables
  - [ ] Set up preview deploys on PRs
- [ ] Deploy `apps/api` + `apps/worker` to Railway
  - [ ] Provision managed PostgreSQL
  - [ ] Provision managed Redis
  - [ ] Configure environment variables
  - [ ] Run migrations + seed
- [ ] Write comprehensive `README.md`
  - [ ] Project overview + screenshots
  - [ ] Live demo link + demo login instructions
  - [ ] Tech stack with badges
  - [ ] Architecture diagram
  - [ ] Local setup instructions (`docker compose up`)
  - [ ] API documentation summary
  - [ ] Test coverage badge
- [ ] Final polish: check all flows in production, fix any deploy issues
- [ ] Record a 2-minute demo GIF/video for README

**Deliverable:** Live demo at public URL, CI green, polished README, project complete.

---

### Milestone Summary

| Milestone | Day | Verification |
|-----------|-----|-------------|
| Monorepo boots with Docker | Day 2 | `docker compose up` starts all services |
| Auth API works | Day 4 | Register → login → refresh → logout via curl |
| Full REST API | Day 7 | All CRUD endpoints working, tenant-isolated |
| Health checks automated | Day 10 | Monitors ping on schedule, incidents auto-created |
| Real-time working | Day 12 | WebSocket streams live health check data |
| Frontend auth | Day 14 | Register/login/demo in browser |
| Dashboard complete | Day 17 | Full UI with real-time charts |
| 80%+ test coverage | Day 19 | Coverage report confirms |
| **Live demo shipped** | **Day 21** | **Public URL, CI green, README polished** |

---

## Appendix: Environment Variables

```env
# .env.example

# Database
DATABASE_URL=postgresql://pulsestack:pulsestack@localhost:5432/pulsestack

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_ACCESS_SECRET=your-access-secret-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# API
API_PORT=4000
API_URL=http://localhost:4000
CORS_ORIGIN=http://localhost:3000

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=5
```
