# Mobile permissions review (D4)

Principle: **request only what the shell needs**. Feature permissions (camera, location) belong in the web app via browser APIs with runtime prompts — not declared in native manifests unless a Capacitor plugin requires them.

## Customer mobile (`com.dripplex.customer`)

| Permission          | Android               | iOS             | Needed?                    | Action           |
| ------------------- | --------------------- | --------------- | -------------------------- | ---------------- |
| Internet            | ✅ INTERNET           | implicit        | Yes                        | Keep             |
| Notifications       | ✅ POST_NOTIFICATIONS | Push capability | Yes                        | Keep             |
| Location            | —                     | —               | Web-only (Geolocation API) | **Not declared** |
| Camera              | —                     | —               | Web-only if KYC            | **Not declared** |
| Storage / Photos    | —                     | —               | Web upload uses picker     | **Not declared** |
| Phone / SMS         | —                     | —               | Not used                   | **Not declared** |
| Background location | —                     | —               | Not used                   | **Not declared** |
| Microphone          | —                     | —               | Not used                   | **Not declared** |

## Merchant / Rider (future shells)

| App      | Suggested package       | Extra native permissions                                                       |
| -------- | ----------------------- | ------------------------------------------------------------------------------ |
| Merchant | `com.dripplex.merchant` | None at shell layer                                                            |
| Rider    | `com.dripplex.rider`    | Consider `ACCESS_FINE_LOCATION` only if background tracking plugin added later |

## Review result

✅ **No unused dangerous permissions** on customer Android manifest.  
⏳ Re-audit when adding Capacitor plugins (e.g. `@capacitor/geolocation` for rider).
