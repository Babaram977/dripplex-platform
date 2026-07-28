# D1 — Deployment readiness report

## Verdict

| Question                                                        | Answer                                   |
| --------------------------------------------------------------- | ---------------------------------------- |
| Is production infrastructure **designed** and codified in-repo? | **Yes**                                  |
| Are live cloud resources provisioned?                           | **No** — requires credentials + approval |
| Ready to begin D2 (deploy/cutover hardening)?                   | **Pending review approval**              |

## Readiness matrix

| Area                            | Status | Notes                        |
| ------------------------------- | ------ | ---------------------------- |
| Architecture / topology         | ✅     | Diagrams + docs              |
| Server specification            | ✅     | Hetzner sizes                |
| Cloudflare plan                 | ✅     | Full strict, DNS, WAF, R2    |
| Docker production compose       | ✅     | App + data + obs             |
| Kubernetes manifests            | ✅     | Autoscaling-ready            |
| DB backup / PITR                | ✅     | Scripts + B2                 |
| Redis strategy                  | ✅     | Persist + queues             |
| Monitoring / logging / alerting | ✅     | Prom/Grafana/Loki/Kuma rules |
| Security checklist              | ✅     | Pre-flight list              |
| DR / RTO / RPO                  | ✅     | 4h / 1h targets              |
| Cost estimate                   | ✅     | ~$160–200/mo recommended     |
| CI/CD staging + prod            | ✅     | Workflows added              |
| Secrets inventory               | ✅     | Rotation policy              |
| Live DNS / VMs                  | ⏳     | Human provisioning           |
| App feature gaps (C2)           | n/a    | Out of D1 scope              |

## Blockers before real traffic

1. Approve D1 design.
2. Provision Cloudflare zone + Hetzner project.
3. Load secrets; issue Origin CA; set Full (strict).
4. Apply compose on staging; restore drill once.
5. Proceed to **D2** only after sign-off.

## Sign-off

| Role     | Name | Date | Approved |
| -------- | ---- | ---- | -------- |
| Eng lead |      |      |          |
| DevOps   |      |      |          |
| Security |      |      |          |

**Wait for review before D2.**
