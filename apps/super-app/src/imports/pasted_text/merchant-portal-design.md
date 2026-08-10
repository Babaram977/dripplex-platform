DESIGN THE DRIPPLEX MERCHANT PORTAL — V1 CLOSED-LOOP PILOT

Create a complete, production-quality Merchant Portal UI for DrippleX.

IMPORTANT:
This is an existing DrippleX platform. Do NOT redesign DrippleX's brand identity, customer app, driver app, or operations console.

Use the existing DrippleX visual language, components, spacing, typography, iconography, cards, buttons, form controls, navigation patterns and interaction principles wherever they already exist in the connected Figma project.

The Merchant Portal must feel like a native part of the DrippleX Super-App ecosystem.

PRODUCT PURPOSE

The Merchant Portal is for the first controlled cohort of 20 merchant/store owners.

The Merchant Portal allows an approved merchant to:

• complete business/store setup
• submit KYC
• configure bank account
• see onboarding/approval status
• manage products
• receive and process customer orders
• view earnings and settlements

The first pilot is CASH-FIRST.

Paystack and Flutterwave are not part of the active pilot payment flow.
OPay remains disabled.

The platform commission is currently 10% and is configurable by Operations. Do NOT create a merchant-facing commission-setting control.

Merchant payouts are initially administered by Operations. Do NOT create a merchant self-service withdrawal feature.

DESIGN PRINCIPLE

Keep the pilot intentionally simple.

Do not create a giant marketplace merchant suite.

Do not add:
• advanced analytics dashboards
• promotions/campaigns
• reviews/replies
• multi-branch management
• bulk catalogue import
• advanced holiday scheduling
• disputes management
• self-service withdrawals
• complex product variant management unless needed for the existing product API
• unnecessary accounting features

Focus on the minimum closed-loop experience:

ONBOARD
→ SET UP STORE
→ COMPLETE KYC
→ ADD BANK ACCOUNT
→ GET APPROVED
→ ADD PRODUCTS
→ RECEIVE ORDER
→ ACCEPT ORDER
→ PREPARE
→ MARK READY
→ DRIVER PICKUP
→ DELIVERY
→ SETTLEMENT
→ VIEW EARNINGS

CREATE EXACTLY THESE 8 PRIMARY SCREENS

1. BUSINESS / STORE SETUP
2. MERCHANT KYC
3. BANK ACCOUNT
4. ONBOARDING / APPROVAL STATUS
5. PRODUCTS / CATALOGUE
6. INCOMING ORDERS
7. ORDER DETAIL
8. EARNINGS / SETTLEMENTS

Also create the necessary modal, drawer, confirmation, empty, loading, error and success states needed to make these screens production-ready.

---

SCREEN 1 — BUSINESS / STORE SETUP
--------------------------------------------------

Create a clean merchant onboarding/business profile screen.

Sections:

Business Information
• Business/store name
• Business type/category
• Business description where supported

Store Information
• Store name
• Store address
• Location/map picker
• Latitude/longitude represented naturally in the UI without exposing technical fields unnecessarily
• Operating hours
• Store logo
• Cover image where supported

Store Operations
• Store open/active status
• Pause store
• Resume store

Actions:
• Save
• Continue
• Save and exit

Use progressive disclosure so the screen does not feel like a long government form.

Show completion/progress where useful.

---

SCREEN 2 — MERCHANT KYC
--------------------------------------------------

Create a professional but simple KYC experience.

Show:
• KYC progress
• required documents
• document type
• upload control
• uploaded document state
• verification status
• rejected document state
• correction/re-upload state

States:
• Not started
• In progress
• Submitted
• Under review
• Approved
• Requires correction
• Rejected

Use the existing DrippleX secure-upload visual pattern.

Do NOT expose storage URLs.

Provide clear security/privacy messaging.

Do not invent unsupported KYC document types. The implementation must later map to the existing Merchant KYC API contract.

---

SCREEN 3 — BANK ACCOUNT
--------------------------------------------------

Create a secure bank-account setup screen.

Fields:
• Bank
• Account number
• Account name / resolved account name where supported

Show:
• verification state
• saved account
• edit/update state
• verification error
• confirmation state

Clearly communicate that this account is the merchant's payout/settlement destination.

Do not create a withdrawal button.

Merchant payouts are initially controlled by Operations.

---

SCREEN 4 — ONBOARDING / APPROVAL STATUS
--------------------------------------------------

Create a simple status dashboard showing the merchant's progress.

Use a visual stepper/checklist:

1. Business setup
2. KYC
3. Bank account
4. Operations approval
5. Store activation

Each step should show:
• completed
• pending
• action required
• under review
• rejected

Include a prominent overall status:

• Setup incomplete
• Pending approval
• Approved
• Requires correction
• Suspended

If rejected or correction is required, clearly explain what the merchant must do next.

Do not expose internal administrative terminology unnecessarily.

---

SCREEN 5 — PRODUCTS / CATALOGUE
--------------------------------------------------

Create the merchant product-management experience.

Main screen:
• product list
• product image
• product name
• category
• price
• availability
• published/unpublished state
• stock status

Actions:
• Add product
• Edit product
• Publish
• Unpublish
• Mark in stock
• Mark out of stock
• Delete with confirmation

Product creation/edit form:
• product name
• description where supported
• price
• category where supported
• image where supported
• availability/publish state

Make inventory status extremely easy to change.

Design strong empty states:
"No products yet"
"Add your first product to start receiving orders."

Do not overbuild variants/gallery management for the pilot.

---

SCREEN 6 — INCOMING ORDERS
--------------------------------------------------

This is one of the most important Merchant screens.

Create an order-management dashboard.

Order list should clearly distinguish:

