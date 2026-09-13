#!/usr/bin/env bash
# No build step — and that is the design, not an omission.
#
# The deploy loop in .github/workflows/deploy-cloudflare-workers.yml runs
# `apps/<app>/scripts/cf-build.sh` before `wrangler deploy` for every app it
# deploys. The other four are OpenNext builds of Next.js applications and need
# several minutes of work here. This Worker is one function returning one
# redirect; wrangler compiles `src/index.ts` on deploy and there is nothing to
# prepare. The file exists so the loop needs no special case for us.
set -euo pipefail
echo "cf-build (driver-redirect): nothing to build — a redirect-only Worker, deployed from source."
