import type { PushDevicesClient, PushDevicePlatform } from './push-types';

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;

/** Registration is idempotent server-side (DeviceRegistryService upserts
 * on the userId+platform+token unique key), so retrying after a network
 * failure is always safe — it can never create a duplicate row. */
export async function registerDeviceWithRetry(
  devicesClient: PushDevicesClient,
  body: { platform: PushDevicePlatform; token: string },
): Promise<{ id: string } | null> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await devicesClient.register(body);
    } catch {
      if (attempt < MAX_ATTEMPTS - 1) {
        await new Promise((resolve) => setTimeout(resolve, BASE_DELAY_MS * 2 ** attempt));
      }
    }
  }
  return null;
}
