# DPX-P1-B8 — Class-A / Class-B Audit Action Matrix

**Status: RATIFICATION DOCUMENT FOR FOUNDER DECISION. Read-only — no code, trigger or caller
changes. B8 remains HOLD 🔴.**

Fourth in the series, after the inventory (`246bdc0`), decision matrix (`53117f0`) and policy
proposal (`2881d53`). Measured on `b8-sync` @ `002feaf`.

Classifies all **295 distinct audit actions** across **361 production call sites** so the
policy can be ratified against concrete actions rather than an abstract yes/no.

---

## Correction carried into this document

The policy proposal treated the 79 failure/security events as Class B candidates. That was too
coarse: **"failure" describes what triggered the event, not whether state changed.**
`SESSION_REVOKED` is a committed security-state mutation and belongs in Class A on the merits.

This matrix therefore classifies on the dimension that actually decides it — **does a business
mutation exist in the enclosing operation** — with the event's name as a secondary signal only.

---

## Method, and what it can and cannot establish

For each call site the enclosing method is scanned for a Prisma write
(`create`/`update`/`upsert`/`delete` and their `*Many` forms) occurring before the audit call.

- **Mutation = yes** — every call site for that action follows a write. A business mutation
  exists.
- **Mutation = no** — no call site follows a write. Nothing was committed in that method.
- **Mutation = mixed** — the sites disagree; the action is used in both shapes.

**This is static analysis and it has a real limit:** it detects writes *in the enclosing
method*, not writes performed by a collaborator the method calls. An action marked "no" may
still sit downstream of a mutation in a service it delegates to. Every "no" in the Class A and
ambiguous tables below should be confirmed by reading the method before ratification.

Significance markers (financial / legal-regulatory / security-state) are derived from the
action name. They are a **proposal for ratification, not a finding** — the boundary between
"financial consequence" and "operational record" is a business judgement.

---

## Summary

| Proposed class | Actions | Sites | Meaning |
| --- | --- | --- | --- |
| **A — Authoritative** | 62 | 67 | Committed mutation + financial, legal or security-state significance |
| **B — Observational** | 67 | 102 | No business mutation detected; nothing to be atomic with |
| **AMBIGUOUS** | 166 | 192 | Deliberately not forced — see the four sub-groups |
| **Total** | **295** | **361** | |

More than half sit in AMBIGUOUS. That is the honest result rather than a failure of the
analysis: for most actions the mutation is real but whether it carries financial or legal
weight is precisely the business call being asked for.

---

## Class A (proposed) — 62 actions, 67 sites

**Transaction requirement:** the audit write joins the business transaction via
`append(tx, event)`.
**Committed / rolled back:** the mutation is committed only if the audit is.
**Consequence if the audit write fails:** the business operation fails and rolls back. The
customer sees an error rather than an unrecorded change to money, entitlement or legal state.

**Rationale for the class:** an unrecorded change here is worse than a refused one.