• New
• Accepted
• Preparing
• Ready
• Completed
• Rejected/Cancelled

Each order card/list item should show:
• order number
• time
• customer/order summary
• item count
• total
• payment method
• current status

For pilot payment:
CASH should be clearly represented.

Make NEW ORDERS visually prominent.

Provide:
• Accept
• Reject
• Open order

When a new order arrives, the merchant should see a strong new-order state.

Include notification indicator/badge.

Design empty states for each order state.

---

SCREEN 7 — ORDER DETAIL
--------------------------------------------------

Create the full order-processing screen.

Show:
• order number
• order timestamp
• customer/order information allowed by existing API
• ordered products
• quantities
• item prices
• subtotal
• applicable total
• payment method
• fulfillment method/status
• order timeline

Primary actions should follow the actual workflow:

NEW
→ ACCEPT
→ PREPARING
→ READY

Where cancellation/rejection is supported:
→ REJECT/CANCEL

Make READY a highly visible action because it hands the order into the delivery/dispatch workflow.

Show a confirmation before irreversible actions.

After READY:
show that the order is awaiting/being handled by the delivery workflow.

Do not invent driver assignment controls if those are handled automatically by the existing platform.

---

SCREEN 8 — EARNINGS / SETTLEMENTS
--------------------------------------------------

Create a simple merchant financial overview.

Show:
• available merchant balance
• earnings
• completed settlements
• transaction history
• settlement status
• date
• order/reference
• amount
• commission where appropriate
• net merchant amount

The current platform commission is 10%, but this is controlled by Operations.

The merchant can VIEW financial information but cannot change commission.

Do NOT create:
• withdrawal button
• payout initiation
• commission settings
• payment-provider configuration

Clearly explain that payouts are managed by Operations during the pilot where appropriate.

---

GLOBAL NAVIGATION
--------------------------------------------------

Create a consistent Merchant Portal navigation.

Recommended primary navigation:

• Dashboard
• Orders
• Products
• Store
• Earnings

Secondary/account area:
• Business Profile
• KYC
• Bank Account
• Notifications
• Settings
• Help/Support

Keep navigation simple and optimized for daily merchant operations.

The dashboard should prioritize:
• today's orders
• new orders requiring action
• store status
• product availability
• current balance/earnings

Do not turn the dashboard into an advanced analytics product.

---

NOTIFICATIONS
--------------------------------------------------

Use DrippleX's existing notification architecture visually.

Critical event:

NEW ORDER RECEIVED

The merchant must clearly see:
• in-app notification
• notification badge
• order requiring action

Provide:
• notification list
• read/unread state
• notification preference entry where appropriate

Do not invent a second notification system.

---

RESPONSIVE DESIGN
--------------------------------------------------

Design the Merchant Portal primarily for desktop/tablet merchant use, but ensure responsive behavior for smaller screens.

Create:
• desktop layout
• tablet behavior
• mobile-responsive behavior where appropriate

Use the same design system across all breakpoints.

Avoid dense desktop-only tables where a card/list treatment works better on mobile.

---

UX STATES
--------------------------------------------------

For every major screen include appropriate states:

• Loading
• Empty
• Success
• Error
• Validation error
• Network failure
• Pending
• Disabled
• Requires correction
• Approved
• Suspended where relevant

Do not leave important actions without feedback.

---

SECURITY / TRUST
--------------------------------------------------

Merchant UI must never expose:
• JWT tokens
• raw storage URLs
• internal database IDs unnecessarily
• internal permission names
• secret credentials

Use friendly business language.

---

DESIGN LANGUAGE
--------------------------------------------------

Maintain DrippleX's established brand identity.

Do not introduce a new logo.

Do not invent a new color system.

Do not create a separate unrelated Merchant brand.

Merchant should visually belong to:

DRIPPLEX
"life,Simplified"

Use the existing approved DrippleX brand system from the connected project.

The interface should feel:
• modern
• trustworthy
• premium but practical
• clean
• operationally efficient
• easy for Nigerian SME merchants to understand
• optimized for fast order processing

Avoid unnecessary visual complexity.

---

FIGMA ORGANIZATION
--------------------------------------------------

Organize the design file professionally.

Create:

PAGE:
DRIPPLEX — MERCHANT PILOT V1

SECTIONS:

01 — Foundations
02 — Navigation
03 — Onboarding
04 — Store Management
05 — Catalogue
06 — Orders
07 — Earnings
08 — Notifications
09 — Components
10 — States
11 — Responsive

Use reusable components and variants.

Create clearly named frames.

Use Auto Layout.

Use components for:
• buttons
• inputs
• dropdowns
• cards
• status badges
• order cards
• product cards
• navigation
• tables/lists
• upload fields
• progress indicators
• modals
• confirmation dialogs
• notification items

Make the design implementation-ready for a frontend engineer.

---

FINAL FIGMA DELIVERABLE
--------------------------------------------------

The final design should make it possible for a developer to implement the complete 20-store Merchant pilot without guessing the UX.

The design must cover the entire operational loop:

MERCHANT ONBOARDING
→ APPROVAL
→ STORE SETUP
→ PRODUCTS
→ CUSTOMER ORDER
→ MERCHANT NOTIFICATION
→ ACCEPT
→ PREPARE
→ READY
→ DRIVER HANDOFF
→ DELIVERY
→ SETTLEMENT
→ EARNINGS

Do not design post-pilot features.

Do not create unsupported backend functionality.

Where an existing API capability is not represented in the pilot, leave it out rather than inventing UI.

At completion, provide a concise design summary identifying:
• all 8 pilot screens
• all supporting states/modals
• reusable components
• desktop/mobile coverage
• any unresolved UX questions requiring founder approval.
