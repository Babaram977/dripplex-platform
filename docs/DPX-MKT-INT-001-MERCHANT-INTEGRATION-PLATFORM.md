# DPX-MKT-INT-001 — DrippleX Merchant Integration Platform

**Status:** Architectural Design (Pre-Implementation)  
**Timeline:** Post-Ride Launch, during Marketplace Activation  
**Ownership:** Platform Architecture  
**Last Updated:** 2026-09-04

---

## Vision

DrippleX should not force merchants to manually re-enter orders from our platform into their existing POS/order-management systems. Instead, merchants' existing systems should communicate directly with DrippleX via a standardized, generic **Merchant Integration API**.

This platform enables:

- **Orders → POS**: DrippleX orders automatically flow to the merchant's POS without manual re-entry
- **POS → DrippleX**: Order status, inventory, pricing, and fulfillment changes flow back in real time
- **Catalog Sync**: Merchant POS becomes the source of truth for product availability, pricing, and inventory—DrippleX reflects those changes automatically
- **Ecosystem Integration**: Eventually extends to ERP, accounting, inventory management, and other merchant systems

### Design Principle

**One Integration API for all merchant types.**

Not a "restaurant POS integration" or "supermarket inventory sync"—a generic **Merchant Integration API** that works for:

- Restaurants (with kitchen POS)
- Supermarkets (with inventory management)
- Pharmacies (with stock control)
- Fashion/Electronics (with catalog management)
- Hotels, offices, any merchant with a mini store

This aligns with DrippleX's foundational decision: **everything is a merchant mini store**, not a food-delivery platform with restaurants at the center.

---

## Architecture Overview

```
                    MERCHANT'S WORLD
                    ┌──────────────┐
                    │ POS System   │
                    │ ERP          │
                    │ Inventory    │
                    │ Accounting   │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ Merchant API │
                    │ Client/SDK   │
                    └──────┬───────┘
                           │ (HTTPS + OAuth2/API Key)
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐        ┌────▼────┐       ┌────▼────┐
   │ Orders  │        │ Catalog │       │Inventory│
   │ API     │        │ API     │       │ API     │
   └────┬────┘        └────┬────┘       └────┬────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
            ┌──────────────▼──────────────┐
            │ DrippleX Integration Layer  │
            │ (Webhooks, State, Idempot) │
            └──────────────┬──────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼──────┐      ┌────▼────┐       ┌────▼───────┐
   │ Orders    │      │ Product │       │ Inventory  │
   │ Service   │      │ Catalog │       │ Tracking   │
   └────┬──────┘      └────┬────┘       └────┬───────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
            ┌──────────────▼──────────────┐
            │    Mini Store & Customer    │
            │        Experience           │
            └─────────────────────────────┘
```

