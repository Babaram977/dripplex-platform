# @dripplex/customer-web

Customer-facing Next.js 15 application for the Dripplex Super Platform.

Commit 3 delivers the **customer shell only** — layouts, marketing pages, auth UI, and dashboard chrome. Marketplace, wallet, orders, payments, delivery, ride, and merchant product surfaces are intentionally out of scope.

## Stack

- Next.js 15 App Router + React 19
- TypeScript (strict)
- Tailwind CSS + shadcn-style primitives
- TanStack Query, React Hook Form, Zod, Zustand
- Light / Dark / System theme (persisted)

## Routes

### Public (`(public)` layout)

| Path       | Description       |
| ---------- | ----------------- |
| `/`        | Landing page      |
| `/about`   | About             |
| `/privacy` | Privacy           |
| `/terms`   | Terms             |
| `/contact` | Contact form (UI) |

### Auth (`(auth)` layout)

| Path               | Description                |
| ------------------ | -------------------------- |
| `/login`           | Login form (UI only)       |
| `/register`        | Register form (UI only)    |
| `/forgot-password` | Forgot password (UI only)  |
| `/reset-password`  | Reset password (UI only)   |
| `/verify-otp`      | OTP verification (UI only) |

### Dashboard (`(dashboard)` layout)

| Path         | Description                                            |
| ------------ | ------------------------------------------------------ |
| `/dashboard` | Dashboard shell (header, sidebar, mobile nav, content) |

## Local development

```bash
# from repo root
pnpm install
pnpm --filter @dripplex/customer-web dev
```

App defaults to [http://localhost:3001](http://localhost:3001).

## Quality gates

```bash
pnpm --filter @dripplex/customer-web lint
pnpm --filter @dripplex/customer-web typecheck
pnpm --filter @dripplex/customer-web test
pnpm --filter @dripplex/customer-web build
```

## Architecture notes

UI primitives, validation schemas, formatting utilities, and shared providers live in `@dripplex/ui`, `@dripplex/types`, `@dripplex/utils`, and `@dripplex/hooks`. Customer-web keeps app-specific layouts, marketing sections, forms, and route groups.

Tailwind uses the shared preset from `@dripplex/ui/tailwind`. Styles are imported via `@dripplex/ui/styles.css`.

Auth forms validate with Zod schemas from `@dripplex/types`. API integration via `@dripplex/sdk` lands in Sprint 1 (Identity & Authentication).