| Audit action | Sites | Domain | Mutation | Significance |
| --- | --- | --- | --- | --- |
| `BOOKING_AUDIT_ACTIONS.SETTLED` | 1 | bookings | yes | financial |
| `COMMERCIAL_AUDIT_ACTIONS.COMMISSION_SETTING_UPDATED` | 1 | commercial | yes | financial |
| `COMMERCIAL_AUDIT_ACTIONS.CREDIT_LIMIT_NEGOTIATED` | 1 | commercial | yes | financial |
| `COMMERCIAL_AUDIT_ACTIONS.CREDIT_SETTING_UPDATED` | 1 | commercial | yes | financial |
| `DRIVER_AUDIT_ACTIONS.APPROVED` | 1 | drivers | yes | legal/regulatory |
| `DRIVER_AUDIT_ACTIONS.IDENTITY_VERIFICATION_FAILED` | 1 | drivers | yes | legal/regulatory |
| `DRIVER_AUDIT_ACTIONS.IDENTITY_VERIFICATION_LOCKED` | 1 | drivers | yes | legal/regulatory/security-state |
| `DRIVER_AUDIT_ACTIONS.IDENTITY_VERIFICATION_PASSED` | 2 | drivers | yes | legal/regulatory |
| `DRIVER_AUDIT_ACTIONS.IDENTITY_VERIFICATION_REQUESTED` | 1 | drivers | yes | legal/regulatory |
| `DRIVER_AUDIT_ACTIONS.IDENTITY_VERIFICATION_UNLOCKED` | 1 | drivers | yes | legal/regulatory/security-state |
| `DRIVER_AUDIT_ACTIONS.KYC_REJECTED` | 1 | drivers | yes | legal/regulatory |
| `DRIVER_AUDIT_ACTIONS.KYC_SUBMITTED` | 1 | drivers | yes | legal/regulatory |
| `DRIVER_AUDIT_ACTIONS.KYC_VERIFIED` | 1 | drivers | yes | legal/regulatory |
| `DRIVER_AUDIT_ACTIONS.REJECTED` | 1 | drivers | yes | legal/regulatory |
| `DRIVER_AUDIT_ACTIONS.SOS_ALERT_TRIGGERED` | 2 | drivers | yes | security-state |
| `DRIVER_AUDIT_ACTIONS.SOS_ALERT_UPDATED` | 1 | drivers | yes | security-state |
| `DRIVER_AUDIT_ACTIONS.SUSPENDED` | 1 | drivers | yes | legal/regulatory |
| `DRIVER_AUDIT_ACTIONS.VEHICLE_APPROVED` | 1 | drivers | yes | legal/regulatory |
| `DRIVER_AUDIT_ACTIONS.VEHICLE_REJECTED` | 1 | drivers | yes | legal/regulatory |
| `DRIVER_CAMPAIGN_AUDIT_ACTIONS.FRAUD_CHECK_REVIEWED` | 1 | referrals | yes | security-state |
| `DRIVER_CAMPAIGN_AUDIT_ACTIONS.REWARD_APPROVED` | 1 | referrals | yes | legal/regulatory |
| `DRIVER_CAMPAIGN_AUDIT_ACTIONS.REWARD_REJECTED` | 1 | referrals | yes | legal/regulatory |
| `FLEET_AUDIT_ACTIONS.APPLICATION_REJECTED` | 1 | fleets | yes | legal/regulatory |
| `FLEET_AUDIT_ACTIONS.APPROVED` | 1 | fleets | yes | legal/regulatory |
| `FLEET_AUDIT_ACTIONS.MEMBER_REQUEST_APPROVED` | 1 | fleets | yes | legal/regulatory |
| `FLEET_AUDIT_ACTIONS.MEMBER_REQUEST_REJECTED` | 1 | fleets | yes | legal/regulatory |
| `FLEET_AUDIT_ACTIONS.PERIOD_SETTLED` | 1 | fleets | yes | financial |
| `FLEET_AUDIT_ACTIONS.SUSPENDED` | 1 | fleets | yes | legal/regulatory |
| `FRAUD_AUDIT_ACTIONS.THRESHOLD_UPDATED` | 1 | fraud | yes | financial |
| `KYC_AUDIT_ACTIONS.CUSTOMER_KYC_REJECTED` | 1 | kyc | yes | legal/regulatory |
| `KYC_AUDIT_ACTIONS.CUSTOMER_KYC_RESUBMISSION_REQUESTED` | 1 | kyc | yes | legal/regulatory |
| `KYC_AUDIT_ACTIONS.CUSTOMER_KYC_STARTED` | 1 | kyc | yes | legal/regulatory |
| `KYC_AUDIT_ACTIONS.CUSTOMER_KYC_SUBMITTED` | 1 | kyc | yes | legal/regulatory |
| `KYC_AUDIT_ACTIONS.CUSTOMER_KYC_VERIFIED` | 1 | kyc | yes | legal/regulatory |
| `ORDER_AUDIT_ACTIONS.COMMISSION_SETTINGS_UPDATED` | 1 | orders | yes | financial |
| `ORDER_AUDIT_ACTIONS.PAYMENT_PROOF_SUBMITTED` | 1 | orders | yes | financial |
| `ORDER_AUDIT_ACTIONS.SETTLEMENT_COMPLETED` | 2 | orders | yes | financial |
| `ORDER_AUDIT_ACTIONS.SETTLEMENT_FAILED` | 1 | orders | yes | financial |
| `ORDER_AUDIT_ACTIONS.SETTLEMENT_REVERSED` | 2 | orders | yes | financial |
| `RIDER_AUDIT_ACTIONS.APPROVED` | 1 | riders | yes | legal/regulatory |
| `RIDER_AUDIT_ACTIONS.KYC_REJECTED` | 1 | riders | yes | legal/regulatory |
| `RIDER_AUDIT_ACTIONS.KYC_SUBMITTED` | 1 | riders | yes | legal/regulatory |
| `RIDER_AUDIT_ACTIONS.KYC_VERIFIED` | 1 | riders | yes | legal/regulatory |
| `RIDER_AUDIT_ACTIONS.REJECTED` | 1 | riders | yes | legal/regulatory |
| `RIDER_AUDIT_ACTIONS.SUSPENDED` | 1 | riders | yes | legal/regulatory |
| `RIDE_AUDIT_ACTIONS.FARE_RATE_UPDATED` | 1 | rides | yes | financial |
| `RIDE_AUDIT_ACTIONS.PAYMENT_FAILED` | 1 | rides | yes | financial |
| `RIDE_AUDIT_ACTIONS.PAYMENT_INITIATED` | 2 | rides | yes | financial |
| `RIDE_AUDIT_ACTIONS.PAYMENT_SUCCEEDED` | 1 | rides | yes | financial |
| `RIDE_AUDIT_ACTIONS.REFUNDED` | 1 | rides | yes | financial |
| `RIDE_AUDIT_ACTIONS.SURCHARGE_ZONE_CREATED` | 1 | rides | yes | financial |
| `RIDE_AUDIT_ACTIONS.SURCHARGE_ZONE_UPDATED` | 1 | rides | yes | financial |
| `SEARCH_AUDIT_ACTIONS.DOCUMENT_UPSERTED` | 1 | search | yes | legal/regulatory |
| `WALLET_AUDIT_ACTIONS.BANK_ACCOUNT_ADDED` | 1 | wallet | yes | security-state |
| `WALLET_AUDIT_ACTIONS.BANK_ACCOUNT_REMOVED` | 1 | wallet | yes | security-state |
| `WALLET_AUDIT_ACTIONS.FUNDING_FAILED` | 1 | wallet | yes | financial |
| `WALLET_AUDIT_ACTIONS.FUNDING_INITIATED` | 1 | wallet | yes | financial |
| `WALLET_AUDIT_ACTIONS.FUNDING_SUCCEEDED` | 1 | wallet | yes | financial |
| `WALLET_AUDIT_ACTIONS.WITHDRAWAL_COMPLETED` | 1 | wallet | yes | financial |
| `WALLET_AUDIT_ACTIONS.WITHDRAWAL_FAILED` | 1 | wallet | yes | financial |
| `WALLET_AUDIT_ACTIONS.WITHDRAWAL_REQUESTED` | 1 | wallet | yes | financial |
| `integration.credential_revoked` | 1 | integrations | yes | security-state |

