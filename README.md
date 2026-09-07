# AssignMate API

_Every assignment needs a mate._

A marketplace backend where university students post assignments, verified experts
bid on them, and the money sits in escrow until the work is actually delivered.

**Live:** https://api.assignmate.withakash.dev

```bash
curl https://api.assignmate.withakash.dev/
# {"message":"Hello AssignMate V1.0!"}
```

---

## What problem this solves

Freelance academic help usually runs on trust and DMs. A student pays up front and
hopes the work arrives; an expert delivers and hopes payment follows. Someone
always carries the risk.

AssignMate puts a state machine and an escrow account between the two parties. The
student pays once they accept a bid, but the money is _held_ rather than forwarded —
the expert can see the job is funded before starting, and the student can see the
work before the money moves. Neither side has to trust the other, only the flow.

That flow is the actual substance of this project. The CRUD around it is scaffolding.

## The assignment lifecycle

Every assignment moves through a fixed set of states. Transitions are driven by role
— an expert cannot accept a bid on their own behalf, a student cannot mark work
`SUBMITTED`.

```
  OPEN ──▶ AWAITING_PAYMENT ──▶ ASSIGNED ──▶ IN_PROGRESS ──▶ SUBMITTED
             (student accepts     (bKash       (expert         (expert
              a bid)               clears,      starts)         uploads)
                                   escrow HELD)                    │
                                                                   ▼
                                                            UNDER_REVIEW
                                                             │         │
                                            student accepts ─┘         └─ student disputes
                                                    │                    (reason required)
                                                    ▼                            │
                                               COMPLETED                         ▼
                                    (escrow RELEASED_TO_EXPERT,              DISPUTED
                                     expert earnings credited)          (admin arbitrates)
```

Note the ordering: accepting a bid does **not** assign the job. It moves the
assignment to `AWAITING_PAYMENT` and waits. Only once bKash confirms does the
assignment become `ASSIGNED` and the escrow row appear as `HELD`. An expert never
starts work on an unfunded job.

The states themselves live in [`prisma/schema/enums.prisma`](prisma/schema/enums.prisma);
the transition rules live in the assignment and bid services.

## How the money moves

An `Escrow` row is created when payment clears, and it stores the split as
percentages rather than amounts — so changing the platform's cut later does not
require rewriting historical rows.

| Field                | Default | Meaning                                                |
| -------------------- | ------- | ------------------------------------------------------ |
| `totalAmount`        | —       | What the student paid, `Decimal(12,2)`                 |
| `platformCommission` | `15`    | Platform's share, in percent                           |
| `expertEarnings`     | `85`    | Expert's share, in percent                             |
| `status`             | `HELD`  | `HELD` → `RELEASED_TO_EXPERT` \| `REFUNDED_TO_STUDENT` |

Payouts are computed at release time, not at capture time
([`escrow.service.ts`](src/app/module/escrow/escrow.service.ts)). Money is stored as
`Decimal`, never as a float — currency in `Float` is a bug waiting for a rounding
error.

The gateway is bKash (tokenized checkout). `PaymentGateway` is an enum with
`SSLCOMMERZ` and `STRIPE` already reserved, so adding a second provider means adding
a service, not migrating a table.

## Roles and auth

Three roles: `STUDENT`, `EXPERT`, `ADMIN`.

Authentication is JWT with a short-lived access token and a long-lived refresh token.
Registration is two-step — an OTP is emailed and held in Redis with a 5-minute TTL,
so a half-finished signup leaves nothing behind in Postgres. Google OAuth is
supported as a second `AuthProvider` alongside credentials.

