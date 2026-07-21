# DPX-F008 — API Integration

| Field            | Value                     |
| ---------------- | ------------------------- |
| **Document ID**  | DPX-F008                  |
| **Title**        | API Integration           |
| **Program**      | B — Frontend Platform     |
| **Status**       | Draft — architecture only |
| **Last updated** | 2026-07-21                |

## Purpose

How web apps consume Backend Core via `@dripplex/sdk` and OpenAPI.

## Rules

1. SDK is the only HTTP client for Dripplex APIs.
2. Types come from `@dripplex/types`; regenerate/align when OpenAPI changes.
3. Error envelope handling is centralized (`success` / domain errors).
4. Respect Backend Core freeze — file bugs instead of inventing parallel APIs.
5. Contract reference: `apps/backend/openapi/platform-supporting-systems.openapi.yaml` (+ auth/commerce docs as expanded).

## Auth

- Access/refresh handling, 401 retry policy, portal login types per Backend Core.