---

## Class B (proposed) — 67 actions, 102 sites

**Transaction requirement:** none. The write must **not** be bound to a transaction that may
roll back — for a rejected operation the audit is the only record, and rolling it back with the
failed mutation would erase the evidence.
**Committed / rolled back:** independent of any business transaction.
**Consequence if the audit write fails:** the operation proceeds. The failure to write is
itself an incident and **must alert** — the guarantee here is durability and observability, not
atomicity.

**Rationale for the class:** no business mutation exists to be atomic with. Forcing these
through `append(tx, …)` would create transactions that guarantee nothing.

| Audit action | Sites | Domain | Mutation | Significance |
| --- | --- | --- | --- | --- |
| `ADDRESS_AUDIT_ACTIONS.CREATED` | 1 | addresses | no | — |
| `ADDRESS_AUDIT_ACTIONS.DEFAULT_CHANGED` | 2 | addresses | no | — |
| `ADDRESS_AUDIT_ACTIONS.DELETED` | 1 | addresses | no | — |
| `ADDRESS_AUDIT_ACTIONS.UPDATED` | 1 | addresses | no | — |
| `AUTH_AUDIT_ACTIONS.EMAIL_SENT` | 1 | auth | no | — |
| `AUTH_AUDIT_ACTIONS.EMAIL_VERIFICATION_FAILED` | 6 | auth | no | — |
| `AUTH_AUDIT_ACTIONS.GOOGLE_ACCOUNT_CREATED` | 1 | auth | no | — |
| `AUTH_AUDIT_ACTIONS.GOOGLE_ACCOUNT_LINKED` | 1 | auth | no | — |
| `AUTH_AUDIT_ACTIONS.GOOGLE_LOGIN_FAILED` | 1 | auth | no | — |
| `AUTH_AUDIT_ACTIONS.GOOGLE_LOGIN_STARTED` | 1 | auth | no | — |
| `AUTH_AUDIT_ACTIONS.GOOGLE_LOGIN_SUCCESS` | 1 | auth | no | — |
| `AUTH_AUDIT_ACTIONS.LOGIN_FAILED` | 1 | auth | no | — |
| `AUTH_AUDIT_ACTIONS.LOGIN_STARTED` | 1 | auth | no | — |
| `AUTH_AUDIT_ACTIONS.LOGIN_SUCCESS` | 1 | auth | no | — |
| `AUTH_AUDIT_ACTIONS.LOGOUT` | 1 | auth | no | — |
| `AUTH_AUDIT_ACTIONS.LOGOUT_ALL` | 1 | auth | no | — |
| `AUTH_AUDIT_ACTIONS.OTP_FAILED` | 2 | auth | no | — |
| `AUTH_AUDIT_ACTIONS.OTP_SENT` | 1 | auth | no | — |
| `AUTH_AUDIT_ACTIONS.PASSWORD_CHANGE_FAILED` | 3 | auth | no | security-state |
| `AUTH_AUDIT_ACTIONS.PASSWORD_RESET_FAILED` | 1 | auth | no | security-state |
| `AUTH_AUDIT_ACTIONS.PHONE_OTP_SENT` | 1 | auth | no | — |
| `AUTH_AUDIT_ACTIONS.PHONE_VERIFICATION_FAILED` | 6 | auth | no | — |
| `AUTH_AUDIT_ACTIONS.PROFILE_EMAIL_CHANGE_REQUESTED` | 1 | auth | no | — |
| `AUTH_AUDIT_ACTIONS.PROFILE_PHONE_CHANGE_REQUESTED` | 1 | auth | no | — |
| `AUTH_AUDIT_ACTIONS.PROFILE_UPDATED` | 1 | auth | no | — |
| `AUTH_AUDIT_ACTIONS.REFRESH_FAILED` | 7 | auth | no | — |
| `AUTH_AUDIT_ACTIONS.REFRESH_REUSED` | 1 | auth | no | — |
| `AUTH_AUDIT_ACTIONS.REFRESH_STARTED` | 1 | auth | no | — |
| `AUTH_AUDIT_ACTIONS.REFRESH_SUCCESS` | 1 | auth | no | — |
| `AUTH_AUDIT_ACTIONS.REGISTRATION_COMPLETED` | 2 | auth | no | — |
| `AUTH_AUDIT_ACTIONS.VERIFICATION_EXPIRED` | 2 | auth | no | — |
| `CART_AUDIT_ACTIONS.CLEARED` | 1 | cart | no | — |
| `CART_AUDIT_ACTIONS.CREATED` | 1 | cart | no | — |
| `CART_AUDIT_ACTIONS.ITEM_ADDED` | 1 | cart | no | — |
| `CART_AUDIT_ACTIONS.ITEM_REMOVED` | 1 | cart | no | — |
| `CART_AUDIT_ACTIONS.ITEM_UPDATED` | 2 | cart | no | — |
| `CART_AUDIT_ACTIONS.RECALCULATED` | 1 | cart | no | — |
| `DELIVERY_AUDIT_ACTIONS.LOCATION_UPDATED` | 1 | delivery | no | — |
| `MERCHANT_AUDIT_ACTIONS.BUSINESS_CREATED` | 1 | merchants | no | — |
| `MERCHANT_AUDIT_ACTIONS.BUSINESS_UPDATED` | 3 | merchants | no | — |
| `MERCHANT_AUDIT_ACTIONS.REACTIVATED` | 1 | merchants | no | — |
| `MERCHANT_AUDIT_ACTIONS.STORE_PAUSED` | 1 | merchants | no | — |
| `MERCHANT_AUDIT_ACTIONS.STORE_RESUMED` | 1 | merchants | no | — |
| `NOTIFICATION_CENTER_AUDIT_ACTIONS.BROADCAST` | 1 | notification-center | no | — |
| `NOTIFICATION_CENTER_AUDIT_ACTIONS.PREFERENCES_UPDATED` | 1 | notification-center | no | — |
| `NOTIFICATION_CENTER_AUDIT_ACTIONS.RESENT` | 1 | notification-center | no | — |
| `NOTIFICATION_CENTER_AUDIT_ACTIONS.TEMPLATE_CREATED` | 1 | notification-center | no | — |
| `NOTIFICATION_CENTER_AUDIT_ACTIONS.TEMPLATE_DELETED` | 1 | notification-center | no | — |
| `NOTIFICATION_CENTER_AUDIT_ACTIONS.TEMPLATE_UPDATED` | 1 | notification-center | no | — |
| `ORDER_AUDIT_ACTIONS.ACCEPTED` | 1 | orders | no | — |
| `ORDER_AUDIT_ACTIONS.CANCELLED` | 2 | orders | no | — |
| `ORDER_AUDIT_ACTIONS.CREATED` | 1 | orders | no | — |
| `ORDER_AUDIT_ACTIONS.DELAYED` | 1 | orders | no | — |
| `ORDER_AUDIT_ACTIONS.DISPUTE_RAISED` | 1 | orders | no | — |
| `ORDER_AUDIT_ACTIONS.DISPUTE_RESOLVED` | 1 | orders | no | — |
| `ORDER_AUDIT_ACTIONS.INVENTORY_RELEASED` | 1 | orders | no | — |
| `ORDER_AUDIT_ACTIONS.INVENTORY_RESERVED` | 1 | orders | no | — |
| `ORDER_AUDIT_ACTIONS.READY` | 1 | orders | no | — |
| `PAYMENT_AUDIT_ACTIONS.FAILED` | 3 | payments | no | — |
| `PAYMENT_AUDIT_ACTIONS.INITIALIZED` | 4 | payments | no | — |
| `PAYMENT_AUDIT_ACTIONS.INVENTORY_DEDUCTED` | 1 | payments | no | — |
| `PAYMENT_AUDIT_ACTIONS.WEBHOOK_RECEIVED` | 1 | payments | no | — |
| `RIDE_AUDIT_ACTIONS.CASH_CONFIRMED` | 1 | rides | no | — |
| `UTILITIES_AUDIT_ACTIONS.PURCHASE_INITIATED` | 2 | utilities | no | — |
| `WALLET_AUDIT_ACTIONS.RECONCILED` | 1 | wallet | no | — |
| `WISHLIST_AUDIT_ACTIONS.MOVED_TO_CART` | 1 | wishlist | no | — |
| `integration.test` | 4 | integrations | no | — |

