# Well-known files for mobile deep linking

# Host on production CDN / app.dripplex.com before store submission.

## Android App Links

Path: `https://app.dripplex.com/.well-known/assetlinks.json`

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.dripplex.customer",
      "sha256_cert_fingerprints": ["REPLACE_WITH_RELEASE_SHA256"]
    }
  }
]
```

Obtain SHA-256: `keytool -list -v -keystore release.keystore -alias dripplex-customer`

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
