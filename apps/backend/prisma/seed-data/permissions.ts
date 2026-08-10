export interface PermissionSeed {
  code: string;
  description: string;
}

export const PERMISSION_SEEDS: PermissionSeed[] = [
  { code: 'profile:read', description: 'Read own profile' },
  { code: 'profile:write', description: 'Update own profile' },
  { code: 'auth:sessions:read', description: 'List own auth sessions' },
  { code: 'auth:sessions:revoke', description: 'Revoke own auth sessions' },
  { code: 'customer:addresses:manage', description: 'Manage customer addresses' },
  { code: 'admin:addresses:read', description: 'Read customer addresses (admin)' },
  { code: 'customer:cart:manage', description: 'Manage own shopping cart' },
  { code: 'customer:ride:manage', description: 'Request, view, and cancel own rides' },
  { code: 'driver:ride:manage', description: 'View and respond to own ride offers' },
  { code: 'admin:cart:read', description: 'Read shopping carts (admin)' },
  { code: 'customer:checkout', description: 'Create orders from shopping cart' },
  { code: 'customer:orders', description: 'View and cancel own orders' },
  { code: 'admin:orders:read', description: 'Read orders (admin)' },
  { code: 'admin:orders:manage', description: 'Manage and refund orders (admin)' },
  { code: 'merchant:orders:manage', description: 'Accept, prepare, and fulfill own orders' },
  { code: 'customer:delivery:read', description: 'Read own delivery jobs and tracking' },
  { code: 'rider:delivery:manage', description: 'Manage assigned delivery jobs' },
  { code: 'admin:delivery:manage', description: 'Manage delivery jobs (admin)' },
  { code: 'customer:loyalty:read', description: 'Read own loyalty account' },
  { code: 'customer:loyalty:redeem', description: 'Redeem own loyalty points' },
  { code: 'admin:loyalty:manage', description: 'Manage loyalty accounts and achievements' },
  { code: 'customer:wallet:read', description: 'Read own wallet' },
  { code: 'customer:wallet:transfer', description: 'Transfer funds from own wallet' },
  { code: 'customer:wallet:fund', description: 'Top up own wallet via a payment gateway' },
  {
    code: 'customer:wallet:withdraw',
    description: 'Withdraw funds from own wallet to a bank account',
  },
  { code: 'merchant:wallet:read', description: 'Read merchant wallet' },
  { code: 'rider:wallet:read', description: 'Read rider wallet' },
  { code: 'driver:wallet:read', description: 'Read driver wallet' },
  { code: 'admin:wallet:manage', description: 'Manage wallets and reconciliation' },
  {
    code: 'admin:wallet:withdrawals:manage',
    description: 'Review and complete/fail customer withdrawal requests',
  },
  { code: 'merchant:analytics:read', description: 'Read merchant analytics dashboards' },
  { code: 'admin:analytics:read', description: 'Read platform analytics dashboards' },
  { code: 'customer:notifications:read', description: 'Read own notifications' },
  { code: 'customer:notifications:manage', description: 'Manage own notification preferences' },
  { code: 'admin:notifications:manage', description: 'Manage notification templates and delivery' },
  { code: 'customer:search:use', description: 'Use customer search' },
  { code: 'admin:search:manage', description: 'Manage search documents and ranking' },
  { code: 'customer:reviews:manage', description: 'Create and manage own reviews' },
  { code: 'merchant:reviews:reply', description: 'Reply to merchant reviews' },
  { code: 'admin:reviews:moderate', description: 'Moderate customer reviews' },
  { code: 'customer:wishlist:manage', description: 'Manage own wishlists' },
  { code: 'customer:promotions:use', description: 'Use platform promotions' },
  { code: 'admin:promotions:manage', description: 'Manage platform promotions' },
  { code: 'customer:referrals:use', description: 'Read own referral code and stats' },
  { code: 'admin:referrals:manage', description: 'View referral redemptions (admin)' },
  {
    code: 'driver:referral_campaign:use',
    description: 'Use the driver growth referral campaign',
  },
  {
    code: 'admin:referral_campaigns:manage',
    description: 'Manage driver growth referral campaigns',
  },
  { code: 'admin:cms:manage', description: 'Manage CMS content' },
  { code: 'customer:cms:read', description: 'Read published CMS content' },
  { code: 'admin:fraud:manage', description: 'Manage fraud signals and lists' },
  { code: 'support:fraud:review', description: 'Review fraud signals' },
  { code: 'admin:fraud:configure', description: 'Configure fraud thresholds' },
  { code: 'merchant:onboarding:submit', description: 'Submit merchant onboarding' },
  { code: 'merchant:onboarding:approve', description: 'Approve merchant onboarding' },
  { code: 'merchant:products:manage', description: 'Manage own merchant product catalog' },
  { code: 'merchant:business:manage', description: 'Manage own merchant business profile' },
  { code: 'merchant:kyc:manage', description: 'Manage own merchant KYC documents' },
  { code: 'merchant:bank:manage', description: 'Manage own merchant bank accounts' },
  { code: 'admin:merchants:review', description: 'Review merchant onboarding applications' },
  { code: 'admin:merchants:approve', description: 'Approve merchants' },
  { code: 'admin:merchants:reject', description: 'Reject merchants' },
  { code: 'admin:merchants:suspend', description: 'Suspend merchants' },
  { code: 'admin:merchants:reactivate', description: 'Reactivate suspended merchants' },
  { code: 'rider:onboarding:submit', description: 'Submit rider onboarding' },
  { code: 'rider:onboarding:approve', description: 'Approve rider onboarding' },
  { code: 'driver:onboarding:submit', description: 'Submit driver onboarding' },
  { code: 'driver:onboarding:approve', description: 'Approve driver onboarding' },
  { code: 'driver:kyc:manage', description: 'Manage own driver KYC documents' },
  {
    code: 'driver:identity-verification:manage',
    description: 'Submit own facial/identity verification',
  },
  { code: 'customer:kyc:manage', description: 'Manage own customer identity verification (KYC)' },
  {
    code: 'admin:customer-kyc:review',
    description: 'Review customer identity verification submissions',
  },
  { code: 'admin:drivers:review', description: 'Review driver applications' },
  { code: 'admin:drivers:approve', description: 'Approve drivers' },
  { code: 'admin:drivers:reject', description: 'Reject drivers' },
  { code: 'admin:drivers:suspend', description: 'Suspend drivers' },
  { code: 'admin:drivers:reactivate', description: 'Reactivate suspended drivers' },
  // DPX-RIDER-001 — delivery-rider approval desk (mirrors admin:drivers:*).
  { code: 'admin:riders:review', description: 'Review rider applications' },
  { code: 'admin:riders:approve', description: 'Approve riders' },
  { code: 'admin:riders:reject', description: 'Reject riders' },
  { code: 'admin:riders:suspend', description: 'Suspend riders' },
  { code: 'admin:riders:reactivate', description: 'Reactivate suspended riders' },
  {
    code: 'admin:drivers:identity-verification:manage',
    description: 'Manually require or unlock a driver identity verification',
  },
  {
    code: 'admin:drivers:security-settings:manage',
    description: 'View and edit the Driver-001 Security Standard risk-engine settings',
  },
  {
    code: 'admin:merchant-settlement:commission:manage',
    description: 'View and edit the DPX-MERCHANT-002 Marketplace merchant commission rate',
  },
  {
    code: 'admin:commercial:credit-settings:manage',
    description: 'View and edit the DPX-COMMERCIAL-001 commission credit-limit policy',
  },
  {
    code: 'admin:commercial:commission-settings:manage',
    description: 'View and edit the Ops-configurable platform (ride) commission rate',
  },
  {
    code: 'admin:commercial:account:manage',
    description: 'View a commission account/ledger and record manual external payments against it',
  },
  { code: 'merchant:commercial:read', description: 'Read own commission account and ledger' },
  { code: 'driver:commercial:read', description: 'Read own commission account and ledger' },
  {
    code: 'driver:vehicle:manage',
    description: 'Manage own registered vehicles',
  },
  {
    code: 'admin:drivers:vehicles:manage',
    description: 'Approve or reject driver-submitted vehicles',
  },
  {
    code: 'driver:inspection:manage',
    description: 'Book and view own vehicle/driver inspection appointments',
  },
  {
    code: 'admin:inspection-centres:manage',
    description: 'Create and manage DrippleX inspection centres',
  },
  {
    code: 'inspection:checklist:manage',
    description: 'Record an inspection checklist, photos, and defects (Inspection Officer)',
  },
  {
    code: 'inspection:approve',
    description:
      'Approve/reject inspections, schedule re-inspections, view full inspection history (Inspection Supervisor)',
  },
  {
    code: 'driver:support-ticket:manage',
    description: 'Submit and view own driver support tickets',
  },
  {
    code: 'admin:drivers:support-ticket:manage',
    description: 'View and resolve the driver support ticket queue',
  },
  {
    code: 'driver:incident-report:manage',
    description: 'Submit and view own driver incident reports',
  },
  {
    code: 'admin:drivers:incident-report:manage',
    description: 'View and acknowledge/resolve the driver incident report queue',
  },
  {
    code: 'driver:sos-alert:manage',
    description: 'Trigger and view own SOS/emergency alerts',
  },
  {
    code: 'admin:drivers:sos-alert:manage',
    description: 'View and acknowledge/resolve the driver SOS/emergency alert queue',
  },
  {
    code: 'driver:shift:manage',
    description: 'Start/end own shifts, manage own break mode and planned availability',
  },
  {
    code: 'admin:drivers:shifts:manage',
    description: 'View driver shift/planned-availability queues and force-end abandoned shifts',
  },
  {
    code: 'driver:help:read',
    description: 'Browse the driver Help Centre (FAQ/articles) — authoring uses admin:cms:manage',
  },
  {
    code: 'driver:profile:manage',
    description:
      'Update own profile (name, photo, languages, service areas, driving experience) and view own performance stats',
  },
  { code: 'admin:rides:support', description: 'Review and resolve ride problem reports' },
  {
    code: 'operations:live:read',
    description:
      'View the Operations Console Live Operations Dashboard — fleet snapshot and live ride queue',
  },
  {
    code: 'operations:queues:read',
    description:
      'View the Operations Console work queues (SOS, Incidents, Support) and dashboard counters/activity feed',
  },
  {
    code: 'operations:queues:manage',
    description:
      'Assign, prioritize, change status, and add notes on Operations Console work-queue cases',
  },
  {
    code: 'operations:analytics:read',
    description:
      'View the Operations Console analytics dashboard — driver utilization, shift, ride, dispatch, response-time, and geographic-demand analytics',
  },
  { code: 'users:read', description: 'Read user records' },
  { code: 'users:write', description: 'Update user records' },
  { code: 'users:delete', description: 'Soft-delete user records' },
  { code: 'users:roles:assign', description: 'Assign or remove user roles' },
  { code: 'roles:read', description: 'Read roles' },
  { code: 'roles:write', description: 'Create and update roles' },
  { code: 'permissions:read', description: 'Read permissions catalog' },
  { code: 'audit:read', description: 'Read audit logs' },
  { code: 'platform:settings:write', description: 'Update platform settings' },
];
