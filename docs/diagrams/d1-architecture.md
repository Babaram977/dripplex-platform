# D1 — Infrastructure diagram

## Logical architecture

```mermaid
flowchart TB
  Internet([Internet / Users / Merchants / Riders / Admin])
  CF[Cloudflare Edge<br/>DNS · CDN · WAF · DDoS · SSL Full Strict · R2 CDN]
  LB[Origin Load Balancer<br/>Nginx / Hetzner LB]
  subgraph FE[Frontend Cluster]
    CW[Customer Web<br/>www]
    MP[Merchant Portal]
    RP[Rider Portal]
    AP[Admin Portal]
  end
  subgraph BE[Backend Cluster]
    API[Backend Core API<br/>stateless · HPA-ready]
    WRK[Background Workers<br/>email · SMS · push · jobs]
  end
  subgraph DATA[Data Plane — private network]
    PG[(PostgreSQL 16<br/>primary + pooler)]
    RD[(Redis 7<br/>sessions · queues · rate limits)]
    R2[(Cloudflare R2<br/>uploads · logos · CMS)]
    B2[(Backblaze B2<br/>encrypted off-site backups)]
  end
  subgraph OBS[Observability]
    PROM[Prometheus]
    GRAF[Grafana]
    LOKI[Loki]
    KUMA[Uptime Kuma]
    SENTRY[Sentry]
  end

  Internet --> CF
  CF --> LB
  LB --> FE
  LB --> API
  FE --> API
  API --> PG
  API --> RD
  API --> R2
  WRK --> PG
  WRK --> RD
  WRK --> R2
  API --> PROM
  WRK --> PROM
  PROM --> GRAF
  LOKI --> GRAF
  KUMA --> CF
  API --> SENTRY
  FE --> SENTRY
  PG -.->|daily + WAL/PITR| B2
  RD -.->|RDB snapshots| B2
```

## Request path (example: customer checkout)

```text
Browser → Cloudflare (TLS 1.3, WAF, CDN)
       → Origin LB :443 (Cloudflare Origin CA)
       → Customer Web (Next.js)
       → api.dripplex.com → Backend Core
       → PostgreSQL / Redis / R2
```

## Trust boundaries

| Zone        | Contents                       | Exposure                       |
| ----------- | ------------------------------ | ------------------------------ |
| Public edge | Cloudflare proxied hostnames   | Internet                       |
| DMZ / LB    | Nginx terminates TLS to origin | Cloudflare IPs only (firewall) |
| App VLAN    | Frontends, API, workers        | Private                        |
| Data VLAN   | Postgres, Redis                | Private; no public ports       |
| Ops         | Grafana, Prometheus, Kuma      | VPN / Cloudflare Access        |

See also: `docs/infrastructure/TOPOLOGY.md`.
