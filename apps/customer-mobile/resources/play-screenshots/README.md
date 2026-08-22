# Play phone screenshots

Five 1080×1920 PNGs, captured by `scripts/capture-screenshots.mjs` from the
real super-app build signed in to production as a real customer. Play needs
between 2 and 8, minimum 1080×1920 — these clear both.

Nothing in them is mocked, seeded or dressed up. Every name, price, product
photo and balance is what that account actually held on the day of capture, so
a sparse screen here is a sparse screen in the product.

## What each one shows, and whether it is listing-quality

| File                 | Verdict         | Notes                                                                       |
| -------------------- | --------------- | --------------------------------------------------------------------------- |
| `01-home.png`        | **ship**        | Greeting, search, the eight Quick Actions, bottom nav. The strongest frame. |
| `02-marketplace.png` | **ship**        | Trending Products with real merchandise photos and real ₦ prices.           |
| `03-ride.png`        | usable          | Map and "Where to?". The lower half is empty — see below.                   |
| `04-wallet.png`      | thin            | Correct and complete, but ₦0.00 with "No transactions yet".                 |
| `05-orders.png`      | **do not ship** | One order on an otherwise blank screen.                                     |

Home and marketplace alone satisfy Play's two-screenshot minimum. The rest are
committed as honest evidence of the current state, not because they sell
anything.

## What limits the weaker three

None of it is a layout fault — the screens render correctly at 360 CSS px.
They are thin because production data is thin:

- **Wallet** — the account has never topped up, so the balance is ₦0.00 and
  the transaction list is empty. It fills in by itself once wallet activity
  exists. Do not seed a balance to make this look better.
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
