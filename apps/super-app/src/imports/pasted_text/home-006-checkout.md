Saeed...

This is outstanding.

You're no longer designing screens—you are building a **real enterprise application**.

The architecture Claude has implemented is exactly what I wanted to see:

- ✅ Merchant grouping
- ✅ Live calculations
- ✅ Dynamic delivery options
- ✅ Wallet integration
- ✅ AI integration
- ✅ Promo engine
- ✅ Saved for Later
- ✅ Error handling
- ✅ Sticky checkout
- ✅ Reusable components

This is the level of quality expected from a production super app.

# HOME-005 Status

## ✅ APPROVED

## 🔒 LOCKED

---

# Next Screen

# HOME-006 — Checkout

This is arguably the **most critical screen** in the Marketplace flow because it directly impacts conversion. The goal is to make checkout fast, trustworthy, and flexible.

Copy the following into Figma Make.

---

# HOME-006 — Universal Checkout

Continue using the approved DrippleX architecture.

Do **NOT** redesign the UI.

Reuse all existing shared components.

Use:

- ShoppingCart models
- StoreMerchant
- StoreProduct
- Wallet components
- Address components
- Bottom Sheets
- Shared Buttons
- Shared Cards
- Existing Design Tokens

Everything must inherit the HOME-001 → HOME-005 visual language.

---

## Purpose

Design a **single checkout experience** that supports:

- Single-merchant orders
- Multi-merchant orders
- Product purchases
- Service bookings
- Restaurant orders
- Grocery delivery
- Pharmacy purchases

without changing the layout.

---

## Header

**Checkout**

Top-left:

← Back

Top-right:

🔒 Secure Checkout indicator

---

## Delivery Address

Display the selected address card with:

- Recipient name
- Phone number
- Full address
- Address label (Home, Work, Other)

Actions:

- Change Address
- Add New Address
- Use Current Location

---

## Merchant Summary

Each merchant is shown in its own collapsible card.

Display:

- Merchant name
- Item count
- Delivery option
- Merchant subtotal

Allow editing without leaving checkout.

---

## Delivery Method

Per merchant, support:

- 🚚 Standard Delivery
- ⚡ Express Delivery
- 🏪 Pickup

Recalculate totals immediately when changed.

---

## Delivery Notes

Optional text field for each merchant.

Examples:

- Call on arrival
- Leave at gate
- Extra spicy
- Fragile item

---

## Scheduled Delivery

Allow users to choose:

- Deliver Now
- Schedule for Later

If scheduled, display a date and time picker.

---

## Payment Method

Support:

- 💳 DrippleX Wallet
- 💵 Cash on Delivery (merchant dependent)
- 💳 Debit/Credit Card
- 🏦 Bank Transfer (if enabled)

Display the default payment method and allow switching.

---

## Wallet Integration

If Wallet is selected:

- Show available balance
- Amount applied
- Remaining balance (if any)

If insufficient, automatically prompt the user to choose an additional payment method.

---

## Promo & Rewards

Display:

- Applied promo code
- Cashback earned
- Loyalty points earned (future-ready)

Allow users to remove or change the promo code.

---

## Order Summary

Display a clear breakdown:

- Items Total
- Merchant Discounts
- Promo Savings
- Delivery Fees
- Wallet Applied
- Cashback Earned
- Estimated Tax (if applicable)
- Final Total

---

## Terms & Confirmation

Checkbox:

"I have reviewed my order and agree to the merchant terms and DrippleX Terms of Service."

Required before placing the order.

---

## Sticky Bottom Bar

Always visible.

Display:

Final Total

Primary Button:

**Place Order**

---

## Order Success

After placing the order:

Display a premium confirmation animation:

- Green checkmark
- DrippleX logo
- Confetti or subtle particle effect

Message:

**Order Confirmed!**

Show:

- Order Number
- Estimated Delivery Time
- Button: **Track Order**
- Button: **Continue Shopping**

Automatically navigate to **HOME-007 — Order Tracking** if the user chooses to track the order.

---

## Error States

Support:

- Payment Failed
- Wallet Balance Changed
- Merchant Closed
- Item Out of Stock
- Delivery Area Changed
- Network Error

Each state should provide a clear recovery action.

---

## Motion

- Smooth section expand/collapse
- Animated total updates
- Payment method transitions
- Sticky summary updates
- Success animation
- Bottom sheet interactions

---

## Accessibility

- WCAG 2.2 AA
- Screen readers
- High contrast
- Large touch targets
- Dynamic text
- Dark mode optimized

---

## Technical Requirements

Reuse existing models and components.

Do not duplicate business logic.

Support unlimited merchants and items.

Keep the architecture modular and production-ready.

---

## Business Rules

- Checkout supports both single and multiple merchants.
- Payment methods may vary by merchant.
- Delivery methods are merchant-specific.
- The UI remains consistent regardless of merchant type.
- The flow should minimize friction and maximize user confidence.

---

## After HOME-006

The Marketplace purchase flow will be:

- ✅ HOME-001 — Consumer Dashboard
- ✅ HOME-002 — Marketplace
- ✅ HOME-003 — Merchant Mini Store
- ✅ HOME-004 — Product Details
- ✅ HOME-005 — Shopping Cart
- ▶️ **HOME-006 — Checkout**
- HOME-007 — Order Tracking

Once HOME-007 is complete, we'll have a fully functional commerce journey from discovery to delivery, providing a robust foundation before expanding into Ride, Wallet, and the rest of the DrippleX ecosystem.
