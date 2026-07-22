# Runbook — Backup Failure

**Alert:** `BackupFailure`

## Actions

1. Check cron / systemd timer for `backup-postgres.sh`.
2. Verify B2 credentials and age encryption key.
3. Run manual backup; confirm object in B2.
4. Export/update `dripplex_backup_last_success_timestamp_seconds` metric (node_exporter textfile or pushgateway).
5. If > 1 missed daily window → Sev-2 incident (data risk).