---

## Ambiguous — 166 actions, 192 sites

Flagged rather than forced, in four groups with different resolution paths.


### AMB-1 — 1 actions, 14 sites
*call sites disagree: some follow a DB write, some do not*

**Resolution path: read the call sites.** The action is used in two shapes and may need
splitting into two actions, or one site corrected.

| Audit action | Sites | Domain | Mutation | Significance |
| --- | --- | --- | --- | --- |
| `<unresolved>` | 14 | auth,bookings,commercial,delivery,drivers,fleets,fraud,rides,wallet | mixed | — |

### AMB-2 — 12 actions, 13 sites
*no mutation detected yet carries legal/regulatory significance — needs inspection*

**Resolution path: engineering confirmation first.** The name carries significance but no
mutation was detected in the enclosing method. Either the mutation happens in a collaborator —
in which case this is Class A — or the event genuinely records a refusal, in which case it is
Class B. Read the method before ratifying.

| Audit action | Sites | Domain | Mutation | Significance |
| --- | --- | --- | --- | --- |
| `AUTH_AUDIT_ACTIONS.EMAIL_VERIFIED` | 1 | auth | no | legal/regulatory |
| `AUTH_AUDIT_ACTIONS.OTP_VERIFIED` | 1 | auth | no | legal/regulatory |
| `AUTH_AUDIT_ACTIONS.PHONE_VERIFIED` | 1 | auth | no | legal/regulatory |
| `MERCHANT_AUDIT_ACTIONS.APPROVED` | 1 | merchants | no | legal/regulatory |
| `MERCHANT_AUDIT_ACTIONS.KYC_REJECTED` | 1 | merchants | no | legal/regulatory |
| `MERCHANT_AUDIT_ACTIONS.KYC_SUBMITTED` | 1 | merchants | no | legal/regulatory |
| `MERCHANT_AUDIT_ACTIONS.KYC_VERIFIED` | 1 | merchants | no | legal/regulatory |
| `MERCHANT_AUDIT_ACTIONS.REJECTED` | 1 | merchants | no | legal/regulatory |
| `MERCHANT_AUDIT_ACTIONS.SUSPENDED` | 1 | merchants | no | legal/regulatory |
| `ORDER_AUDIT_ACTIONS.REJECTED` | 1 | orders | no | legal/regulatory |
| `PAYMENT_AUDIT_ACTIONS.VERIFIED` | 2 | payments | no | legal/regulatory |
| `PAYMENT_AUDIT_ACTIONS.WEBHOOK_REJECTED` | 1 | payments | no | legal/regulatory |

