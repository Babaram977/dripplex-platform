const DEVICE_ID_STORAGE_KEY = 'dripplex_driver_device_id';

/**
 * Stable per-browser identifier for Driver-001's "new device" identity-
 * verification risk check — see docs/DRIVER-001-IDENTITY-VERIFICATION-DESIGN.md.
 * Persisted in localStorage; generated once per browser/device install.
 */
export function getDeviceFingerprint(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing) {
      return existing;
    }
    const generated = window.crypto.randomUUID();
    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
    return generated;
  } catch {
    return undefined;
  }
}
