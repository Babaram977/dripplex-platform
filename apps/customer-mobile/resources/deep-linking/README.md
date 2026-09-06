# Well-known files for mobile deep linking

## Android App Links — SHIPPED 2026-09-06

The file is no longer a template here. It lives at
`apps/super-app/public/.well-known/assetlinks.json`, which Vite copies into
`dist/` and the super-app's `serve` container publishes at
`https://app.dripplex.com/.well-known/assetlinks.json`.

**Do not use `keytool` on the release keystore for this.** That was the
instruction until Play App Signing was enabled on 2026-09-06, and it is now
the single easiest way to break App Links silently. `keytool -list -v
-keystore release.keystore` prints the **upload key** fingerprint — the
certificate you sign with. Google re-signs every bundle before it reaches a
device, so a phone never sees that certificate, and verification fails
against it while every other symptom looks normal: the intent filter still
matches, links just stop opening in the app.

The correct fingerprint is the **app signing key**, and the only safe way to
get it is to copy the whole snippet Google generates:

> Play Console → Test and release → App integrity → App signing →
> **Digital Asset Links JSON** → copy icon

Copy that verbatim rather than assembling it by hand. This app's signing key
is Quantum-ready (beta), so it carries four fingerprints (classical and
post-quantum, SHA-256 and SHA-1) and there is already a rotated previous key
in the Console — picking one out of that set by eye is how the wrong value
gets shipped. Google's snippet resolves all of it.

Re-copy and re-commit the file whenever the app signing key is rotated.

### Verifying it is actually served

The super-app runs `serve -s dist` with `rewrites: [{ source: "**",
destination: "/index.html" }]`, so any path that does not resolve to a real
file returns the HTML app instead of a 404. A missing or misplaced
`assetlinks.json` therefore answers `200` with `text/html`, Android reads it
as malformed, and nothing anywhere reports an error. Check the content type,
not just the status:

```
curl -i https://app.dripplex.com/.well-known/assetlinks.json
# expect: 200, Content-Type: application/json
```

Google's own checker is the other half:
`https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://app.dripplex.com&relation=delegate_permission/common.handle_all_urls`

> **`package_name` is the Android `applicationId`, not the code namespace.**

> **`package_name` here is the Android `applicationId`, not the code namespace.** It moved
> to `com.dripplex.app`; the Java package and the iOS bundle identifier below did not.
> A hosted assetlinks.json still naming `com.dripplex.customer` silently stops verifying
> App Links — the intent filter keeps working, but Android stops opening links in the app
> without the disambiguation dialog. Re-host this file with the build that carries the new
> id.

## iOS Universal Links

Path: `https://app.dripplex.com/.well-known/apple-app-site-association`

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAMID.com.dripplex.customer",
        "paths": ["*"]
      }
    ]
  }
}
```

Replace `TEAMID` with Apple Developer Team ID.

## Custom scheme

- `dripplex://open/*` — configured in AndroidManifest and Info.plist