### AMB-3 — 12 actions, 15 sites
*no mutation detected yet carries security-state significance — needs inspection*

**Resolution path: engineering confirmation first.** The name carries significance but no
mutation was detected in the enclosing method. Either the mutation happens in a collaborator —
in which case this is Class A — or the event genuinely records a refusal, in which case it is
Class B. Read the method before ratifying.

| Audit action | Sites | Domain | Mutation | Significance |
| --- | --- | --- | --- | --- |
| `AUTH_AUDIT_ACTIONS.PASSWORD_CHANGED` | 1 | auth | no | security-state |
| `AUTH_AUDIT_ACTIONS.PASSWORD_FORGOT` | 1 | auth | no | security-state |
| `AUTH_AUDIT_ACTIONS.PASSWORD_RESET_STARTED` | 1 | auth | no | security-state |
| `AUTH_AUDIT_ACTIONS.PASSWORD_RESET_SUCCESS` | 1 | auth | no | security-state |
| `AUTH_AUDIT_ACTIONS.SESSIONS_REVOKED_ALL` | 1 | auth | no | security-state |
| `AUTH_AUDIT_ACTIONS.SESSIONS_REVOKED_PASSWORD` | 2 | auth | no | security-state |
| `AUTH_AUDIT_ACTIONS.SESSION_ACTIVITY` | 1 | auth | no | security-state |
| `AUTH_AUDIT_ACTIONS.SESSION_CREATED` | 1 | auth | no | security-state |
| `AUTH_AUDIT_ACTIONS.SESSION_LIST` | 1 | auth | no | security-state |
| `AUTH_AUDIT_ACTIONS.SESSION_REVOKED` | 3 | auth | no | security-state |
| `MERCHANT_AUDIT_ACTIONS.BANK_CREATED` | 1 | merchants | no | security-state |
| `MERCHANT_AUDIT_ACTIONS.BANK_UPDATED` | 1 | merchants | no | security-state |

### AMB-4 — 137 actions, 146 sites
*committed mutation, but no financial/legal/security marker — significance is a business call*

**Resolution path: business judgement.** The mutation is real and committed; the question is
whether the record carries enough weight that losing it should have cost the operation. This is
the largest group and the substance of the ratification.