Experts do not self-approve. An expert registers, uploads verification documents to
Cloudinary, and stays at `ExpertVerificationStatus.PENDING` until an admin flips them
to `APPROVE`. The status is recorded and surfaced, but bidding does not yet gate on
it — see [Known gaps](#known-gaps).

## Tech stack

|                |     | Why                                                                                  |
| -------------- | --- | ------------------------------------------------------------------------------------ |
| **Bun**        | 1.4 | Runs TypeScript directly — no build step, no `dist/`, no source maps to keep in sync |
| **Express**    | 5   | Native async error propagation, so `catchAsync` stays thin                           |
| **PostgreSQL** | 17  | Relational data with real money in it wants real constraints                         |
| **Prisma**     | 7   | Driver adapter (`@prisma/adapter-pg`), no query-engine binary to ship                |
| **Redis**      | —   | OTPs and the cached bKash grant token; both are TTL-shaped, not table-shaped         |
| **Zod**        | 4   | Request validation at the boundary; parsed output replaces `req.body`                |
| **Cloudinary** | —   | Attachments and verification docs, uploaded straight from memory                     |
| **Resend**     | —   | Transactional email                                                                  |
| **Docker**     | —   | Deployment image, pinned to the same Bun that wrote `bun.lock`                       |

A note on Prisma 7: the client is generated with the `prisma-client` generator into
`prisma/src/generated/prisma` and committed to the repo. Combined with the pg driver
adapter, that means no `prisma generate` step at deploy time and no platform-specific
engine binary in the image.

## Getting started

**Requirements:** Bun 1.4+, PostgreSQL 14+, a Redis instance.

```bash
git clone https://github.com/kamruj-akash/AssignMate-API.git
cd AssignMate-API
bun install
```

Set up your environment:

```bash
cp .env.example .env
```

Every variable is documented in [`.env.example`](.env.example). At minimum you need
`DATABASE_URL`, `REDIS_URL` and the two JWT secrets — the rest gate individual
features (payments, email, OAuth, uploads).

Apply the schema and start the server:

```bash
bunx prisma migrate dev --name init
bun run dev
```

No migration history is committed yet, so the first run generates the initial
migration from [`prisma/schema/`](prisma/schema/) and applies it to your database.

The API comes up on `http://localhost:4000`.

### Seeding

`seedData()` creates one admin, one student and three approved experts, all sharing
the `DEFAULT_PASSWORD` from your environment. Handy for exercising the flow without
clicking through six signups.

> **Set `DEFAULT_PASSWORD` to something real before seeding anything reachable from
> the internet.** The seed creates an `ADMIN` account, and it falls back to a
> well-known default when the variable is unset.

## API reference

Base path: `/api/v1`. Guarded routes expect `Authorization: Bearer <accessToken>`.

A Postman collection with an environment file lives in [`postman/`](postman/).

### Auth — `/auth`

| Method | Path                          | Access   |
| ------ | ----------------------------- | -------- |
| `POST` | `/register`                   | public   |
| `POST` | `/verify-register`            | public   |
| `POST` | `/login`                      | public   |
| `POST` | `/google-login`               | public   |
| `POST` | `/forget-password`            | public   |
| `POST` | `/verify-forget-password-otp` | public   |
| `POST` | `/refresh-token`              | public   |
| `GET`  | `/me`                         | any role |

### Experts — `/expert`

| Method | Path             | Access                                               |
| ------ | ---------------- | ---------------------------------------------------- |
| `POST` | `/register`      | public                                               |
| `POST` | `/verify`        | public · multipart, up to 5 documents                |
| `POST` | `/student-apply` | student · multipart — apply to also become an expert |
| `POST` | `/approve`       | admin                                                |
| `GET`  | `/get-all`       | admin                                                |

### Students — `/student`

| Method  | Path          | Access  |
| ------- | ------------- | ------- |
| `GET`   | `/me`         | student |
| `PATCH` | `/me`         | student |
| `GET`   | `/get-all`    | admin   |
| `GET`   | `/:studentId` | admin   |

### Assignments — `/assignment`

| Method  | Path                            | Access                                  |
| ------- | ------------------------------- | --------------------------------------- |
| `POST`  | `/create`                       | student · multipart, one attachment     |
| `GET`   | `/feed`                         | public — open assignments               |
| `GET`   | `/:assignmentId/get`            | public                                  |
| `GET`   | `/my-assignments`               | student, expert                         |
| `PATCH` | `/:assignmentId/submit`         | expert · multipart                      |
| `PATCH` | `/:assignmentId/action`         | student — accept or reject a submission |
| `GET`   | `/dispute/:assignmentId`        | admin                                   |
| `PATCH` | `/dispute/:assignmentId/action` | admin                                   |

### Bids — `/bid`

| Method   | Path                        | Access                             |
| -------- | --------------------------- | ---------------------------------- |
| `POST`   | `/make-bid`                 | expert                             |
| `GET`    | `/my-bids`                  | expert                             |
| `DELETE` | `/:bidId/delete`            | expert                             |
| `GET`    | `/assignment/:assignmentId` | student — bids on their assignment |
| `PUT`    | `/:bidId/accept`            | student                            |

### Payments — `/payment`

| Method | Path                               | Access                    |
| ------ | ---------------------------------- | ------------------------- |
| `POST` | `/initiate-checkout/:assignmentId` | student                   |
| `GET`  | `/callback/bkash`                  | public — gateway callback |
| `GET`  | `/history`                         | student, admin            |

### Escrow — `/escrow`

| Method | Path                       | Access                 |
| ------ | -------------------------- | ---------------------- |
| `GET`  | `/vault/:assignmentId`     | student, expert, admin |
| `GET`  | `/admin/revenue-analytics` | admin                  |

### Reviews — `/review`

| Method | Path                | Access  |
| ------ | ------------------- | ------- |
| `POST` | `/write`            | student |
| `GET`  | `/expert/:expertId` | public  |
| `GET`  | `/:assignmentId`    | public  |

### Analytics — `/analytics`

| Method | Path                | Access  |
| ------ | ------------------- | ------- |
| `GET`  | `/admin/overview`   | admin   |
| `GET`  | `/student/overview` | student |
| `GET`  | `/expert/overview`  | expert  |

## Response shape

Success:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Assignments retrieved successfully",
  "data": [],
  "meta": { "page": 1, "limit": 10, "total": 0, "totalPages": 0 }
}
```

Failure:

```json
{
  "success": false,
  "statusCode": 400,
  "name": "AppError",
  "message": "email: invalid email; otp: OTP must be 6 characters"
}
```

Client errors keep their real message in production, because a `4xx` describes
something the caller can fix. Only `5xx` is masked to `"Internal Server Error"` —
those are the ones that can leak internals. In development the response also carries
the error object and stack.

## Project structure

```
src/
├── server.ts              # boot: Redis, seed, listen, graceful shutdown
├── app.ts                 # Express app, route mounting, middleware order
└── app/
    ├── config/            # env, redis
    ├── lib/               # prisma, cloudinary, resend, bkash, multer, googleClient
    ├── middleware/        # authCheck, validation (Zod), globalErrorHandler, notFound
    ├── module/            # one folder per domain
    │   └── <name>/        #   route → controller → service → validations
    └── utils/             # AppError, catchAsync, sendResponse, seed
