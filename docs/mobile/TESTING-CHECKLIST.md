# Mobile & PWA testing checklist (D4)

Execute against **staging** before production store submission.

## Installation

- [ ] Android: install APK from internal track
- [ ] Android: upgrade from previous beta build (versionCode increment)
- [ ] iOS: TestFlight install
- [ ] PWA: Chrome → Install app (customer-web)
- [ ] iOS Safari: Add to Home Screen (after PNG icon drop)

## Core flows (Customer)

- [ ] Authentication — register, login, logout, session refresh
- [ ] Orders — list, detail, status
- [ ] Payments — checkout flow (staging gateway)
- [ ] Wallet — balance, history (if enabled)
- [ ] Notifications — permission prompt, foreground display (when FCM wired)

## Portals (web / future shells)

- [ ] Merchant — login, orders dashboard (mobile browser)
- [ ] Rider — login, assignments (mobile browser)
- [ ] Admin — login, read-only smoke (tablet)

## Offline / resilience

- [ ] Airplane mode → offline fallback page (PWA / shell)
- [ ] Restore network → resume session
- [ ] Deep link `https://app.dripplex.com/dashboard/orders` opens correct screen

## Non-functional

- [ ] Cold start < 3s on mid-range Android (shell + first paint)
- [ ] No critical accessibility blockers (axe on customer-web)
- [ ] Lighthouse PWA score documented (target ≥ 80 installability when icons fixed)

## Sign-off

| Role        | Name | Date |
| ----------- | ---- | ---- |
| QA          |      |      |
| Product     |      |      |
| Engineering |      |      |
