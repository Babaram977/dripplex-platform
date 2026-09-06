# Play phone screenshots

Five 1080×1920 PNGs, captured by `scripts/capture-screenshots.mjs` from the
real super-app build signed in to production. Play needs between 2 and 8,
minimum 1080×1920 — these clear both.

The account (MAMMAN) is a **testing account**, founder-confirmed 2026-09-06,
so the first name visible in three of these frames is not customer PII and
they are publishable on that count.

Nothing in them is mocked, seeded or dressed up. Every name, price, product
photo and balance is what that account actually held on the day of capture, so
a sparse screen here is a sparse screen in the product.

## What each one shows, and whether it is listing-quality

| File                 | Verdict         | Notes                                                                        |
| -------------------- | --------------- | ---------------------------------------------------------------------------- |
| `01-home.png`        | **do not ship** | Regraded 2026-09-06 — see below. Was "ship, the strongest frame"; it is not. |
| `02-marketplace.png` | **ship**        | Trending Products with real merchandise photos and real ₦ prices.            |
| `03-ride.png`        | usable          | Map and "Where to?". The lower half is empty — see below.                    |
| `04-wallet.png`      | thin            | Correct and complete, but ₦0.00 with "No transactions yet".                  |
| `05-orders.png`      | **do not ship** | One order on an otherwise blank screen.                                      |

**`01-home` was regraded 2026-09-06 after actually opening it.** The previous
entry called it the strongest frame on the strength of its layout — greeting,
search, eight Quick Actions, bottom nav — without reading what the layout
says. Its largest card reads "Ask Drip — Coming soon" and "Our AI assistant
isn't available yet", and two Quick Actions (Health, More) carry SOON badges.
A store screenshot advertising functionality the app does not have is a Play
metadata-policy risk, and independent of policy it is the worst available
first impression: the biggest element on the frame says a feature does not
work. It ships again when that card leaves the home screen, not before.

That leaves `02-marketplace` as the only frame that actively sells anything.
Uploading it with `03-ride` and `04-wallet` clears Play's two-screenshot
minimum; the rest are committed as honest evidence of the current state.

## What limits the weaker three

None of it is a layout fault — the screens render correctly at 360 CSS px.
They are thin because production data is thin:

- **Wallet** — the account has never topped up, so the balance is ₦0.00 and
  the transaction list is empty. It fills in by itself once wallet activity
  exists. Do not seed a balance directly into the database to make this look
  better — but since this is a testing account, genuinely funding it and
  spending through the app is ordinary use, and recapturing afterwards is the
  intended fix.
- **Orders** — one completed order exists platform-wide for this customer.
- **Ride** — the sheet below the map holds saved places and recent trips, and
  this account has neither. The pickup line reads "Your current location"
  rather than a street when the geocoder returns nothing for the coordinate.

## Regenerating

```
DPX_BASE=https://app.dripplex.com \
DPX_CUSTOMER_EMAIL=… DPX_CUSTOMER_PASSWORD=… \
node scripts/capture-screenshots.mjs
```

Unlike the icons and the feature graphic, these are **not** reproducible byte
for byte — they photograph live data, which moves. CI does not check them.
Recapture whenever the account's data gets richer, and re-read the table above
before uploading.
