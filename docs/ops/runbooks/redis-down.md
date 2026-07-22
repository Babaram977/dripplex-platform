# Runbook — Redis Down

**Alert:** `RedisDown`  
**Severity:** Critical

## Impact

- Sessions / rate limits / queues degraded
- Users may need to re-login after restore

## Actions

1. Check Redis container + volume on data node.
2. Restart Redis; confirm `PING`.
3. If data loss: restore RDB from B2 if required; otherwise cold start (accepted RPO for Redis).
4. Drain DLQs after recovery if workers stalled.
5. Verify API health includes Redis OK.
