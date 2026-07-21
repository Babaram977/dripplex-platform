# Security Policy

## Supported versions

| Version      | Supported |
| ------------ | --------- |
| `0.x` (main) | Yes       |

Only the latest `main` branch receives security updates during early platform development.

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Email **security@dripplex.com** with:

1. Description of the vulnerability and affected component (`apps/*` or `packages/*`).
2. Steps to reproduce, proof of concept, or impact assessment.
3. Suggested remediation if available.
4. Your preferred contact method and disclosure timeline.

You should receive an acknowledgement within **two business days**. We aim to provide an initial severity assessment within **five business days**.

## Safe harbor

We will not pursue legal action against researchers who:

- Make a good-faith effort to avoid privacy violations, service disruption, and data destruction.
- Do not exploit the vulnerability beyond what is necessary to demonstrate it.
- Report findings promptly and keep them confidential until we confirm a fix or coordinated disclosure date.

## Security requirements for contributors

- Never commit secrets, API keys, private keys, or production credentials.
- Use `.env` locally; keep `.env.example` updated with non-secret placeholders.
- Hash passwords with a modern KDF (Argon2id / bcrypt as implemented in the Auth module).
- Enforce RBAC on every protected endpoint and UI route.
- Validate and sanitize all external input (DTO / Zod).
- Prefer parameterized Prisma queries; never concatenate SQL.
- Apply rate limiting on authentication and payment endpoints.
- Log security-relevant events without logging secrets or full PII payloads.
