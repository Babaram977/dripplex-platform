export const CALLS_PERMISSIONS = {
  /** Held by every party who can be on one end of a job: customers, riders and
   * drivers. Exactly like `messaging:use`, this only says "this kind of account
   * may use calling at all". Access to a SPECIFIC call is decided by
   * CallsService from the job's own parties, so holding the permission never
   * lets anyone reach somebody they are not paired with. */
  USE: 'calls:use',
} as const;
