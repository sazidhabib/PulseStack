# PulseStack ⚡

> **Enterprise Multi-Tenant Background Job & Real-Time Health Monitoring SaaS**  
> Built with 100% TypeScript, Turborepo, Next.js 16 (App Router), Node.js, BullMQ, Redis, PostgreSQL, Drizzle ORM, and WebSockets.

[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Turborepo](https://img.shields.io/badge/Turborepo-Monorepo-ef4444.svg?logo=turborepo)](https://turbo.build/)
[![Next.js](https://img.shields.io/badge/Next.js-16_Turbopack-black.svg?logo=next.js)](https://nextjs.org/)
[![BullMQ](https://img.shields.io/badge/Queue-BullMQ_%2B_Redis-ff4438.svg?logo=redis)](https://bullmq.io/)
[![Drizzle ORM](https://img.shields.io/badge/ORM-Drizzle_PostgreSQL-green.svg)](https://orm.drizzle.team/)
[![Automated Tests](https://img.shields.io/badge/Tests-93_Passing-brightgreen.svg?logo=vitest)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🏛️ System Architecture

PulseStack is engineered as a high-throughput, fault-tolerant distributed system with strict tenant data isolation, sub-second telemetry streams, and scheduled background workers.

```
                              ┌─────────────────────────────────────────┐
                              │            Next.js 16 Frontend          │
                              │ (Tailwind 4, Recharts, Shadcn, WS Client)│
                              └───────▲─────────────────────────┬───────┘
                                      │                         │
                        WebSocket /ws │                         │ REST API (Dual-Token JWT)
                                      │                         │
                              ┌───────┴─────────────────────────▼───────┐
                              │           Node.js / Express API         │
                              │   - Tenant-Scoped Query Builder         │
                              │   - WsManager (Tenant-isolated registry)│
                              │   - Token Family Rotation & Detection   │
                              └───────▲─────────────────────────┬───────┘
                                      │                         │
                    Redis Pub/Sub     │                         │ Enqueue Repeatable Job
                 (health-check:orgId) │                         │
                                      │                         ▼
                              ┌───────┴────────┐        ┌───────────────┐
                              │  Redis Pub/Sub │        │ Redis BullMQ  │
                              │   Event Bus    │        │ Health Checks │
                              └───────▲────────┘        └───────┬───────┘
                                      │                         │
                                      │     De-queue & Execute  │
                                      │     Ping (every 60s)    │
                                      │                         ▼
                                ┌─────┴─────────────────────────┴───────┐
                                │            BullMQ Worker App          │
                                │   - High-Resolution Latency Timer     │
                                │   - Auto-Incident Trigger/Resolution  │
                                │   - HMAC-SHA256 Webhook Dispatcher    │
                                └──────────────────┬────────────────────┘
                                                   │
                                                   ▼
                                       ┌───────────────────────┐
                                       │ PostgreSQL Database   │
                                       │ (Drizzle ORM Scoped)  │
                                       └───────────────────────┘
```

---

## 💎 Key Engineering & Architecture Proof Points

### 1. 100% TypeScript with End-to-End Zod Validation
- Shared contract definitions in `@pulsestack/shared` imported across API, Worker, and Web.
- Strict compile-time type safety with zero `any` shortcuts.
- Validates all HTTP payloads, queue job inputs, and environment variables with Zod schemas.

### 2. Zero-Trust Dual-Token Auth with Family-Based Reuse Breach Detection
- **15-minute Access Token** stored in memory (never in localStorage to prevent XSS).
- **7-day Refresh Token** delivered in an `httpOnly`, `SameSite=Lax`, `Secure` cookie.
- **Token Family Rotation:** Refresh tokens form a cryptographic family. If an already-invalidated parent token is reused (indicating stolen token breach), the **entire token family is immediately revoked**, forcing re-authentication.

### 3. Strict Row-Level Multi-Tenant Isolation
- Custom `createTenantScope(db, orgId)` query builder wrapper in `@pulsestack/db`.
- Automatically enforces `where(eq(table.orgId, orgId))` across all database queries.
- Prevents cross-tenant data leaks and unauthorized foreign tenant modifications with HTTP 404/403 responses.

### 4. Distributed BullMQ Repeatable Queue Engine
- Scheduled health check jobs execute at configurable intervals (60s, 300s, 900s).
- Sub-millisecond high-resolution HTTP ping timing with timeout abort signals.
- Exponential backoff retry policies for webhook dispatches with HMAC-SHA256 payload signatures (`X-Pulse-Signature`).

### 5. Real-Time Telemetry Stream with Redis Pub/Sub Backplane
- Worker processes publish check results and incident state transitions to Redis channels (`health-check:${orgId}`).
- API instances subscribe via Redis subscriber pattern and push events to connected WebSockets.
- Sockets are grouped in a tenant registry (`WsManager`), guaranteeing that Tenant A never receives telemetry intended for Tenant B.
- Automated 30s ping/pong heartbeat detects dropped sockets and cleans up stale connections.

### 6. Automated Testing & Verification
- **93 Automated Tests** across Vitest, Supertest, and Playwright:
  - 75 API unit & integration tests (routes, controllers, services, WS server).
  - 13 Worker unit tests (ping logic, HMAC signing, BullMQ processors).
  - 5 Web unit tests (API client transparent 401 retry, utility functions).
  - 3 Playwright E2E test suites (auth flows, monitor management, dashboard telemetry).
- **High Code Coverage:**
  - Health Check Job Processor: **98.7%**
  - Latency Measurement Utilities: **93.5%**
  - WebSocket Server & Handshake: **90.9%**
  - Token Rotation & Breach Detection: **86.6%**
  - Incident & Monitor Route Handlers: **100%**

---

## 📂 Monorepo Structure

```
PulseStack/
├── apps/
│   ├── web/                    # Next.js 16 App Router (Turbopack, Tailwind 4, Recharts)
│   ├── api/                    # Express 4 REST API & WebSocket Gateway (/ws)
│   └── worker/                 # BullMQ Background Job Consumer
├── packages/
│   ├── db/                     # Drizzle ORM PostgreSQL Client & Schemas
│   ├── shared/                 # Zod Schemas, Error Classes, Shared Types
│   └── tsconfig/               # Shared TypeScript Configurations
├── docker-compose.yml          # Production multi-container setup
├── docker-compose.dev.yml      # Local dev database & redis services
├── turbo.json                  # Turborepo task pipeline configuration
└── pnpm-workspace.yaml         # pnpm workspace definition
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- **Node.js**: `v20.x` or `v22.x`+
- **pnpm**: `v9.x` or `v12.x`+ (`npm install -g pnpm`)
- **Docker & Docker Compose**

### 1. Clone & Install
```bash
git clone https://github.com/your-username/pulsestack.git
cd pulsestack
pnpm install
```

### 2. Start PostgreSQL & Redis
```bash
docker compose -f docker-compose.dev.yml up -d
```

### 3. Run Migrations & Seed Demo Data
```bash
# Push schema migrations
pnpm db:migrate

# Seed demo tenant with 5 monitors & 7 days of realistic historical telemetry
pnpm seed
```

### 4. Start Monorepo in Development Mode
```bash
pnpm dev
```
- **Web Dashboard:** [http://localhost:3000](http://localhost:3000)
- **API Server:** [http://localhost:4000](http://localhost:4000)
- **API Health Endpoint:** [http://localhost:4000/health](http://localhost:4000/health)
- **WebSocket Telemetry Stream:** `ws://localhost:4000/ws?token=<accessToken>`

---

## ⚡ 1-Click Demo Sandbox

PulseStack includes a built-in demo environment pre-configured with active and failing monitors, telemetry graphs, and incident histories:

| Role | Email | Password | Organization |
| :--- | :--- | :--- | :--- |
| **Owner / Admin** | `demo@pulsestack.io` | `Demo1234!` | PulseStack Demo Inc |

Or click the **"Launch 1-Click Demo"** button on the login screen for instant one-click authentication.

---

## 🧪 Testing

```bash
# Run all unit and integration tests across all packages
pnpm test

# Run API test coverage report
pnpm --filter @pulsestack/api test:coverage

# Run Worker test coverage report
pnpm --filter @pulsestack/worker test:coverage

# Run Playwright E2E test suite
pnpm test:e2e
```

---

## 🐳 Production Docker Deployment

Deploy App, API, Worker, Postgres, and Redis simultaneously with a single command:

```bash
docker compose up --build -d
```

---

## 📄 License

MIT &copy; PulseStack Team. Built as an enterprise-grade portfolio SaaS demonstrating TypeScript, BullMQ, Redis, Clean Architecture, and automated test coverage.
