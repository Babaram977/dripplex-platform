export type PushDevicePlatform = 'IOS' | 'ANDROID' | 'WEB';

/** Web app config from Firebase Console → Project Settings → General →
 * "Your apps" (the public web snippet, distinct from the Admin SDK
 * service-account credentials the backend uses). Safe to expose to the
 * browser — it identifies the Firebase project, it isn't a secret. */
export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  messagingSenderId: string;
  appId: string;
}

/** The minimal shape `usePushRegistration` needs from an SDK's device
 * client — matches `DevicesClient` in `@dripplex/sdk` structurally so no
 * import of the concrete class is required here. */
export interface PushDevicesClient {
  register(body: { platform: PushDevicePlatform; token: string }): Promise<{ id: string }>;
  deactivate(id: string): Promise<unknown>;
}

export interface UsePushRegistrationOptions {
  devicesClient: PushDevicesClient;
  /** Omit (or leave any field undefined) to keep web push inert — the
   * hook no-ops instead of throwing when Firebase isn't configured yet. */
  firebaseWebConfig?: FirebaseWebConfig;
  vapidKey?: string;
}