| Audit action | Sites | Domain | Mutation | Significance |
| --- | --- | --- | --- | --- |
| `BOOKING_AUDIT_ACTIONS.ACCEPTED` | 1 | bookings | yes | — |
| `BOOKING_AUDIT_ACTIONS.AVAILABILITY_SET` | 1 | bookings | yes | — |
| `BOOKING_AUDIT_ACTIONS.CREATED` | 1 | bookings | yes | — |
| `BOOKING_AUDIT_ACTIONS.PAID` | 1 | bookings | yes | — |
| `BOOKING_AUDIT_ACTIONS.ROOM_TYPE_CREATED` | 1 | bookings | yes | — |
| `BOOKING_AUDIT_ACTIONS.ROOM_TYPE_UPDATED` | 1 | bookings | yes | — |
| `CMS_AUDIT_ACTIONS.CONTENT_ARCHIVED` | 1 | cms | yes | — |
| `CMS_AUDIT_ACTIONS.CONTENT_CREATED` | 1 | cms | yes | — |
| `CMS_AUDIT_ACTIONS.CONTENT_DELETED` | 1 | cms | yes | — |
| `CMS_AUDIT_ACTIONS.CONTENT_PUBLISHED` | 1 | cms | yes | — |
| `CMS_AUDIT_ACTIONS.CONTENT_SCHEDULED` | 1 | cms | yes | — |
| `CMS_AUDIT_ACTIONS.CONTENT_UPDATED` | 1 | cms | yes | — |
| `DRIVER_AUDIT_ACTIONS.AGREEMENT_ACCEPTED` | 1 | drivers | yes | — |
| `DRIVER_AUDIT_ACTIONS.EMERGENCY_CONTACT_UPDATED` | 1 | drivers | yes | — |
| `DRIVER_AUDIT_ACTIONS.INCIDENT_REPORT_SUBMITTED` | 1 | drivers | yes | — |
| `DRIVER_AUDIT_ACTIONS.INCIDENT_REPORT_UPDATED` | 1 | drivers | yes | — |
| `DRIVER_AUDIT_ACTIONS.INSPECTION_CANCELLED` | 1 | drivers | yes | — |
| `DRIVER_AUDIT_ACTIONS.INSPECTION_CENTRE_CREATED` | 1 | drivers | yes | — |
| `DRIVER_AUDIT_ACTIONS.INSPECTION_CENTRE_UPDATED` | 1 | drivers | yes | — |
| `DRIVER_AUDIT_ACTIONS.INSPECTION_CHECKLIST_RECORDED` | 1 | drivers | yes | — |
| `DRIVER_AUDIT_ACTIONS.INSPECTION_SCHEDULED` | 1 | drivers | yes | — |
| `DRIVER_AUDIT_ACTIONS.ONBOARDING_SUBMITTED` | 1 | drivers | yes | — |
| `DRIVER_AUDIT_ACTIONS.PLANNED_AVAILABILITY_DELETED` | 1 | drivers | yes | — |
| `DRIVER_AUDIT_ACTIONS.PLANNED_AVAILABILITY_SET` | 1 | drivers | yes | — |
| `DRIVER_AUDIT_ACTIONS.PROFILE_UPDATED` | 1 | drivers | yes | — |
| `DRIVER_AUDIT_ACTIONS.REACTIVATED` | 1 | drivers | yes | — |
| `DRIVER_AUDIT_ACTIONS.SECURITY_SETTINGS_UPDATED` | 1 | drivers | yes | — |
| `DRIVER_AUDIT_ACTIONS.SHIFT_BREAK_ENDED` | 1 | drivers | yes | — |
| `DRIVER_AUDIT_ACTIONS.SHIFT_BREAK_STARTED` | 1 | drivers | yes | — |
| `DRIVER_AUDIT_ACTIONS.SHIFT_ENDED` | 1 | drivers | yes | — |
| `DRIVER_AUDIT_ACTIONS.SHIFT_FORCE_ENDED` | 1 | drivers | yes | — |
| `DRIVER_AUDIT_ACTIONS.SHIFT_STARTED` | 1 | drivers | yes | — |
| `DRIVER_AUDIT_ACTIONS.SUPPORT_TICKET_SUBMITTED` | 1 | drivers | yes | — |
| `DRIVER_AUDIT_ACTIONS.SUPPORT_TICKET_UPDATED` | 1 | drivers | yes | — |
| `DRIVER_AUDIT_ACTIONS.VEHICLE_SUBMITTED` | 2 | drivers | yes | — |
| `DRIVER_CAMPAIGN_AUDIT_ACTIONS.CAMPAIGN_CREATED` | 1 | referrals | yes | — |
| `DRIVER_CAMPAIGN_AUDIT_ACTIONS.CAMPAIGN_PAUSED` | 1 | referrals | yes | — |
| `DRIVER_CAMPAIGN_AUDIT_ACTIONS.CAMPAIGN_RESUMED` | 1 | referrals | yes | — |
| `DRIVER_CAMPAIGN_AUDIT_ACTIONS.CAMPAIGN_UPDATED` | 1 | referrals | yes | — |
| `DRIVER_CAMPAIGN_AUDIT_ACTIONS.CODE_GENERATED` | 1 | referrals | yes | — |
| `DRIVER_CAMPAIGN_AUDIT_ACTIONS.PASSENGER_QUALIFIED` | 1 | referrals | yes | — |
| `DRIVER_CAMPAIGN_AUDIT_ACTIONS.PASSENGER_REGISTERED` | 1 | referrals | yes | — |
| `DRIVER_CAMPAIGN_AUDIT_ACTIONS.REWARD_PAID` | 1 | referrals | yes | — |
| `FLEET_AUDIT_ACTIONS.MEMBER_ADDED` | 1 | fleets | yes | — |
| `FLEET_AUDIT_ACTIONS.MEMBER_DEACTIVATED` | 1 | fleets | yes | — |
| `FLEET_AUDIT_ACTIONS.MEMBER_REACTIVATED` | 1 | fleets | yes | — |
| `FLEET_AUDIT_ACTIONS.MEMBER_REMOVED` | 1 | fleets | yes | — |
| `FLEET_AUDIT_ACTIONS.MEMBER_REQUESTED` | 1 | fleets | yes | — |
| `FLEET_AUDIT_ACTIONS.RATE_NEGOTIATED` | 1 | fleets | yes | — |
| `FLEET_AUDIT_ACTIONS.REINSTATED` | 1 | fleets | yes | — |
| `FLEET_AUDIT_ACTIONS.TIERS_UPDATED` | 1 | fleets | yes | — |
| `FRAUD_AUDIT_ACTIONS.LIST_ENTRY_CREATED` | 1 | fraud | yes | — |
| `FRAUD_AUDIT_ACTIONS.LIST_ENTRY_DELETED` | 1 | fraud | yes | — |
| `FRAUD_AUDIT_ACTIONS.LIST_ENTRY_UPDATED` | 1 | fraud | yes | — |
| `FRAUD_AUDIT_ACTIONS.SIGNAL_REVIEWED` | 1 | fraud | yes | — |
| `LOYALTY_AUDIT_ACTIONS.ACHIEVEMENT_CREATED` | 1 | loyalty | yes | — |
| `LOYALTY_AUDIT_ACTIONS.ACHIEVEMENT_DELETED` | 1 | loyalty | yes | — |
| `LOYALTY_AUDIT_ACTIONS.ACHIEVEMENT_UPDATED` | 1 | loyalty | yes | — |
| `LOYALTY_AUDIT_ACTIONS.POINTS_AWARDED` | 1 | loyalty | yes | — |
| `LOYALTY_AUDIT_ACTIONS.POINTS_EXPIRED` | 1 | loyalty | yes | — |
| `LOYALTY_AUDIT_ACTIONS.POINTS_REDEEMED` | 1 | loyalty | yes | — |
| `MESSAGING_AUDIT_ACTIONS.SENT` | 1 | messaging | yes | — |
| `NOTIFICATION_CENTER_AUDIT_ACTIONS.CREATED` | 2 | notification-center | yes | — |
| `NOTIFICATION_CENTER_AUDIT_ACTIONS.DEAD_LETTERED` | 2 | notification-center | yes | — |
| `NOTIFICATION_CENTER_AUDIT_ACTIONS.DELETED` | 1 | notification-center | yes | — |
| `NOTIFICATION_CENTER_AUDIT_ACTIONS.READ` | 1 | notification-center | yes | — |
| `NOTIFICATION_CENTER_AUDIT_ACTIONS.READ_ALL` | 1 | notification-center | yes | — |
| `NOTIFICATION_CENTER_AUDIT_ACTIONS.SENT` | 1 | notification-center | yes | — |
| `OPERATIONS_AUDIT_ACTIONS.CASE_ASSIGNED` | 1 | operations | yes | — |
| `OPERATIONS_AUDIT_ACTIONS.CASE_NOTE_ADDED` | 1 | operations | yes | — |
| `OPERATIONS_AUDIT_ACTIONS.CASE_PRIORITY_CHANGED` | 1 | operations | yes | — |
| `OPERATIONS_AUDIT_ACTIONS.CASE_STATUS_CHANGED` | 1 | operations | yes | — |
| `PRODUCT_AUDIT_ACTIONS.CREATED` | 1 | products | yes | — |
| `PRODUCT_AUDIT_ACTIONS.DELETED` | 1 | products | yes | — |
| `PRODUCT_AUDIT_ACTIONS.IMAGES_REORDERED` | 1 | products | yes | — |
| `PRODUCT_AUDIT_ACTIONS.IMAGE_ADDED` | 1 | products | yes | — |
| `PRODUCT_AUDIT_ACTIONS.IMAGE_REMOVED` | 1 | products | yes | — |
| `PRODUCT_AUDIT_ACTIONS.INVENTORY_UPDATED` | 2 | products | yes | — |
| `PRODUCT_AUDIT_ACTIONS.PUBLISHED` | 1 | products | yes | — |
| `PRODUCT_AUDIT_ACTIONS.UNPUBLISHED` | 1 | products | yes | — |
| `PRODUCT_AUDIT_ACTIONS.UPDATED` | 1 | products | yes | — |
| `PRODUCT_AUDIT_ACTIONS.VARIANT_CREATED` | 1 | products | yes | — |
| `PRODUCT_AUDIT_ACTIONS.VARIANT_REMOVED` | 1 | products | yes | — |
| `PRODUCT_AUDIT_ACTIONS.VARIANT_UPDATED` | 1 | products | yes | — |
| `PROMOTION_AUDIT_ACTIONS.ARCHIVED` | 1 | promotions | yes | — |
| `PROMOTION_AUDIT_ACTIONS.CLONED` | 1 | promotions | yes | — |
| `PROMOTION_AUDIT_ACTIONS.CREATED` | 1 | promotions | yes | — |
| `PROMOTION_AUDIT_ACTIONS.DELETED` | 1 | promotions | yes | — |
| `PROMOTION_AUDIT_ACTIONS.FORCE_EXPIRED` | 1 | promotions | yes | — |
| `PROMOTION_AUDIT_ACTIONS.PAUSED` | 1 | promotions | yes | — |
| `PROMOTION_AUDIT_ACTIONS.REDEEMED` | 2 | promotions | yes | — |
| `PROMOTION_AUDIT_ACTIONS.RESUMED` | 1 | promotions | yes | — |
| `PROMOTION_AUDIT_ACTIONS.UPDATED` | 1 | promotions | yes | — |
| `REFERRAL_AUDIT_ACTIONS.CODE_GENERATED` | 1 | referrals | yes | — |
| `REFERRAL_AUDIT_ACTIONS.REDEEMED` | 1 | referrals | yes | — |
| `REFERRAL_AUDIT_ACTIONS.REWARDED` | 1 | referrals | yes | — |
| `REVIEW_AUDIT_ACTIONS.CREATED` | 1 | reviews | yes | — |
| `REVIEW_AUDIT_ACTIONS.DELETED` | 1 | reviews | yes | — |
| `REVIEW_AUDIT_ACTIONS.HELPFUL_VOTED` | 1 | reviews | yes | — |
| `REVIEW_AUDIT_ACTIONS.MERCHANT_REPLIED` | 1 | reviews | yes | — |
| `REVIEW_AUDIT_ACTIONS.MODERATED` | 1 | reviews | yes | — |
| `REVIEW_AUDIT_ACTIONS.REPORTED` | 1 | reviews | yes | — |
| `REVIEW_AUDIT_ACTIONS.UPDATED` | 1 | reviews | yes | — |
| `RIDER_AUDIT_ACTIONS.PROFILE_UPDATED` | 1 | riders | yes | — |
| `RIDER_AUDIT_ACTIONS.REACTIVATED` | 1 | riders | yes | — |
| `RIDE_AUDIT_ACTIONS.CANCELLED` | 3 | rides | yes | — |
| `RIDE_AUDIT_ACTIONS.NO_DRIVERS_FOUND` | 1 | rides | yes | — |
| `RIDE_AUDIT_ACTIONS.OFFERED` | 1 | rides | yes | — |
| `RIDE_AUDIT_ACTIONS.OFFER_ACCEPTED` | 1 | rides | yes | — |
| `RIDE_AUDIT_ACTIONS.OFFER_DECLINED` | 1 | rides | yes | — |
| `RIDE_AUDIT_ACTIONS.OFFER_EXPIRED` | 1 | rides | yes | — |
| `RIDE_AUDIT_ACTIONS.PROBLEM_REPORTED` | 1 | rides | yes | — |
| `RIDE_AUDIT_ACTIONS.PROBLEM_RESOLVED` | 1 | rides | yes | — |
| `RIDE_AUDIT_ACTIONS.RATED` | 1 | rides | yes | — |
| `RIDE_AUDIT_ACTIONS.REQUESTED` | 1 | rides | yes | — |
| `RIDE_AUDIT_ACTIONS.TIP_ADDED` | 1 | rides | yes | — |
| `SEARCH_AUDIT_ACTIONS.QUERY` | 1 | search | yes | — |
| `USER_AUDIT_ACTIONS.ACCOUNT_DELETED` | 1 | users | yes | — |
| `UTILITIES_AUDIT_ACTIONS.PURCHASE_FAILED` | 1 | utilities | yes | — |
| `UTILITIES_AUDIT_ACTIONS.PURCHASE_RESOLVED` | 1 | utilities | yes | — |
| `UTILITIES_AUDIT_ACTIONS.PURCHASE_REVERSED` | 1 | utilities | yes | — |
| `UTILITIES_AUDIT_ACTIONS.PURCHASE_SUCCEEDED` | 1 | utilities | yes | — |
| `WALLET_AUDIT_ACTIONS.LIMITS_UPDATED` | 1 | wallet | yes | — |
| `WALLET_AUDIT_ACTIONS.PIN_CHANGED` | 1 | wallet | yes | — |
| `WALLET_AUDIT_ACTIONS.PIN_SET` | 1 | wallet | yes | — |
| `WISHLIST_AUDIT_ACTIONS.CREATED` | 1 | wishlist | yes | — |
| `WISHLIST_AUDIT_ACTIONS.DELETED` | 1 | wishlist | yes | — |
| `WISHLIST_AUDIT_ACTIONS.ITEM_ADDED` | 1 | wishlist | yes | — |
| `WISHLIST_AUDIT_ACTIONS.ITEM_REMOVED` | 1 | wishlist | yes | — |
| `WISHLIST_AUDIT_ACTIONS.ITEM_UPDATED` | 1 | wishlist | yes | — |
| `WISHLIST_AUDIT_ACTIONS.SHARED` | 1 | wishlist | yes | — |
| `WISHLIST_AUDIT_ACTIONS.UPDATED` | 1 | wishlist | yes | — |
| `integration.created` | 2 | integrations | yes | — |
| `integration.credential_created` | 1 | integrations | yes | — |
| `integration.deleted` | 1 | integrations | yes | — |
| `integration.disconnected` | 1 | integrations | yes | — |
| `integration.updated` | 2 | integrations | yes | — |

