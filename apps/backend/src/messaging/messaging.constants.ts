export const MESSAGING_PERMISSIONS = {
  /** Held by every party who can be on one end of a job: customers, riders
   * and drivers. Authorisation to a specific thread is NOT this permission —
   * it is being one of that job's two parties (see MessagingService). */
  USE: 'messaging:use',
} as const;

export const MESSAGING_AUDIT_ACTIONS = {
  SENT: 'message.sent',
} as const;

/** Matches the schema's VARCHAR(2000). */
export const MESSAGE_MAX_LENGTH = 2000;

/** How many messages a thread returns per page, newest last. */
export const MESSAGE_PAGE_SIZE = 100;
