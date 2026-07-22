# Runbook — Capacity (CPU / Memory / Disk)

**Alerts:** `HighCPU`, `HighMemory`, `DiskFull`, `DiskCritical`

## Actions

1. Identify host via Grafana Infrastructure dashboard.
2. DiskCritical: free space immediately (logs, old images `docker system prune` carefully, expand volume).
3. CPU/Memory: scale API/portal replicas (Compose scale / K8s HPA) or kill runaway container via cAdvisor.
4. Capture `docker stats` before changes.
5. Open capacity ticket if sustained > 1h at warning thresholds.