### AMB-5 — 4 actions, 4 sites
*no mutation detected yet carries financial significance — needs inspection*

**Resolution path: engineering confirmation first.** The name carries significance but no
mutation was detected in the enclosing method. Either the mutation happens in a collaborator —
in which case this is Class A — or the event genuinely records a refusal, in which case it is
Class B. Read the method before ratifying.

| Audit action | Sites | Domain | Mutation | Significance |
| --- | --- | --- | --- | --- |
| `COMMERCIAL_AUDIT_ACTIONS.PAYMENT_RECORDED` | 1 | commercial | no | financial |
| `ORDER_AUDIT_ACTIONS.PAYMENT_CONFIRMED` | 1 | orders | no | financial |
| `PAYMENT_AUDIT_ACTIONS.REFUNDED` | 1 | payments | no | financial |
| `WALLET_AUDIT_ACTIONS.TRANSFERRED` | 1 | wallet | no | financial |

---

## What ratification requires

1. **Confirm or move each Class A action.** These acquire the strongest guarantee and the
   highest cost.
2. **Resolve AMB-1 (137 actions)** — the business-weight question. This is the bulk of the
   decision.
3. **Have engineering confirm AMB-2/3/4 (29 actions)** before they are classified, since the
   static analysis cannot see writes made by collaborators.
4. **Split or correct the one mixed action.**

Only after that can the operation programme be scoped, because the programme covers the
Class A set — not all 299 audited operations.

**Nothing in this document has been applied.** No trigger change, no caller migration, no
production change of any kind.
