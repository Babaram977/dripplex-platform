/**
 * DPX-DRIVER-007 — Driver Registration Completion.
 *
 * Content constants for the registration flow, adapted from the Figma Driver
 * Registration screens (EmergencyContactScreen / AgreementAcceptanceScreen) to
 * the driver-portal web idiom. Fields, options, and agreement sections mirror
 * the live Figma source; styling uses the shared @dripplex/ui components.
 */

/** Emergency-contact Relationship dropdown options — mirror the Figma dropdown
 * exactly and match the backend `EMERGENCY_CONTACT_RELATIONSHIPS` @IsIn set. */
export const EMERGENCY_CONTACT_RELATIONSHIPS = [
  'Spouse',
  'Parent',
  'Sibling',
  'Child',
  'Relative',
  'Friend',
  'Other',
] as const;

/** Founder decision 2026-08-08: this initial Driver Agreement is version "1.0". */
export const DRIVER_AGREEMENT_VERSION = '1.0';

/** The six agreement sections shown on the Figma Agreement Acceptance screen. */
export const DRIVER_AGREEMENT_SECTIONS: readonly { title: string; body: string }[] = [
  {
    title: 'Driver Responsibilities',
    body: 'Provide safe, courteous service, keep your details accurate, and follow all applicable local transport laws.',
  },
  {
    title: 'Safety',
    body: 'Maintain a valid licence, drive responsibly, and cooperate with DrippleX safety checks and incident reporting.',
  },
  {
    title: 'Vehicle Requirements',
    body: 'Keep your registered vehicle roadworthy, insured where required, and matching its approved details and inspection status.',
  },
  {
    title: 'Platform Conduct',
    body: 'Treat riders and staff with respect, avoid fraudulent activity, and use the platform only as intended.',
  },
  {
    title: 'Account & Registration',
    body: 'Complete registration truthfully. DrippleX reviews submissions before activation and may request further information.',
  },
  {
    title: 'Suspension & Termination',
    body: 'DrippleX may suspend or terminate access for policy or safety violations, subject to the platform terms.',
  },
];
