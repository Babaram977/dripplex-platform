# MKT-INT-001-C: Schema Design — integrationName, posProvider, vendorName

**Last Updated:** 2026-09-04  
**Status:** RESOLVED — Both fields intentionally maintained  
**Decision:** Dual-field strategy for backward compatibility during C migration

---

## Problem

The `MerchantIntegration` schema now has two seemingly redundant fields:

- `posProvider` (legacy, existing): POS system provider type (e.g., "TALABAT", "JUMIA", "CUSTOM_POS")
- `vendorName` (new, C-phase): Vendor name (required by C API contract)

This creates potential confusion and data duplication during the migration from A/B to C phase.

---

## Field Semantics

### `integrationName` (legacy, string, required)

- **Purpose:** User-friendly label for the merchant's specific integration instance
- **Example:** "Branch A POS", "Main Inventory System", "Warehouse Sync"
- **Owned by:** Merchant (human-readable)
- **Scope:** Instance-level (each merchant's individual integration can have a different name)

### `posProvider` (legacy, string, required)

- **Purpose:** Type/category of the POS system being integrated
- **Example:** "TALABAT", "JUMIA", "CUSTOM_POS", "SQUARE", "LIGHTSPEED"
- **Owned by:** Platform (standardized list)
- **Scope:** System-level (identifies which adapter/provider handles this integration)

### `vendorName` (new C API, string, required with @default(""))

- **Purpose:** Primary vendor/provider name per C API contract
- **Example:** "Talabat POS", "Jumia Marketplace", "Custom Integration"
- **Owned by:** C API contract (standardized via C implementation)
- **Scope:** Hybrid (can be merchant-supplied in C API calls, but typically matches posProvider type)

---

## Design Decision: Keep Both Fields

### Why Both?

1. **Backward Compatibility (A/B phases)**
   - Existing code, UI, and queries reference `posProvider`
   - Clients already built integrations using `posProvider` field
   - Removing `posProvider` would require migration of all existing merchant integrations

2. **C API Contract**
   - The C contract explicitly requires `vendorName` as a field
   - `vendorName` is the C-phase's official vendor designation
   - This is the contract the CTO approved

3. **Semantic Distinction (Subtle but Real)**
   - `posProvider` = "What type of system is it?" (TALABAT, JUMIA, etc.)
   - `vendorName` = "What does the vendor/merchant call this integration?" (can be custom per merchant)
   - Example: Two merchants might both integrate TALABAT, but name it differently in vendorName

4. **No Data Loss**
   - During C creation, `vendorName` can be backfilled from `posProvider` or explicitly set
   - Migration sets `vendorName` to `integrationName` where available, then defaults to ""
   - All existing records remain usable

### Relationships

| Field             | Created By | Updated By      | Semantics                | Future                                |
| ----------------- | ---------- | --------------- | ------------------------ | ------------------------------------- |
| `integrationName` | Legacy API | Either API      | User label               | Consider deprecating post-D           |
| `posProvider`     | Legacy API | Legacy API only | System type              | Keep indefinitely for backward compat |
| `vendorName`      | C API      | C API only      | Vendor name per contract | Official designation going forward    |

---

## Migration Strategy

### During C Phase (Now)

- `vendorName` is added with `@default("")` to maintain backward compat
- Existing integrations get `vendorName = ""` by default
- C API creates new integrations with explicit `vendorName`
- Legacy A/B APIs continue using `posProvider`

### Data Consistency Rules

1. **Creation via C API:** vendorName is required; posProvider is NOT touched
2. **Creation via A/B API:** posProvider is set; vendorName is backfilled from integrationName
3. **Updates via C API:** Only vendorName can be updated
4. **Updates via A/B API:** Only posProvider (legacy) can be updated
5. **Queries:** Both fields are always returned; applications pick which to use

### Example: Two Merchants Create TALABAT Integrations

**Merchant A (via Legacy API):**

```json
{
  "integrationName": "Branch A - Talabat Sync",
  "posProvider": "TALABAT",
  "vendorName": "" (default)
}
```

**Merchant B (via C API):**

```json
{
  "vendorName": "Talabat POS System",
  "posProvider": null or not set (C API doesn't write this)
}
```

During cross-API migration, a C API client could read both and choose which to display.

---

## No Breaking Changes

- A/B phase code continues working unchanged
- C phase code uses `vendorName` exclusively
- D phase (future) can standardize on one field after sunsetting A/B
- No migration of existing merchant data required now

---

## Post-Approval Cleanup (Future)

After D phase is complete and A/B are fully deprecated:

1. Evaluate if `posProvider` can be removed or folded into `vendorName`
2. Consider if `integrationName` should be repurposed or deprecated
3. Update application code to a single canonical vendor field
4. Plan zero-downtime migration of remaining integrations

For now: **Accept the duplication as the cost of backward compatibility.**

---

## References

- **C-PLAN.md:** Integration CRUD API contract (requires vendorName)
- **C-IMPLEMENTATION-REPORT.md:** Implementation status
- **schema.prisma:** Lines 4599-4626 (MerchantIntegration model)
- **Migration:** `20260904175121_mkt_int_001_c_fields`

---

## Verification

- [ ] CTO confirms this design choice
- [ ] No schema modifications required beyond current migration
- [ ] Both fields included in C API responses
- [ ] C API can create integrations with vendorName
- [ ] Existing A/B integrations remain queryable via both fields
