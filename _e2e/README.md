# _e2e — Super-app UI crawl harness

Playwright-driven scripts that drive the **real** super-app Design Preview
(`apps/super-app`, served on `http://127.0.0.1:3006`) against the **real**
local backend (`http://127.0.0.1:3005`) and record video + screenshots +
a per-button pass/fail report. Nothing here mocks UI state or backend
responses — HTTP `>=400` responses on `/api/` are captured as failures, so
an unauthenticated data screen surfaces as a genuine `http401`, proving the
backend is live rather than stubbed.

## Prerequisites

- Local stack running: Postgres `:5432`, Redis `:6379`, backend `:3005`,
  super-app `:3006`.
- Chromium is pre-installed in this environment at
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (see the harness
  constant `CHROME`). `playwright-core` is used only as the driver:

  ```sh
  pnpm add -w -D playwright-core@1.56.1   # not committed to the lockfile
  ```

  It is intentionally kept out of the committed lockfile to avoid unrelated
  monorepo lockfile churn; install it ad-hoc when running the crawl.

## Scripts

| Script            | Purpose                                                                                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `button-test.mjs` | Expand every sidebar accordion group, visit each screen, click up to 5 in-page buttons per screen, screenshot each, record video, emit `button-report.json` + `test-log.txt`. |
| `smoke.mjs`       | Single-screen smoke: load the app, screenshot, assert no console/page errors.                                                                                                 |
| `inspect.mjs`     | Dump the sidebar button/group structure for debugging.                                                                                                                        |
| `inspect2.mjs`    | Deeper structural dump (leaf enumeration per group).                                                                                                                          |

## Run

```sh
node _e2e/button-test.mjs /path/to/output-dir
```

Output dir receives `screenshots/`, `videos/`, `button-report.json`,
`test-log.txt`. The report is checkpointed after every accordion group so a
reclaimed process still leaves partial evidence.
