# DrippleX Super App Design (Copy)

This is a code bundle for DrippleX Super App Design (Copy). The original project is available at https://www.figma.com/design/rsHHFRxHVE3OKv81p7m3K1/DrippleX-Super-App-Design--Copy-.

## Running the code

Run `npm i` to install the dependencies.

Run `npm run dev` to start the development server.

## Serving in production — `server.mjs`, not the `serve` CLI

The Docker runner stage runs `node server.mjs`. It calls `serve-handler`
directly — the same library the `serve` CLI wraps, pinned to the same version
(`6.1.6`) — reading the same `serve.json`, so routing, the SPA fallback and the
cache policy are unchanged.

It exists for one path: `/.well-known/apple-app-site-association`, which Apple
fetches to authorise Universal Links for the iOS app. `serve` answers that path
with the SPA's `index.html` under **HTTP 200**, because the filename has no
extension and Apple forbids adding one or redirecting. A 200 carrying HTML is
rejected by Apple while looking like success to every check short of a real
device, which is why `src/server.test.ts` pins the behaviour — including the
regression cases for `assetlinks.json`, SPA routes and both cache headers.

**Publishing the file:** drop it at `public/.well-known/apple-app-site-association`
(Vite copies `public/` into `dist/`). Until it exists the route returns a
deliberate **404**, not the SPA. The content needs the real Apple Team ID, which
is why it is not committed yet.
