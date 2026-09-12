# DrippleX Super App Design (Copy)

This is a code bundle for DrippleX Super App Design (Copy). The original project is available at https://www.figma.com/design/rsHHFRxHVE3OKv81p7m3K1/DrippleX-Super-App-Design--Copy-.

## Running the code

Run `npm i` to install the dependencies.

Run `npm run dev` to start the development server.

## Serving in production — `server.mjs`, not the `serve` CLI

The Docker runner stage runs `node server.mjs`. It calls `serve-handler`
directly — the same library the `serve` CLI wraps, pinned to the same version
(`6.1.7`) — reading the same `serve.json`, so routing, the SPA fallback and the
cache policy are unchanged.

It exists for one path: `/.well-known/apple-app-site-association`, which Apple
fetches to authorise Universal Links for the iOS app. `serve` answers that path
with the SPA's `index.html` under **HTTP 200**, because the filename has no
extension and Apple forbids adding one or redirecting. A 200 carrying HTML is
rejected by Apple while looking like success to every check short of a real
device, which is why `src/server.test.ts` pins the behaviour — including the
regression cases for `assetlinks.json`, SPA routes and both cache headers.

**The file is published** at `public/.well-known/apple-app-site-association`;
Vite copies `public/` into `dist/`, extensionless name intact — verified against
a real build, not assumed. It names `X9MCF93WB7.com.dripplex.customer`
(AFNAN HOMES LTD + the **iOS** bundle id, which is `com.dripplex.customer`, not
the Android `applicationId` `com.dripplex.app`).

It claims `"/": "/*"` — every path — because the Android intent filter for
`app.dripplex.com` carries no `pathPrefix` and so claims the whole host.
Anything narrower would open a link in the app on Android and the browser on
iOS. Both the Team ID and the path scope are pinned by test.

If the file is ever missing, the route returns a deliberate **404**, not the
SPA.
