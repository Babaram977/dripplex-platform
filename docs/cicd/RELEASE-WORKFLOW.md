# D2 — Release workflow

## Build release (continuous)

`main` push → CI → publish GHCR images tagged `latest` + `<sha12>` → optional staging auto-deploy.

## Semantic release

1. Ensure desired SHA is on `main` and staging-validated.
2. Run **Release Tag** workflow with `version` = `1.0.0` (no `v` prefix).
3. Annotated git tag `v1.0.0` pushed.
4. Optionally re-run **Publish** with `tag=v1.0.0` or retag digests.
5. Run **Deploy Production** with `image_tag=v1.0.0` (or sha) + confirmation.

## Notifications

| Event                            | Channel |
| -------------------------------- | ------- |
| Images published                 | Slack   |
| Staging success/fail             | Slack   |
| Production success/fail/rollback | Slack   |
| Semver tag created               | Slack   |

Webhook secret: `SLACK_WEBHOOK_URL`.