prisma/
├── schema/                # split schema, one file per model
└── src/generated/prisma/  # committed Prisma client
```

Each module is a vertical slice: `route` wires the URL and its guards, `controller`
unwraps the request, `service` holds the rules and touches the database,
`validations` holds the Zod schemas. Nothing reaches around a layer.

## Deployment

Deployed on Render as a Docker service. The image is built from
[`Dockerfile`](Dockerfile) on `oven/bun:1.4.0-alpine`, with dependencies installed in
their own layer so a code-only change does not reinstall everything.

Set every variable from `.env.example` in the platform dashboard, with two
exceptions: skip `PORT` (Render injects its own) and set `NODE_ENV=production`.

## Known gaps

Being honest about what is not done, in rough priority order:

- **No automated tests.** The flow is exercised through the Postman collection by
  hand. The escrow state machine is the obvious first thing to cover.
- **Seeding runs on every boot.** It should be a one-off script, not part of startup —
  on a platform that spins down when idle, this adds queries to every cold start.
- **Redis is connected before the HTTP server binds.** If Redis is unreachable the
  boot hangs on the client's retry loop instead of failing fast.
- **Bidding does not check expert verification.** `ExpertVerificationStatus` is
  recorded and admin-controlled, but `bid.service.ts` never reads it, so a `PENDING`
  expert can still place bids.
- **`CANCELLED` is unreachable.** The enum value exists and nothing ever writes it;
  there is no cancel path for a student who changes their mind before payment.
- **Disputes are stubbed.** The admin routes are wired and guarded, but the
  arbitration logic behind them is not written yet.
- **Refunds are modelled, not implemented.** `REFUNDED_TO_STUDENT` and
  `PaymentStatus.REFUNDED` exist in the schema; nothing sets them.

## License

Not currently licensed for reuse. Built by [Kamruj Akash](https://github.com/kamruj-akash).