**Key Bridge:** Stable SKU/Product ID (from Catalog PR #44)

- Merchant's POS references products by SKU
- DrippleX Integration Layer maps SKU → DrippleX Product ID
- Customer sees real-time availability, pricing from merchant's POS

---

## Phase-by-Phase Implementation

### Phase 1: Internal DrippleX Integration API

**Goal:** Build the backbone that accepts merchant system data.

**Endpoints:**

```
POST   /api/v1/integrations/orders
       Accept an order from a POS system

POST   /api/v1/integrations/orders/:id/status
       Update order status (RECEIVED → ACCEPTED → PREPARING → READY → PICKED_UP → DELIVERED)

POST   /api/v1/integrations/catalog/products
       Sync product catalog (create/update products)

PATCH  /api/v1/integrations/catalog/products/:sku
       Update single product (price, availability)

POST   /api/v1/integrations/inventory/sync
       Bulk inventory sync

POST   /api/v1/integrations/inventory/adjust
       Adjust stock for a product (e.g., customer purchased, stock arrived)
```

**Webhook Events** (that DrippleX publishes):

```
order.created
  Fired when a customer places a DrippleX order
  Payload: { order_id, merchant_id, items[], total, delivery_address, payment_status }

order.accepted
  Fired when driver accepts delivery

order.preparing
  (Optional: fired when merchant marks order as being prepared)

order.ready
  Fired when merchant marks order ready for pickup

order.cancelled
  Fired when order is cancelled

product.updated
  Fired when product details change in DrippleX (admin update)

inventory.low_stock
  Fired when inventory falls below merchant-configured threshold
```

---

### Phase 2: Merchant Integration Credentials & OAuth2

**Goal:** Secure, scoped access for each merchant/POS integration.

**Each merchant integration receives:**

```
Client ID:        dpx_merchant_<merchant_id>_<random>
Client Secret:    (JWT signing key or OAuth2 secret)
API Key:          (Alternative: simple API key for POS systems that don't support OAuth2)
Webhook Secret:   (HMAC signing key for webhook payload verification)
```

**Scopes** (similar to GitHub OAuth):

```
integrations:orders:read        — Read order data
integrations:orders:write       — Update order status
integrations:catalog:read       — Read product catalog
integrations:catalog:write      — Update product catalog
integrations:inventory:read     — Read inventory
integrations:inventory:write    — Update inventory
integrations:webhooks:admin     — Configure webhook endpoints
```

**Example OAuth2 Flow:**

1. Merchant visits: `https://dripplex.com/integrations/authorize?client_id=dpx_merchant_xxx&redirect_uri=https://pos-system.local/callback&scope=integrations:orders:write+integrations:catalog:read`
2. Merchant logs in, approves scopes
3. DrippleX redirects: `https://pos-system.local/callback?code=authcode_xxx&state=xyz`
4. POS system exchanges code for access token (JWT or opaque token)
5. POS system makes API calls with `Authorization: Bearer <token>`

**For simpler POS systems:**

Support API Key authentication:

```
Authorization: ApiKey dpx_api_<merchant_id>_<random>
X-Webhook-Secret: <signing_key>
```

---

### Phase 3: Merchant Portal Integration Dashboard

**Location:** Merchant Portal → Settings → Integrations

**Screens:**

#### 3.1 Integrations Overview

```
┌─────────────────────────────────────────┐
│ My Integrations                         │
├─────────────────────────────────────────┤
│ POS Integration                         │
│ ● Connected                             │
│                                         │
│ POS Provider: Square POS                │
│ Last Sync: 09:42 AM (2 min ago)        │
│ Status:                                 │
│   ✓ Products: 1,248 synced              │
│   ✓ Inventory: Real-time                │
│   ✓ Orders: Real-time                   │
│                                         │
│ [Configure] [Sync Now] [Disconnect]     │
│                                         │
├─────────────────────────────────────────┤
│ + Add New Integration                   │
└─────────────────────────────────────────┘
```

#### 3.2 POS Setup & Connection

```
┌─────────────────────────────────────────┐
│ Connect Your POS                        │
├─────────────────────────────────────────┤
│                                         │
│ Step 1: Select Your POS Provider        │
│ ┌─────────────────────────────────────┐ │
│ │ Which POS system do you use?        │ │
│ │ ○ Square                           │ │
│ │ ○ Toast                            │ │
│ │ ○ Vend                             │ │
│ │ ○ Other / Manual                   │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Step 2: Generate Credentials            │
│ Client ID:  dpx_merchant_xxx_yyy        │
│ API Key:    dpx_api_merchant_xxx_zzz    │
│ [Copy] [Regenerate]                     │
│                                         │
│ Step 3: Configure Your POS              │
│ Enter these credentials in your POS     │
│ settings: https://docs.dripplex.com/... │
│                                         │
│ Step 4: Set Webhook Endpoint            │
│ Webhook URL: https://your-pos.com/...   │
│ Webhook Secret: ••••••••••••••          │
│ [Test Webhook]                          │
│                                         │
│ [Save] [Cancel]                         │
└─────────────────────────────────────────┘
```

#### 3.3 Sync History & Logs

```
┌─────────────────────────────────────────┐
│ Integration Logs                        │
├─────────────────────────────────────────┤
│ Time        │ Event          │ Status   │
├─────────────┼────────────────┼──────────┤
│ 09:42 AM    │ Inventory Sync │ ✓ Success│
│ 09:40 AM    │ Order: DPX-123 │ ✓ Synced │
│ 09:38 AM    │ Product Update │ ✓ OK     │
│ 09:35 AM    │ Webhook Retry  │ ⚠ Retried│
│ 09:30 AM    │ Catalog Sync   │ ✓ Success│
│             │                │          │
│ [Sync Now]  [Clear Logs]     [Export]   │
└─────────────────────────────────────────┘
```

---

### Phase 4: POS Partner Integration & Documentation

**Goal:** Enable Nigerian POS providers and global systems to build adapters.

**Deliverables:**

1. **Public Integration Documentation**
   - OpenAPI/Swagger spec for all integration endpoints
   - Webhook event reference
   - Authentication flows
   - Error handling & retry logic
   - Code examples (Node.js, Python, Go)

2. **POS Adapter SDK**
   - npm: `@dripplex/pos-adapter`
   - Handles OAuth2, API calls, webhook signing
   - Retry logic with exponential backoff
   - Built-in idempotency key generation

3. **Certification Program**
   - POS providers submit integration for testing
   - DrippleX certifies they meet reliability standards
   - Listed in Partner directory: `https://dripplex.com/partners/pos`

4. **Partner Program**
   - Revenue share model (if applicable)
   - Co-marketing opportunities
   - Priority support channel

---

## Data Models & Contracts

### Integration Order Format

When a DrippleX order is sent to a merchant's POS:

```json
{
  "id": "order_dpx_10482",
  "external_id": "order_pos_987654",
  "merchant_id": "merchant_mani_001",
  "created_at": "2026-09-04T10:15:00Z",
  "status": "received",

  "customer": {
    "id": "customer_001",
    "phone": "+234801234567",
    "name": "Ahmed"
  },

  "items": [
    {
      "sku": "SHA-001",
      "product_id": "product_dpx_001",
      "name": "Chicken Shawarma",
      "quantity": 2,
      "unit_price": 4500,
      "total": 9000,
      "modifiers": [
        { "name": "Extra Sauce", "price": 0 },
        { "name": "No Onions", "price": 0 }
      ]
    },
    {
      "sku": "FRI-001",
      "product_id": "product_dpx_002",
      "name": "Fries",
      "quantity": 1,
      "unit_price": 1500,
      "total": 1500,
      "modifiers": []
    }
  ],

  "totals": {
    "subtotal": 10500,
    "tax": 0,
    "delivery_fee": 500,
    "discount": 0,
    "total": 11000
  },

  "payment": {
    "status": "paid",
    "method": "card",
    "reference": "txn_dpx_12345"
  },

  "delivery": {
    "address": "123 Lekki, Lagos",
    "lat": 6.4244,
    "lng": 3.4248,
    "instructions": "Ring the bell twice"
  },

  "special_instructions": "No cilantro, extra sauce on the side"
}
```

### Product Catalog Sync Format

When a merchant's POS updates product information:

```json
{
  "sku": "SHA-001",
  "merchant_id": "merchant_mani_001",
  "name": "Chicken Shawarma",
  "description": "Fresh grilled chicken with pita bread",

  "pricing": {
    "currency": "NGN",
    "price": 4500,
    "cost": 1800
  },

  "availability": {
    "available": true,
    "stock_quantity": 32,
    "min_stock_alert": 5
  },

  "categories": ["main_course", "shawarma"],
  "tags": ["vegetarian_option_available"],

  "modifiers": [
    {
      "name": "Sauce",
      "type": "single_select",
      "options": ["Hot", "Medium", "Mild"]
    },
    {
      "name": "Extra Protein",
      "type": "boolean",
      "price": 1500
    }
  ],

  "metadata": {
    "pos_id": "item_square_xyz",
    "pos_system": "square",
    "last_updated": "2026-09-04T10:30:00Z"
  }
}
```

### Order Status Update Format

When a merchant's POS sends status updates back:

```json
{
  "order_id": "order_dpx_10482",
  "external_id": "order_pos_987654",
  "status": "preparing",
  "status_history": [
    {
      "status": "received",
      "timestamp": "2026-09-04T10:15:00Z",
      "note": "Order received in POS"
    },
    {
      "status": "accepted",
      "timestamp": "2026-09-04T10:16:00Z",
      "note": "Kitchen accepted order"
    },
    {
      "status": "preparing",
      "timestamp": "2026-09-04T10:18:00Z",
      "note": "Now being prepared"
    }
  ],

  "expected_ready_time": "2026-09-04T10:28:00Z",
  "updated_at": "2026-09-04T10:18:00Z"
}
```

---

## Critical Architectural Decisions

### 1. SKU as the Bridge

**Decision:** Use stable SKU/Product ID as the canonical identifier across systems.

**Rationale:**

- POS systems inherently work with SKUs
- Product Catalog (PR #44) already uses product IDs
- Merchant maintains one canonical SKU → DrippleX maps SKU → Product ID
- Enables real-time sync without duplicate catalogs

**Implementation:**

- In Catalog schema, add `external_sku` field mapping to merchant's POS SKU
- Integration layer resolves: POS SKU → external_sku → product_id

### 2. Domain-Based Source of Truth (NOT Universal)

**Decision:** Source of truth varies by domain. POS is NOT universally authoritative.

**Rationale:**

- Merchants' POS owns merchant-side data (catalog, inventory, pricing)
- DrippleX must own platform-side data (orders, payments, commissions, fulfillment)
- Creating universal "POS authority" would corrupt DrippleX's transaction ledger and merchant balances

**Source of Truth by Domain:**

| Domain                         | Authoritative System | Details                                                                  |
| ------------------------------ | -------------------- | ------------------------------------------------------------------------ |
| **Merchant Catalog**           | POS/Merchant System  | Products, SKUs, prices, descriptions, availability                       |
| **Merchant Inventory**         | POS/Merchant System  | Stock levels, warehouse counts, real-time adjustments                    |
| **DrippleX Orders**            | DrippleX Platform    | Order ID, customer, items, payment status, platform lifecycle            |
| **Order Status (Fulfillment)** | Shared (See below)   | POS updates status, DrippleX records & communicates to customer          |
| **Payments & Wallet**          | DrippleX Platform    | Customer payments, wallet balance, refunds, ledger                       |
| **Platform Commissions**       | DrippleX Platform    | Commission amounts, settlement calculations, merchant payouts            |
| **Ride Transactions**          | DrippleX Platform    | Ride orders, driver assignments, delivery state (POS has ZERO authority) |
| **Customer Data**              | DrippleX Platform    | Customer identity, KYC status, account security                          |

**Order Status Synchronization (Shared Authority):**

- POS/Merchant publishes status changes: RECEIVED → ACCEPTED → PREPARING → READY → PICKED_UP
- DrippleX receives and records these, then communicates to customer
- DrippleX adds platform-specific states: PAYMENT_PROCESSED, DISPATCH_ASSIGNED, DELIVERED
- **Conflict Rule:** If POS says READY and DrippleX says PAYMENT_FAILED, DrippleX state wins (payment must succeed before fulfillment)

**Implementation:**

- Integrations push catalog/inventory TO DrippleX (read-only into merchant system)
- Integrations push order status FROM POS, DrippleX validates before accepting
- Prevent conflicts with timestamp-based versioning and validation rules
- DrippleX remains the authoritative ledger for all platform transactions

### 3. No Separate Integration Catalog

**Decision:** Do NOT create a new "integration catalog" or "POS inventory table."

**Rationale:**

- Would duplicate the Product Catalog
- Creates sync complexity and data debt
- Violates DRY principle

**Implementation:**

- Extend existing `Product` and `Inventory` models
- Add fields: `external_sku`, `external_system`, `last_sync_at`
- Integration layer updates these fields directly

### 4. Idempotency & Retry Handling

**Decision:** All integration endpoints and webhooks are idempotent.

**Rationale:**

- Network failures, POS reboots, and edge cases are inevitable
- A duplicate order is catastrophic; a duplicate API call must be safe

**Implementation:**

- Require `idempotency_key` header on all requests
- Store processed keys in cache (Redis, 24h TTL)
- Webhooks include `idempotency_key` so POS can deduplicate retries

### 5. Ride Independence

**Decision:** POS integration has ZERO authority over Ride transactions.

**Rationale:**

- Ride is a separate product line (driver + customer + delivery)
- POS integration is for Marketplace mini stores only
- A merchant's POS outage cannot affect Ride operations
- Ride payments, driver assignments, and delivery state are DrippleX-only

**Implementation:**

- Ride endpoints and schemas remain completely separate
- POS integration cannot create, modify, or read Ride orders
- Ride has its own fulfillment state machine (independent of POS status)

---

## Roadmap & Timeline

**This feature is post-Ride launch.**

```
NOW              Ride MVP Launch (Play Store + App Store)
                 ✓ Ops Console fix deployed
                 ✓ Mobile app released
                 ✓ Driver + Customer flows live

Marketplace Phase (T+4-6 weeks)
                 ✓ Merchants onboarded
                 ✓ Product Catalog in use (PR #44)
                 ✓ Mini Stores live for customers

MKT-INT-001 Phase (T+8-10 weeks)
                 ▸ Phase 1: Internal API + Webhooks
                 ▸ Phase 2: OAuth2 + Credentials
                 ▸ Phase 3: Merchant Portal Dashboard
                 ▸ Phase 4: Partner Documentation & SDK

First POS Partner Integration (T+12-14 weeks)
                 ▸ Nigerian POS provider (Square, Toast, local provider, or custom)
                 ▸ Live sync for pilot merchants
```

---

## What Does NOT Change for the Ride App Launch

- **No Android/iOS changes** — POS integration is backend-only
- **No new app permissions** — No point-of-sale hardware access needed
- **No customer-facing UI changes** — Order status flows unchanged
- **No payment flow changes** — Payment still handled by DrippleX
- **No driver app impact** — Drivers still pick up from merchants

The Ride app goes to Google Play and App Store with zero integration-specific code.

---

## Success Criteria

✓ Merchants can connect their POS to DrippleX without manual data entry  
✓ Orders sync automatically in real time (< 5 second latency)  
✓ Inventory & pricing sync automatically (< 30 second latency)  
✓ At least 3 POS providers certified and in production  
✓ Merchant reports < 1% sync failure rate  
✓ No production data loss or inconsistency

---

## Open Questions for Founder Review

1. **Revenue Model:** Should we take a percentage of POS integration revenue, or keep it free to drive adoption?
2. **POS Priority:** Which Nigerian POS provider should we approach first?
3. **Inventory Control:** If a merchant changes price in POS and admin changes it in DrippleX simultaneously, who wins?
4. **Partial Fulfillment:** Should we support "item unavailable → suggest replacement" flows?
5. **Receipt Printing:** Should DrippleX send formatted receipt data that POS systems can print directly?

---

## References

- Product Catalog Design (PR #44)
- Talabat Partner API Documentation (reference implementation)
- Merchant Portal Architecture
- DrippleX Marketplace Vision
