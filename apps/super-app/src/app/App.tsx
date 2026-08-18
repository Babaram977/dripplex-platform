import React, { useEffect, useRef, useState } from 'react';
import { ApiProvider } from '../lib/ApiProvider';
import { GLOBAL_STYLES, NAVY_BASE, COUNTRIES } from './shared';
import {
  SplashScreen,
  WelcomeScreen,
  RegisterScreen,
  OTPScreen,
  ProfileSetupScreen,
  PermissionsScreen,
  ReturningLoginScreen,
  RecoveryScreen,
  SignInScreen,
} from './screensA';
import {
  TwoFactorScreen,
  TrustedDevicesScreen,
  SecurityActivityScreen,
  SecurityCenterScreen,
  SessionManagementScreen,
  PrivacyControlsScreen,
  IdentityVerificationScreen,
  AccountManagementScreen,
} from './screensB';
import {
  ConsentScreen,
  NotificationPrefsScreen,
  LanguageRegionScreen,
  AccessibilityScreen,
  WelcomeDrippleXScreen,
  LinkedAccountsScreen,
  VerificationStatusScreen,
  EmergencyProtectionScreen,
  ActivityDashboardScreen,
  ConnectedServicesScreen,
  TrustCenterScreen,
} from './screensC';
import {
  PinSetupScreen,
  ChangePinScreen,
  EmailVerificationScreen,
  ChangePhoneScreen,
  UsernameManagementScreen,
  LoginApprovalsScreen,
  RecoveryCodesScreen,
  SecurityQuestionsScreen,
  AccountTransferScreen,
  AccountSuspensionScreen,
  AuthSummaryScreen,
} from './screensD';
// Feature modules — new screens import via src/features/<MODULE>/index.ts
import { HomeScreen } from '../features/HOME';
import {
  UtilitiesHomeScreen,
  UtilityHistoryScreen,
  UtilityPurchaseScreen,
  UtilityReceiptScreen,
} from './utilitiesScreen';
import { MarketplaceScreen } from '../features/MARKETPLACE';
import { StoreScreen } from '../features/STORE';
import { ProductDetailScreen } from '../features/PRODUCT';
import { CartScreen } from '../features/CART';
import { CheckoutScreen } from '../features/CHECKOUT';
import { TrackingScreen, OrderHistoryScreen } from '../features/ORDERS';
import {
  RideHomeScreen,
  DestinationSearchScreen,
  PickupConfirmScreen,
  FareEstimateScreen,
  FindingDriverScreen,
  type RideDestination,
  useDevicePickup,
  DriverAssignedScreen,
  DriverArrivedScreen,
  RideInProgressScreen,
  TripCompletedScreen,
  RateDriverScreen,
  RideHistoryScreen,
  RideDetailScreen,
  DriverProfileSheet,
  PaymentScreen,
  OPayPaymentScreen,
  CashPaymentScreen,
  TipDriverScreen,
  ReportTripScreen,
  SavedPlacesScreen,
  ScheduleRideScreen,
  PromoCodeScreen,
  ReferralScreen,
  EmergencySOSScreen,
  ShareTripScreen,
  TripReceiptScreen,
  RideHomeExtendedScreen,
  LiveTrackingScreen,
  DriverEnRouteScreen,
  PassengerWaitingScreen,
  DriverArrivedExtendedScreen,
  WalletPaySuccessScreen,
} from '../features/RIDE';
import {
  DriverSplashScreen,
  DriverLoginScreen,
  DriverOTPScreen,
  DriverKYCStatusScreen,
  DriverUploadDocsScreen,
  DriverInspectionScreen,
  DriverVehicleRegScreen,
  DriverDashboardScreen,
  DriverIncomingRequestScreen,
  DriverNavToPickupScreen,
  DriverPassengerVerifyScreen,
  DriverTripInProgressScreen,
  DriverTripCompletedScreen,
  DriverSettingsScreen,
  EmergencyContactScreen,
  AgreementAcceptanceScreen,
} from '../features/DRIVER';
import {
  WalletHomeScreen,
  TransactionHistoryScreen,
  TopUpScreen,
  WithdrawScreen,
  TransferScreen,
  PaymentMethodsScreen,
  RewardsScreen,
  WalletStatementScreen,
  WalletSecurityScreen,
  WalletSettingsScreen,
} from '../features/WALLET';
import {
  AdminDashboardScreen,
  AdminLiveMapScreen,
  AdminTripsScreen,
  AdminDriversScreen,
  AdminKYCScreen,
  AdminVehiclesScreen,
  AdminCustomersScreen,
  AdminPricingScreen,
  AdminIncidentsScreen,
  AdminSupportScreen,
  AdminAnalyticsScreen,
  AdminReportsScreen,
  AdminSettingsScreen,
  AdminAuditScreen,
  AdminProfileScreen,
} from '../features/ADMIN';
import {
  MerchantDashboardScreen,
  MerchantOrdersScreen,
  MerchantProductsScreen,
  MerchantStoreScreen,
  MerchantEarningsScreen,
  MerchantKYCScreen,
  MerchantBankScreen,
  MerchantApprovalScreen,
} from './merchantScreen';
import {
  RiderLoginScreen,
  RiderDashboardScreen,
  RiderJobScreen,
  RiderAccountScreen,
  RiderEarningsScreen,
} from './riderScreen';
import {
  PartnerChoiceScreen,
  MerchantSignUpScreen,
  DriverSignUpScreen,
  RiderSignUpScreen,
  DriverDocumentsScreen,
  RiderDocumentsScreen,
  BusinessDetailsScreen,
  PendingReviewScreen,
} from './onboardingScreen';
import type { PartnerPersona } from './onboardingScreen';
import { ChatScreen } from './chatScreen';
import { api } from '../lib/api';
import type {
  DeliveryJobDto,
  RideOfferDto,
  RideDto,
  UtilityPurchaseDto,
  UtilityServiceType,
} from '../lib/api';
import { endSession } from '../lib/auth';
import { installUnlockListener } from '../lib/sound';

// DESKTOP FRAME — for admin operations console
// ═══════════════════════════════════════════════════════════════════════════
function DesktopFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative flex flex-col overflow-hidden"
      style={{
        width: 1100,
        height: 'min(700px, 100dvh - 24px)',
        borderRadius: 16,
        boxShadow: `0 0 0 1.5px rgba(255,255,255,.09),0 0 0 10px #07080F,0 0 0 11.5px rgba(255,255,255,.05),0 60px 140px rgba(0,0,0,.85),0 0 120px rgba(43,172,82,.07)`,
      }}
    >
      {/* macOS-style window chrome */}
      <div
        className="flex items-center gap-2 px-4"
        style={{
          height: 36,
          background: '#040A14',
          borderBottom: '1px solid rgba(255,255,255,.06)',
        }}
      >
        <div className="h-3 w-3 rounded-full" style={{ background: '#EF4444' }} />
        <div className="h-3 w-3 rounded-full" style={{ background: '#F59E0B' }} />
        <div className="h-3 w-3 rounded-full" style={{ background: '#10B981' }} />
        <div className="flex flex-1 justify-center">
          <div
            className="flex items-center gap-1.5 rounded px-3"
            style={{ background: 'rgba(255,255,255,.04)', height: 20 }}
          >
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,.3)' }}>🔒</span>
            <span
              style={{
                fontFamily: "'Inter',sans-serif",
                fontSize: 9,
                color: 'rgba(255,255,255,.3)',
              }}
            >
              console.dripplexapp.com
            </span>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

// PHONE FRAME
// ═══════════════════════════════════════════════════════════════════════════
function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: 390,
        // Single definite height so the child screen's `h-full` resolves to the
        // SAME value the frame is clipped to. Previously height:844 + a separate
        // maxHeight:90dvh let the screen render 844px tall inside a shorter
        // clipped frame, pushing the sticky "Proceed to Checkout" bar below the
        // frame's overflow:hidden edge (it disappeared on short viewports).
        height: 'min(844px, 100dvh - 24px)',
        borderRadius: 52,
        background: NAVY_BASE,
        boxShadow: `0 0 0 1.5px rgba(255,255,255,.09),0 0 0 12px #07080F,0 0 0 13.5px rgba(255,255,255,.055),0 60px 140px rgba(0,0,0,.85),0 0 120px rgba(43,172,82,.07)`,
      }}
    >
      <div
        className="absolute left-1/2 top-3.5 z-50 -translate-x-1/2 rounded-full"
        style={{
          width: 120,
          height: 36,
          background: '#000',
          boxShadow: '0 0 0 1px rgba(255,255,255,.05)',
        }}
      />
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// APP ROOT
// ═══════════════════════════════════════════════════════════════════════════
type Screen =
  | 'splash'
  | 'welcome'
  | 'register'
  | 'otp'
  | 'profile'
  | 'permissions'
  | 'returning'
  | 'recovery'
  | 'signin'
  | 'twofa'
  | 'devices'
  | 'activity'
  | 'security'
  | 'sessions'
  | 'privacy'
  | 'kyc'
  | 'account'
  | 'consent'
  | 'notifprefs'
  | 'langregion'
  | 'accessibility'
  | 'onboarddone'
  | 'linked'
  | 'verifstatus'
  | 'emergency'
  | 'activitydash'
  | 'services'
  | 'trust'
  | 'pinsetup'
  | 'changepin'
  | 'emailverify'
  | 'changephone'
  | 'username'
  | 'loginapproval'
  | 'recoverycodes'
  | 'securityqs'
  | 'acctransfer'
  | 'suspension'
  | 'authsummary'
  | 'home'
  | 'marketplace'
  | 'store'
  | 'productdetail'
  | 'cart'
  | 'checkout'
  | 'ordertracking'
  | 'orderhistory'
  | 'ridehome'
  | 'ridesearch'
  | 'ridepickup'
  | 'ridefare'
  | 'ridefinding'
  | 'rideassigned'
  | 'ridearrived'
  | 'rideinprogress'
  | 'ridecomplete'
  | 'riderating'
  | 'ridehistory'
  | 'ridedetail'
  | 'ridehomeplus'
  | 'ridelivetrack'
  | 'rideenroute'
  | 'ridepaxwait'
  | 'ridearrivedplus'
  | 'ridedriver'
  | 'ridepayment'
  | 'rideopay'
  | 'ridecash'
  | 'ridetip'
  | 'ridereport'
  | 'ridesaved'
  | 'rideschedule'
  | 'ridepromo'
  | 'ridereferral'
  | 'ridesos'
  | 'rideshare'
  | 'ridereceipt'
  | 'ridepaysuccess'
  | 'drvsplash'
  | 'drvlogin'
  | 'drvotp'
  | 'drvkyc'
  | 'drvuploaddocs'
  | 'drvvehicle'
  | 'drvinspection'
  | 'drvemergency'
  | 'drvagree'
  | 'drvdash'
  | 'drvrequest'
  | 'drvtopickup'
  | 'drvverify'
  | 'drvtripactive'
  | 'drvtripdone'
  | 'drvsettings'
  | 'wallethome'
  | 'utilities'
  | 'utilitybuy'
  | 'utilityreceipt'
  | 'utilityhistory'
  | 'wallettx'
  | 'wallettopup'
  | 'walletwithdraw'
  | 'wallettransfer'
  | 'walletpay'
  | 'walletrewards'
  | 'walletstatement'
  | 'walletsecurity'
  | 'walletsettings'
  | 'admindash'
  | 'adminmap'
  | 'admintrips'
  | 'admindrivers'
  | 'adminkyc'
  | 'adminvehicles'
  | 'admincustomers'
  | 'adminpricing'
  | 'adminincidents'
  | 'adminsupport'
  | 'adminanalytics'
  | 'adminreports'
  | 'adminsettings'
  | 'adminaudit'
  | 'adminprofile'
  | 'mxdash'
  | 'mxorders'
  | 'mxproducts'
  | 'mxstore'
  | 'mxearnings'
  | 'mxkyc'
  | 'mxbank'
  | 'mxapproval'
  | 'riderlogin'
  | 'riderdash'
  | 'riderjob'
  | 'riderearnings'
  | 'rideraccount'
  | 'chat'
  | 'partnerselect'
  | 'partnermerchant'
  | 'partnerdriver'
  | 'partnerrider'
  | 'partnerdocs'
  | 'riderdocs'
  | 'partnerbusiness'
  | 'partnerreview';

/**
 * Front doors for the non-customer surfaces.
 *
 * Everything lives in one super-app, but only the customer journey had a way in:
 * the Ops Console, Merchant Portal, Rider and Driver apps were reachable solely
 * through the Design Preview sidebar, which is a developer affordance and is off
 * in production. Operations staff and partners get a real link instead.
 *
 * Each target is the surface's own front door and carries its own sign-in gate
 * (the Ops Console checks for the operations role before it renders anything),
 * so a URL grants no access by itself.
 */
const PORTAL_ROUTES: Record<string, Screen> = {
  ops: 'admindash',
  merchant: 'mxdash',
  rider: 'riderlogin',
  driver: 'drvlogin',
};

/**
 * The portal a visitor asked for, from the path (/ops) or the query (?app=ops).
 * The query form exists for hosts that do not rewrite unknown paths to
 * index.html; this one does (`serve -s`), so /ops is the link to share.
 */
function initialScreenFromLocation(): Screen | null {
  if (typeof window === 'undefined') return null;
  const fromPath = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  const fromQuery = (new URLSearchParams(window.location.search).get('app') ?? '').toLowerCase();
  return PORTAL_ROUTES[fromPath] ?? PORTAL_ROUTES[fromQuery] ?? null;
}

function AppShell() {
  // Browsers hold audio back until the user has interacted with the page, so
  // the very first alert of a session would otherwise be silent. This arms the
  // audio context on the first tap or key anywhere in the app — long before a
  // job or an order arrives.
  useEffect(() => installUnlockListener(), []);

  // A portal link opens that portal; everything else starts the customer journey
  // at the splash screen exactly as before.
  const [screen, setScreen] = useState<Screen>(() => initialScreenFromLocation() ?? 'splash');
  const [rideDetailId, setRideDetailId] = useState<string>('');
  const [fading, setFading] = useState(false);
  const [otpData, setOtpData] = useState<{
    phone: string;
    country: (typeof COUNTRIES)[0];
    email?: string;
    verifyChannel?: 'email' | 'phone';
    // Held in memory only for the register → OTP → login handoff. Never persisted.
    password?: string;
    // Which portal to log in through after the email code verifies. 'customer'
    // (default) for consumer signup; a partner persona for partner onboarding.
    persona?: 'customer' | 'merchant' | 'driver' | 'rider';
  }>({
    // Never pre-fill a demo phone number — the customer types their own.
    phone: '',
    country: COUNTRIES[0],
  });
  const [partnerPersona, setPartnerPersona] = useState<PartnerPersona>('merchant');
  // Where the partner hub was opened from, so its back button returns there.
  // null when the hub is reached mid-onboarding (no back affordance then).
  const [partnerFrom, setPartnerFrom] = useState<Screen | null>(null);
  // Which login the password-reset flow was opened from, so it returns there.
  const [recoveryFrom, setRecoveryFrom] = useState<Screen>('returning');
  // Emergency contact and the driver agreement are reachable from two places —
  // the onboarding hub and the document screen that refuses to submit without
  // them — so remember where the driver came from and put them back there.
  const [driverStepReturn, setDriverStepReturn] = useState<Screen>('drvkyc');
  // DPX-CHAT-001 — which conversation is open, and who it is with. A thread is
  // always anchored to a live delivery or ride; there is no inbox.
  const [chat, setChat] = useState<{
    context: 'delivery' | 'ride';
    contextId: string;
    title: string;
    back: Screen;
  } | null>(null);
  // Merchant's business fields from sign-up, pre-filled into the post-login
  // Business Details step (persisted via PATCH /merchant/business).
  const [merchantBiz, setMerchantBiz] = useState<{ businessName: string; category: string }>({
    businessName: '',
    category: '',
  });
  const [activeRiderJob, setActiveRiderJob] = useState<DeliveryJobDto | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [activeMerchantId, setActiveMerchantId] = useState<string | undefined>(undefined);
  const [activeProductId, setActiveProductId] = useState<string | undefined>(undefined);
  const [activeDriverOffer, setActiveDriverOffer] = useState<RideOfferDto | null>(null);
  const [activeDriverRide, setActiveDriverRide] = useState<RideDto | null>(null);
  const [rideDest, setRideDest] = useState<RideDestination | undefined>(undefined);
  // The passenger's REAL pickup, resolved from the device. Every ride used to
  // be booked from a hardcoded "Ikeja GRA, Lagos" regardless of where the
  // passenger stood, and the pickup row could not be changed.
  const ridePickup = useDevicePickup();
  const [activeCustomerRideId, setActiveCustomerRideId] = useState<string | undefined>(undefined);

  // Utilities. `activeUtilityService` is which of the four the customer
  // picked; `activeUtilityPurchase` is the receipt they are looking at —
  // reachable both straight after paying and from history, because an
  // electricity token that can only be seen once is money lost when the app
  // is closed.
  const [activeUtilityService, setActiveUtilityService] = useState<UtilityServiceType>('AIRTIME');
  const [activeUtilityPurchase, setActiveUtilityPurchase] = useState<UtilityPurchaseDto | null>(
    null,
  );

  /**
   * Where the user came from.
   *
   * The app is a screen-key state machine with no history, so every Back
   * button used to be a hard-coded guess at the previous screen — and several
   * of those guesses were auth screens. A signed-in customer tapping Back on
   * Manage Account landed on "Welcome back — sign in"; a signed-in driver
   * tapping Back on their onboarding hub landed on an OTP screen with no code
   * to enter. Neither was logged out, but both were stranded outside the app
   * with no way in, which is indistinguishable from being logged out.
   *
   * A ref rather than state: the stack must never trigger a re-render, and it
   * is only ever read inside an event handler.
   */
  const historyRef = useRef<Screen[]>([]);

  const navigate = (to: Screen) => {
    setFading(true);
    setTimeout(() => {
      setScreen(to);
      setFading(false);
    }, 220);
  };

  const go = (to: Screen) => {
    if (screen !== to) {
      historyRef.current.push(screen);
      // A wandering session should not grow without bound.
      if (historyRef.current.length > 50) historyRef.current.shift();
    }
    navigate(to);
  };

  /**
   * Back: return where they actually came from, falling back to a sensible
   * home for this persona when there is no history (a deep link, or a reload).
   */
  const goBack = (fallback: Screen) => {
    const previous = historyRef.current.pop();
    navigate(previous ?? fallback);
  };

  /**
   * Cross an authentication boundary. Signing in or out makes the previous
   * history meaningless and, worse, walkable: without this, Back from the
   * home screen would return to the sign-in form, and Back after signing out
   * would walk into the signed-in app.
   */
  const goAfterAuthChange = (to: Screen) => {
    historyRef.current = [];
    navigate(to);
  };

  const screens: Record<Screen, React.ReactNode> = {
    splash: <SplashScreen onDone={() => go('welcome')} />,
    welcome: (
      <WelcomeScreen
        onGetStarted={() => go('register')}
        onSignIn={() => go('signin')}
        onPartner={() => go('partnerselect')}
      />
    ),
    register: (
      <RegisterScreen
        onContinue={({ email, phone, country, password, verifyChannel }) => {
          setOtpData({ email, phone, country, password, verifyChannel });
          go('otp');
        }}
        onSignIn={() => go('signin')}
        onBack={() => go('welcome')}
      />
    ),
    otp: (
      <OTPScreen
        phone={otpData.phone}
        country={otpData.country}
        email={otpData.email}
        verifyChannel={otpData.verifyChannel}
        password={otpData.password}
        persona={otpData.persona}
        onBack={() =>
          go(otpData.persona && otpData.persona !== 'customer' ? 'partnerselect' : 'register')
        }
        onChangeNumber={() =>
          go(otpData.persona && otpData.persona !== 'customer' ? 'partnerselect' : 'register')
        }
        onVerified={() =>
          go(
            otpData.persona === 'merchant'
              ? 'partnerbusiness'
              : otpData.persona === 'driver'
                ? 'partnerdocs'
                : otpData.persona === 'rider'
                  ? 'riderdocs'
                  : 'profile',
          )
        }
      />
    ),
    profile: (
      <ProfileSetupScreen
        onContinue={() => go('permissions')}
        onSkip={() => go('permissions')}
        onBack={() => go('otp')}
      />
    ),
    permissions: (
      <PermissionsScreen
        onContinue={() => go('consent')}
        onSkip={() => go('consent')}
        onBack={() => go('profile')}
      />
    ),
    // "Returning" routes to the REAL email/password sign-in (the biometric
    // ReturningLoginScreen is a mock with no backend — do not use it for auth).
    returning: (
      <SignInScreen
        onBack={() => goBack('welcome')}
        onSuccess={() => goAfterAuthChange('home')}
        onMerchant={() => go('mxdash')}
        onDriver={() => go('drvlogin')}
        onBecomePartner={() => {
          setPartnerFrom('returning');
          go('partnerselect');
        }}
        onForgot={() => {
          setRecoveryFrom('returning');
          go('recovery');
        }}
      />
    ),
    recovery: (
      <RecoveryScreen onRecovered={() => go(recoveryFrom)} onBack={() => go(recoveryFrom)} />
    ),
    signin: (
      <SignInScreen
        onBack={() => goBack('welcome')}
        onSuccess={() => goAfterAuthChange('home')}
        onMerchant={() => go('mxdash')}
        onDriver={() => go('drvlogin')}
        onBecomePartner={() => {
          setPartnerFrom('signin');
          go('partnerselect');
        }}
        onForgot={() => {
          setRecoveryFrom('signin');
          go('recovery');
        }}
      />
    ),
    twofa: <TwoFactorScreen onBack={() => go('security')} onDone={() => go('security')} />,
    devices: <TrustedDevicesScreen onBack={() => go('security')} />,
    activity: (
      <SecurityActivityScreen onBack={() => go('security')} onSecure={() => go('security')} />
    ),
    security: (
      <SecurityCenterScreen onBack={() => goBack('account')} onNav={(s) => go(s as Screen)} />
    ),
    sessions: <SessionManagementScreen onBack={() => go('security')} />,
    privacy: <PrivacyControlsScreen onBack={() => go('account')} />,
    kyc: <IdentityVerificationScreen onBack={() => go('account')} />,
    account: (
      <AccountManagementScreen
        onSignOut={() => goAfterAuthChange('welcome')}
        onBack={() => goBack('home')}
        onKYC={() => go('kyc')}
        onSecurity={() => go('security')}
        onPrivacy={() => go('privacy')}
        onSessions={() => go('sessions')}
        onLinked={() => go('linked')}
        onVerifStatus={() => go('verifstatus')}
        onActivity={() => go('activitydash')}
        onServices={() => go('services')}
        onTrust={() => go('trust')}
        onPinSetup={() => go('pinsetup')}
        onEmailVerify={() => go('emailverify')}
        onChangePhone={() => go('changephone')}
        onUsername={() => go('username')}
        onRecoveryCodes={() => go('recoverycodes')}
        onSecurityQs={() => go('securityqs')}
        onAccTransfer={() => go('acctransfer')}
        onSuspension={() => go('suspension')}
        onAuthSummary={() => go('authsummary')}
      />
    ),
    consent: <ConsentScreen onAccept={() => go('notifprefs')} onLater={() => go('notifprefs')} />,
    notifprefs: (
      <NotificationPrefsScreen onBack={() => go('consent')} onSave={() => go('langregion')} />
    ),
    langregion: (
      <LanguageRegionScreen onBack={() => go('notifprefs')} onSave={() => go('accessibility')} />
    ),
    accessibility: (
      <AccessibilityScreen onBack={() => go('langregion')} onApply={() => go('onboarddone')} />
    ),
    onboarddone: (
      <WelcomeDrippleXScreen
        onHome={() => go('home')}
        onTour={() => go('home')}
        onQuickStart={(key) =>
          go(
            key === 'marketplace'
              ? 'marketplace'
              : key === 'ride'
                ? 'ridehome'
                : key === 'wallet'
                  ? 'wallethome'
                  : 'partnerselect',
          )
        }
      />
    ),
    linked: <LinkedAccountsScreen onBack={() => go('account')} />,
    verifstatus: (
      <VerificationStatusScreen onBack={() => go('account')} onContinue={() => go('kyc')} />
    ),
    emergency: <EmergencyProtectionScreen onBack={() => go('security')} />,
    activitydash: <ActivityDashboardScreen onBack={() => go('account')} />,
    services: <ConnectedServicesScreen onBack={() => go('account')} />,
    trust: (
      <TrustCenterScreen
        onBack={() => goBack('account')}
        onSecurity={() => go('security')}
        onAddEmail={() => go('emailverify')}
        onVerifyId={() => go('kyc')}
      />
    ),
    pinsetup: <PinSetupScreen onBack={() => go('account')} onDone={() => go('account')} />,
    changepin: <ChangePinScreen onBack={() => go('account')} onDone={() => go('account')} />,
    emailverify: (
      <EmailVerificationScreen onBack={() => go('account')} onDone={() => go('account')} />
    ),
    changephone: <ChangePhoneScreen onBack={() => go('account')} onDone={() => go('account')} />,
    username: (
      <UsernameManagementScreen onBack={() => go('account')} onSave={() => go('account')} />
    ),
    loginapproval: <LoginApprovalsScreen onBack={() => go('security')} />,
    recoverycodes: <RecoveryCodesScreen onBack={() => go('account')} />,
    securityqs: (
      <SecurityQuestionsScreen onBack={() => go('account')} onSave={() => go('account')} />
    ),
    acctransfer: <AccountTransferScreen onBack={() => go('account')} />,
    suspension: <AccountSuspensionScreen onBack={() => go('account')} />,
    authsummary: (
      <AuthSummaryScreen
        onBack={() => go('account')}
        onFinish={() => go('home')}
        onAddEmail={() => go('emailverify')}
        onRecoveryCodes={() => go('recoverycodes')}
        onVerifyId={() => go('kyc')}
      />
    ),
    home: (
      <HomeScreen
        onAccount={() => go('account')}
        onSecurity={() => go('security')}
        onNotifications={() => go('activitydash')}
        onMarketplace={() => go('marketplace')}
        onRide={() => go('ridehome')}
        onDriverApp={() => go('drvsplash')}
        onStore={(id) => {
          setActiveMerchantId(id);
          go('store');
        }}
        onWallet={() => go('wallethome')}
        onUtilities={() => go('utilities')}
        onOrders={() => go('orderhistory')}
        onTrackOrder={(id) => {
          setActiveOrderId(id);
          go('ordertracking');
        }}
        onBecomePartner={() => {
          setPartnerFrom('home');
          go('partnerselect');
        }}
        onWalletAction={(a) =>
          go(
            a === 'send'
              ? 'wallettransfer'
              : a === 'topup'
                ? 'wallettopup'
                : a === 'pay'
                  ? 'walletpay'
                  : 'wallethome',
          )
        }
      />
    ),
    marketplace: (
      <MarketplaceScreen
        onBack={() => go('home')}
        onHome={() => go('home')}
        onAccount={() => go('account')}
        onNotifications={() => go('activitydash')}
        onCart={() => go('cart')}
        onStore={(id) => {
          setActiveMerchantId(id);
          go('store');
        }}
      />
    ),
    store: (
      <StoreScreen
        onBack={() => go('marketplace')}
        onHome={() => go('home')}
        onAccount={() => go('account')}
        onNotifications={() => go('activitydash')}
        onCart={() => go('cart')}
        merchantId={activeMerchantId}
        onProduct={(p) => {
          setActiveProductId(p?.id);
          go('productdetail');
        }}
      />
    ),
    productdetail: (
      <ProductDetailScreen
        onBack={() => go('store')}
        onHome={() => go('home')}
        onAccount={() => go('account')}
        onNotifications={() => go('activitydash')}
        onCart={() => go('cart')}
        onCheckout={() => go('checkout')}
        productId={activeProductId}
        merchantId={activeMerchantId}
      />
    ),
    cart: (
      <CartScreen
        // Back to browsing, not to Product Detail — the cart is reachable from
        // the bottom nav/home, where there is no active product, and routing
        // there without a productId used to render an empty/placeholder product.
        onBack={() => go('marketplace')}
        onHome={() => go('home')}
        onAccount={() => go('account')}
        onNotifications={() => go('activitydash')}
        onCheckout={() => go('checkout')}
      />
    ),
    checkout: (
      <CheckoutScreen
        onBack={() => go('cart')}
        onHome={() => go('home')}
        onAccount={() => go('account')}
        onNotifications={() => go('activitydash')}
        onOrderTracking={(id) => {
          setActiveOrderId(id);
          go('ordertracking');
        }}
      />
    ),
    ordertracking: (
      <TrackingScreen
        onBack={() => go('home')}
        onHome={() => go('home')}
        onAccount={() => go('account')}
        onNotifications={() => go('activitydash')}
        onHistory={() => go('orderhistory')}
        onMessageRider={(deliveryJobId, riderName) => {
          setChat({
            context: 'delivery',
            contextId: deliveryJobId,
            title: riderName,
            back: 'ordertracking',
          });
          go('chat');
        }}
        orderId={activeOrderId ?? undefined}
      />
    ),
    chat: chat ? (
      <ChatScreen
        context={chat.context}
        contextId={chat.contextId}
        title={chat.title}
        subtitle={chat.context === 'delivery' ? 'About your delivery' : 'About your trip'}
        onBack={() => go(chat.back)}
      />
    ) : (
      <HomeScreen
        onSearch={() => go('marketplace')}
        onCart={() => go('cart')}
        onAccount={() => go('account')}
        onNotifications={() => go('activitydash')}
      />
    ),
    orderhistory: (
      <OrderHistoryScreen
        onBack={() => go('home')}
        onOrder={(id) => {
          setActiveOrderId(id);
          go('ordertracking');
        }}
      />
    ),
    // ── RIDE module ──────────────────────────────────────────────────────────
    ridehome: (
      <RideHomeScreen
        onBack={() => go('home')}
        onSearch={() => go('ridesearch')}
        onHistory={() => go('ridehistory')}
        pickup={ridePickup.pickup}
      />
    ),
    ridesearch: (
      <DestinationSearchScreen
        onBack={() => go('ridehome')}
        onSelect={(dest) => {
          setRideDest(dest);
          go('ridepickup');
        }}
        pickup={ridePickup.pickup}
        onPickupChange={ridePickup.setPickup}
        pickupResolving={ridePickup.resolving}
        pickupError={ridePickup.error}
        onLocateMe={ridePickup.locate}
      />
    ),
    ridepickup: (
      <PickupConfirmScreen
        onBack={() => go('ridesearch')}
        onConfirm={() => go('ridefare')}
        pickup={ridePickup.pickup}
        dropoff={rideDest}
      />
    ),
    ridefare: (
      <FareEstimateScreen
        onBack={() => go('ridepickup')}
        dropoff={rideDest}
        pickup={ridePickup.pickup}
        rideType="ECONOMY"
        onBook={(rideId) => {
          setActiveCustomerRideId(rideId);
          go('ridefinding');
        }}
      />
    ),
    ridefinding: (
      <FindingDriverScreen
        onBack={() => go('ridehome')}
        rideId={activeCustomerRideId}
        onFound={() => go('rideassigned')}
      />
    ),
    rideassigned: (
      <DriverAssignedScreen
        onBack={() => go('ridefare')}
        onArrived={() => go('ridearrived')}
        onCancel={() => go('ridehome')}
        rideId={activeCustomerRideId}
        onMessageDriver={(rideId, driverName) => {
          setChat({
            context: 'ride',
            contextId: rideId,
            title: driverName ?? 'Your driver',
            back: 'rideassigned',
          });
          go('chat');
        }}
      />
    ),
    ridearrived: (
      <DriverArrivedScreen
        onBack={() => go('rideassigned')}
        onStart={() => go('rideinprogress')}
        onShare={() => go('rideshare')}
        rideId={activeCustomerRideId}
      />
    ),
    rideinprogress: (
      <RideInProgressScreen
        onBack={() => go('ridearrived')}
        onComplete={() => go('ridecomplete')}
        onSOS={() => go('ridesos')}
        rideId={activeCustomerRideId}
      />
    ),
    ridecomplete: (
      <TripCompletedScreen
        onRate={() => go('riderating')}
        onHome={() => go('home')}
        onTip={() => go('ridetip')}
        rideId={activeCustomerRideId}
      />
    ),
    riderating: (
      <RateDriverScreen
        onBack={() => go('ridecomplete')}
        onSubmit={() => go('home')}
        rideId={activeCustomerRideId}
      />
    ),
    ridehistory: (
      <RideHistoryScreen
        onBack={() => go('ridehome')}
        onDetail={(id) => {
          setRideDetailId(id);
          go('ridedetail');
        }}
      />
    ),
    ridedetail: (
      <RideDetailScreen
        onBack={() => go('ridehistory')}
        rideId={rideDetailId}
        onRebook={() => go('ridehome')}
        onReport={() => go('ridereport')}
      />
    ),
    // ── Extended Ride screens ────────────────────────────────────────────────
    ridehomeplus: (
      <RideHomeExtendedScreen
        onBack={() => go('home')}
        onSearch={() => go('ridesearch')}
        onSchedule={() => go('rideschedule')}
        onHistory={() => go('ridehistory')}
        onSavedPlaces={() => go('ridesaved')}
        onPromo={() => go('ridepromo')}
        onReferral={() => go('ridereferral')}
        onSOS={() => go('ridesos')}
      />
    ),
    ridelivetrack: (
      <LiveTrackingScreen
        onBack={() => go('rideinprogress')}
        onShare={() => go('rideshare')}
        onSOS={() => go('ridesos')}
        onChat={() => go('rideinprogress')}
      />
    ),
    rideenroute: (
      <DriverEnRouteScreen
        onBack={() => go('ridefinding')}
        onContact={() => go('rideassigned')}
        onCancel={() => go('ridehome')}
      />
    ),
    ridepaxwait: (
      <PassengerWaitingScreen
        onBack={() => go('rideassigned')}
        onContact={() => go('rideassigned')}
        onBoard={() => go('rideinprogress')}
      />
    ),
    ridearrivedplus: (
      <DriverArrivedExtendedScreen
        onBack={() => go('rideassigned')}
        onStart={() => go('rideinprogress')}
        onReport={() => go('ridereport')}
      />
    ),
    ridedriver: (
      <DriverProfileSheet
        onBack={() => go('rideassigned')}
        onMessage={() => {
          if (activeCustomerRideId) {
            setChat({
              context: 'ride',
              contextId: activeCustomerRideId,
              title: 'Your driver',
              back: 'ridedriver',
            });
            go('chat');
          } else {
            go('rideassigned');
          }
        }}
      />
    ),
    ridepayment: (
      <PaymentScreen
        onBack={() => go('ridefare')}
        onPay={() => go('ridepaysuccess')}
        onChangeMethod={() => go('ridepayment')}
      />
    ),
    rideopay: (
      <OPayPaymentScreen onBack={() => go('ridepayment')} onSuccess={() => go('ridepaysuccess')} />
    ),
    ridecash: (
      <CashPaymentScreen
        onBack={() => go('ridepayment')}
        onConfirm={() => go('ridepaysuccess')}
        rideId={activeCustomerRideId}
      />
    ),
    ridetip: (
      <TipDriverScreen
        onBack={() => go('ridecomplete')}
        onSubmit={() => go('riderating')}
        onSkip={() => go('riderating')}
        rideId={activeCustomerRideId}
      />
    ),
    ridereport: (
      <ReportTripScreen onBack={() => go('ridedetail')} onSubmit={() => go('ridehistory')} />
    ),
    ridesaved: <SavedPlacesScreen onBack={() => go('ridehome')} onAdd={() => go('ridesaved')} />,
    rideschedule: (
      <ScheduleRideScreen onBack={() => go('ridehome')} onConfirm={() => go('ridefare')} />
    ),
    ridepromo: (
      <PromoCodeScreen onBack={() => go('ridepayment')} onApply={() => go('ridepayment')} />
    ),
    ridereferral: <ReferralScreen onBack={() => go('ridehome')} />,
    ridesos: (
      <EmergencySOSScreen onBack={() => go('rideinprogress')} onSOS={() => go('rideinprogress')} />
    ),
    rideshare: <ShareTripScreen onBack={() => go('rideinprogress')} />,
    ridereceipt: (
      <TripReceiptScreen
        onBack={() => go('ridedetail')}
        rideId={rideDetailId}
        onReport={() => go('ridereport')}
      />
    ),
    ridepaysuccess: (
      <WalletPaySuccessScreen onDone={() => go('home')} onReceipt={() => go('ridereceipt')} />
    ),
    // ── DRIVER APP module ────────────────────────────────────────────────────
    drvsplash: <DriverSplashScreen onDone={() => go('drvlogin')} />,
    drvlogin: (
      <DriverLoginScreen
        // Land on the onboarding hub, not the dashboard. `drvkyc` was reachable
        // ONLY from the registration OTP screen, so a driver who signed in on a
        // later day — the normal case — could never get back to documents,
        // vehicle registration, emergency contact or the agreement, and so
        // could never finish registering. The hub always offers "Continue to
        // Dashboard", so a driver who IS finished loses nothing.
        onContinue={() => go('drvkyc')}
        onBack={() => go('home')}
        onApply={() => {
          setPartnerPersona('driver');
          go('partnerdriver');
        }}
        onForgot={() => {
          setRecoveryFrom('drvlogin');
          go('recovery');
        }}
      />
    ),
    drvotp: <DriverOTPScreen onVerified={() => go('drvkyc')} onBack={() => go('drvlogin')} />,
    drvkyc: (
      <DriverKYCStatusScreen
        onContinue={() => go('drvdash')}
        onUpload={() => go('drvuploaddocs')}
        onBack={() => goBack('drvdash')}
        // Vehicle registration and the agreement were unreachable: nothing
        // routed into them outside the Design Preview navigator, so a driver
        // could never accept the terms the activation gate requires.
        onVehicle={() => go('drvvehicle')}
        onInspection={() => go('drvinspection')}
        onAgreement={() => {
          setDriverStepReturn('drvkyc');
          go('drvagree');
        }}
      />
    ),
    drvuploaddocs: (
      <DriverUploadDocsScreen
        onBack={() => go('drvkyc')}
        onSave={() => go('drvkyc')}
        // Submitting for review is refused without these two, and this screen
        // is where a driver reads that refusal — so it must also be where they
        // can act on it.
        onEmergencyContact={() => {
          setDriverStepReturn('drvuploaddocs');
          go('drvemergency');
        }}
        onAgreement={() => {
          setDriverStepReturn('drvuploaddocs');
          go('drvagree');
        }}
      />
    ),
    drvinspection: <DriverInspectionScreen onBack={() => go('drvkyc')} />,
    drvvehicle: (
      <DriverVehicleRegScreen
        onBack={() => go('drvkyc')}
        onSave={() => {
          setDriverStepReturn('drvkyc');
          go('drvemergency');
        }}
      />
    ),
    drvemergency: (
      <EmergencyContactScreen
        onBack={() => go(driverStepReturn)}
        onContinue={() => go('drvagree')}
      />
    ),
    drvagree: (
      <AgreementAcceptanceScreen
        onBack={() => go(driverStepReturn)}
        onContinue={() => go(driverStepReturn)}
      />
    ),
    drvdash: (
      <DriverDashboardScreen
        onRequest={(offer) => {
          setActiveDriverOffer(offer);
          go('drvrequest');
        }}
        onSettings={() => go('drvsettings')}
        onSignOut={() => {
          void endSession(() => api.auth.logout()).then(() => goAfterAuthChange('drvlogin'));
        }}
        onSignIn={() => go('drvlogin')}
      />
    ),
    drvrequest: (
      <DriverIncomingRequestScreen
        offer={activeDriverOffer}
        onAccept={(ride) => {
          setActiveDriverRide(ride);
          go('drvtopickup');
        }}
        onDecline={() => go('drvdash')}
      />
    ),
    drvtopickup: (
      <DriverNavToPickupScreen
        rideId={activeDriverRide?.id}
        onArrived={() => go('drvverify')}
        onBack={() => go('drvdash')}
        onMessagePassenger={(rideId, passengerName) => {
          setChat({
            context: 'ride',
            contextId: rideId,
            title: passengerName ?? 'Your passenger',
            back: 'drvtopickup',
          });
          go('chat');
        }}
      />
    ),
    drvverify: (
      <DriverPassengerVerifyScreen
        rideId={activeDriverRide?.id}
        onVerified={() => go('drvtripactive')}
        onBack={() => go('drvtopickup')}
      />
    ),
    drvtripactive: (
      <DriverTripInProgressScreen
        rideId={activeDriverRide?.id}
        onComplete={(ride) => {
          if (ride) setActiveDriverRide(ride);
          go('drvtripdone');
        }}
        onBack={() => go('drvverify')}
      />
    ),
    drvtripdone: <DriverTripCompletedScreen ride={activeDriverRide} onDone={() => go('drvdash')} />,
    drvsettings: (
      <DriverSettingsScreen
        onBack={() => goBack('drvdash')}
        onLogout={() => goAfterAuthChange('drvlogin')}
      />
    ),
    // ── WALLET module ────────────────────────────────────────────────────────
    wallethome: (
      <WalletHomeScreen
        onBack={() => go('home')}
        onTopUp={() => go('wallettopup')}
        onWithdraw={() => go('walletwithdraw')}
        onTransfer={() => go('wallettransfer')}
        onPay={() => go('walletpay')}
        onTxHistory={() => go('wallettx')}
        onRewards={() => go('walletrewards')}
      />
    ),
    utilities: (
      <UtilitiesHomeScreen
        onBack={() => goBack('home')}
        onService={(service) => {
          setActiveUtilityService(service);
          go('utilitybuy');
        }}
        onHistory={() => go('utilityhistory')}
      />
    ),
    utilitybuy: (
      <UtilityPurchaseScreen
        service={activeUtilityService}
        onBack={() => goBack('utilities')}
        onDone={(purchase) => {
          setActiveUtilityPurchase(purchase);
          go('utilityreceipt');
        }}
      />
    ),
    utilityreceipt: activeUtilityPurchase ? (
      <UtilityReceiptScreen
        purchase={activeUtilityPurchase}
        onBack={() => goBack('utilities')}
        onDone={() => go('utilities')}
      />
    ) : (
      <UtilitiesHomeScreen
        onBack={() => goBack('home')}
        onService={(service) => {
          setActiveUtilityService(service);
          go('utilitybuy');
        }}
        onHistory={() => go('utilityhistory')}
      />
    ),
    utilityhistory: (
      <UtilityHistoryScreen
        onBack={() => goBack('utilities')}
        onOpen={(purchase) => {
          setActiveUtilityPurchase(purchase);
          go('utilityreceipt');
        }}
      />
    ),
    wallettx: <TransactionHistoryScreen onBack={() => go('wallethome')} />,
    wallettopup: <TopUpScreen onBack={() => go('wallethome')} onConfirm={() => go('wallethome')} />,
    walletwithdraw: (
      <WithdrawScreen onBack={() => go('wallethome')} onConfirm={() => go('wallethome')} />
    ),
    wallettransfer: (
      <TransferScreen onBack={() => go('wallethome')} onConfirm={() => go('wallethome')} />
    ),
    walletpay: <PaymentMethodsScreen onBack={() => go('wallethome')} />,
    walletrewards: <RewardsScreen onBack={() => go('wallethome')} />,
    walletstatement: <WalletStatementScreen onBack={() => go('wallethome')} />,
    walletsecurity: <WalletSecurityScreen onBack={() => go('wallethome')} />,
    walletsettings: <WalletSettingsScreen onBack={() => go('wallethome')} />,
    // ── RIDE OPERATIONS CONSOLE (desktop) ───────────────────────────────────
    admindash: <AdminDashboardScreen />,
    adminmap: <AdminLiveMapScreen />,
    admintrips: <AdminTripsScreen />,
    admindrivers: <AdminDriversScreen />,
    adminkyc: <AdminKYCScreen />,
    adminvehicles: <AdminVehiclesScreen />,
    admincustomers: <AdminCustomersScreen />,
    adminpricing: <AdminPricingScreen />,
    adminincidents: <AdminIncidentsScreen />,
    adminsupport: <AdminSupportScreen />,
    adminanalytics: <AdminAnalyticsScreen />,
    adminreports: <AdminReportsScreen />,
    adminsettings: <AdminSettingsScreen />,
    adminaudit: <AdminAuditScreen />,
    adminprofile: <AdminProfileScreen />,
    mxdash: (
      <MerchantDashboardScreen
        onApply={() => go('partnermerchant')}
        onForgot={() => {
          setRecoveryFrom('mxdash');
          go('recovery');
        }}
      />
    ),
    mxorders: <MerchantOrdersScreen />,
    mxproducts: <MerchantProductsScreen />,
    mxstore: <MerchantStoreScreen />,
    mxearnings: <MerchantEarningsScreen />,
    mxkyc: <MerchantKYCScreen />,
    mxbank: <MerchantBankScreen />,
    mxapproval: <MerchantApprovalScreen />,
    // ── RIDER APP module ─────────────────────────────────────────────────────
    riderlogin: (
      <RiderLoginScreen
        onContinue={() => go('riderdash')}
        onBack={() => go('home')}
        onApply={() => {
          setPartnerPersona('rider');
          go('partnerrider');
        }}
        onForgot={() => {
          setRecoveryFrom('riderlogin');
          go('recovery');
        }}
      />
    ),
    riderdash: (
      <RiderDashboardScreen
        onJob={(job) => {
          setActiveRiderJob(job);
          go('riderjob');
        }}
        onEarnings={() => go('riderearnings')}
        onAccount={() => go('rideraccount')}
        onSignIn={() => go('riderlogin')}
      />
    ),
    riderjob: activeRiderJob ? (
      <RiderJobScreen
        job={activeRiderJob}
        onBack={() => go('riderdash')}
        onDone={() => go('riderdash')}
        onMessageCustomer={(deliveryJobId, customerName) => {
          setChat({
            context: 'delivery',
            contextId: deliveryJobId,
            title: customerName ?? 'Your customer',
            back: 'riderjob',
          });
          go('chat');
        }}
      />
    ) : (
      <RiderLoginScreen
        onContinue={() => go('riderdash')}
        onBack={() => go('home')}
        onApply={() => {
          setPartnerPersona('rider');
          go('partnerrider');
        }}
      />
    ),
    riderearnings: <RiderEarningsScreen onBack={() => go('riderdash')} />,
    rideraccount: (
      <RiderAccountScreen
        onBack={() => goBack('riderdash')}
        onSignedOut={() => goAfterAuthChange('riderlogin')}
      />
    ),

    // ── Partner Onboarding (merchant / driver / rider self-registration) ──────
    partnerselect: (
      <PartnerChoiceScreen
        onSelect={(p) => {
          setPartnerPersona(p);
          go(
            p === 'merchant'
              ? 'partnermerchant'
              : p === 'driver'
                ? 'partnerdriver'
                : 'partnerrider',
          );
        }}
        onSignIn={() => go('signin')}
        onBack={
          partnerFrom
            ? () => {
                const dest = partnerFrom;
                setPartnerFrom(null);
                go(dest);
              }
            : undefined
        }
      />
    ),
    partnermerchant: (
      <MerchantSignUpScreen
        onBack={() => go('partnerselect')}
        onNext={({ email, password, businessName, category }) => {
          setPartnerPersona('merchant');
          setMerchantBiz({ businessName, category });
          setOtpData({
            email,
            phone: '',
            country: COUNTRIES[0],
            password,
            verifyChannel: 'email',
            persona: 'merchant',
          });
          go('otp');
        }}
        onSignIn={() => go('signin')}
      />
    ),
    partnerdriver: (
      <DriverSignUpScreen
        onBack={() => go('partnerselect')}
        onNext={({ email, password }) => {
          setPartnerPersona('driver');
          setOtpData({
            email,
            phone: '',
            country: COUNTRIES[0],
            password,
            verifyChannel: 'email',
            persona: 'driver',
          });
          go('otp');
        }}
        onSignIn={() => go('drvlogin')}
      />
    ),
    partnerrider: (
      <RiderSignUpScreen
        onBack={() => go('partnerselect')}
        onNext={({ email, password }) => {
          setPartnerPersona('rider');
          setOtpData({
            email,
            phone: '',
            country: COUNTRIES[0],
            password,
            verifyChannel: 'email',
            persona: 'rider',
          });
          go('otp');
        }}
        onSignIn={() => go('riderlogin')}
      />
    ),
    partnerdocs: (
      <DriverDocumentsScreen
        onBack={() => go('partnerdriver')}
        onSubmit={() => go('partnerreview')}
      />
    ),
    riderdocs: (
      <RiderDocumentsScreen
        onBack={() => go('partnerrider')}
        onSubmit={() => go('partnerreview')}
      />
    ),
    partnerbusiness: (
      <BusinessDetailsScreen
        businessName={merchantBiz.businessName}
        category={merchantBiz.category}
        onDone={() => go('partnerreview')}
        onBack={() => go('partnerreview')}
      />
    ),
    partnerreview: (
      <PendingReviewScreen
        persona={partnerPersona}
        onHome={() => go('home')}
        // The screen reloads its own real status; nothing extra to do here.
        onRefresh={() => {}}
        // Send the partner to the page where documents are actually uploaded.
        onUploadDocuments={() =>
          go(
            partnerPersona === 'merchant'
              ? 'mxkyc'
              : partnerPersona === 'rider'
                ? 'riderlogin'
                : 'drvuploaddocs',
          )
        }
      />
    ),
  };

  // ── Module quick-jump entries ──────────────────────────────────────────────
  type ModuleGroup = {
    label: string;
    color: string;
    emoji: string;
    screens: { label: string; key: Screen }[];
  };
  const MODULE_GROUPS: ModuleGroup[] = [
    {
      label: 'Auth',
      color: '#8B5CF6',
      emoji: '🔐',
      screens: [
        { label: 'Splash', key: 'splash' },
        { label: 'Welcome', key: 'welcome' },
        { label: 'Register', key: 'register' },
        { label: 'OTP', key: 'otp' },
        { label: 'Profile Setup', key: 'profile' },
        { label: 'Sign In', key: 'returning' },
        { label: 'Security', key: 'security' },
        { label: 'KYC', key: 'kyc' },
        { label: 'Account', key: 'account' },
        { label: 'Auth Summary', key: 'authsummary' },
      ],
    },
    {
      label: 'Consumer Home',
      color: '#2BAC52',
      emoji: '🏠',
      screens: [
        { label: 'Home Dashboard', key: 'home' },
        { label: 'Notifications', key: 'activitydash' },
      ],
    },
    {
      label: 'Marketplace',
      color: '#F97316',
      emoji: '🛍',
      screens: [
        { label: 'Marketplace', key: 'marketplace' },
        { label: 'Merchant Store', key: 'store' },
        { label: 'Product Detail', key: 'productdetail' },
        { label: 'Cart', key: 'cart' },
        { label: 'Checkout', key: 'checkout' },
        { label: 'Order Tracking', key: 'ordertracking' },
      ],
    },
    {
      label: 'Ride — Customer',
      color: '#3B82F6',
      emoji: '🚕',
      screens: [
        { label: 'Ride Home', key: 'ridehome' },
        { label: 'Ride Home+', key: 'ridehomeplus' },
        { label: 'Search Dest.', key: 'ridesearch' },
        { label: 'Pickup Confirm', key: 'ridepickup' },
        { label: 'Fare Estimate', key: 'ridefare' },
        { label: 'Payment', key: 'ridepayment' },
        { label: 'OPay Payment', key: 'rideopay' },
        { label: 'Cash Payment', key: 'ridecash' },
        { label: 'Promo Code', key: 'ridepromo' },
        { label: 'Finding Driver', key: 'ridefinding' },
        { label: 'Driver En Route', key: 'rideenroute' },
        { label: 'Driver Assigned', key: 'rideassigned' },
        { label: 'Driver Profile', key: 'ridedriver' },
        { label: 'Driver Arrived', key: 'ridearrived' },
        { label: 'Arrived Extended', key: 'ridearrivedplus' },
        { label: 'Pax Waiting', key: 'ridepaxwait' },
        { label: 'Live Tracking', key: 'ridelivetrack' },
        { label: 'Ride in Progress', key: 'rideinprogress' },
        { label: 'Share Trip', key: 'rideshare' },
        { label: 'Emergency SOS', key: 'ridesos' },
        { label: 'Trip Completed', key: 'ridecomplete' },
        { label: 'Tip Driver', key: 'ridetip' },
        { label: 'Rate Driver', key: 'riderating' },
        { label: 'Payment Success', key: 'ridepaysuccess' },
        { label: 'Trip Receipt', key: 'ridereceipt' },
        { label: 'Report Trip', key: 'ridereport' },
        { label: 'Ride History', key: 'ridehistory' },
        { label: 'Ride Detail', key: 'ridedetail' },
        { label: 'Saved Places', key: 'ridesaved' },
        { label: 'Schedule Ride', key: 'rideschedule' },
        { label: 'Refer & Earn', key: 'ridereferral' },
      ],
    },
    {
      label: 'Driver App',
      color: '#10B981',
      emoji: '🚗',
      screens: [
        { label: 'Driver Splash', key: 'drvsplash' },
        { label: 'Driver Login', key: 'drvlogin' },
        { label: 'Driver OTP', key: 'drvotp' },
        { label: 'KYC Status', key: 'drvkyc' },
        { label: 'Upload Docs', key: 'drvuploaddocs' },
        { label: 'Vehicle Reg.', key: 'drvvehicle' },
        { label: 'Inspection', key: 'drvinspection' },
        { label: 'Emergency Contact', key: 'drvemergency' },
        { label: 'Agreement', key: 'drvagree' },
        { label: 'Driver Dashboard', key: 'drvdash' },
        { label: 'Incoming Request', key: 'drvrequest' },
        { label: 'Nav to Pickup', key: 'drvtopickup' },
        { label: 'Verify Passenger', key: 'drvverify' },
        { label: 'Trip Active', key: 'drvtripactive' },
        { label: 'Trip Completed', key: 'drvtripdone' },
        { label: 'Driver Settings', key: 'drvsettings' },
      ],
    },
    {
      label: 'Wallet',
      color: '#8B5CF6',
      emoji: '💜',
      screens: [
        { label: 'Wallet Home', key: 'wallethome' },
        { label: 'Transactions', key: 'wallettx' },
        { label: 'Top Up', key: 'wallettopup' },
        { label: 'Withdraw', key: 'walletwithdraw' },
        { label: 'Transfer', key: 'wallettransfer' },
        { label: 'Payment Methods', key: 'walletpay' },
        { label: 'Rewards', key: 'walletrewards' },
        { label: 'Statement', key: 'walletstatement' },
        { label: 'Security', key: 'walletsecurity' },
        { label: 'Settings', key: 'walletsettings' },
      ],
    },
    {
      label: 'Utilities',
      color: '#06B6D4',
      emoji: '⚡',
      screens: [
        { label: 'Utilities Home', key: 'utilities' },
        { label: 'Buy Utility', key: 'utilitybuy' },
        { label: 'Utility Receipt', key: 'utilityreceipt' },
        { label: 'Utility History', key: 'utilityhistory' },
      ],
    },
    {
      label: 'Ops Console',
      color: '#EF4444',
      emoji: '🖥',
      screens: [
        { label: 'Dashboard', key: 'admindash' },
        { label: 'Live Map', key: 'adminmap' },
        { label: 'Trip Monitoring', key: 'admintrips' },
        { label: 'Drivers', key: 'admindrivers' },
        { label: 'KYC Review', key: 'adminkyc' },
        { label: 'Vehicles', key: 'adminvehicles' },
        { label: 'Customers', key: 'admincustomers' },
        { label: 'Pricing', key: 'adminpricing' },
        { label: 'Incidents', key: 'adminincidents' },
        { label: 'Support', key: 'adminsupport' },
        { label: 'Analytics', key: 'adminanalytics' },
        { label: 'Reports', key: 'adminreports' },
        { label: 'Settings', key: 'adminsettings' },
        { label: 'Audit Logs', key: 'adminaudit' },
        { label: 'Admin Profile', key: 'adminprofile' },
      ],
    },
    {
      label: 'Merchant Portal',
      color: '#F97316',
      emoji: '🏪',
      screens: [
        { label: 'Dashboard', key: 'mxdash' },
        { label: 'Orders', key: 'mxorders' },
        { label: 'Products', key: 'mxproducts' },
        { label: 'Store Setup', key: 'mxstore' },
        { label: 'Earnings', key: 'mxearnings' },
        { label: 'KYC', key: 'mxkyc' },
        { label: 'Bank Account', key: 'mxbank' },
        { label: 'Approval Status', key: 'mxapproval' },
      ],
    },
    {
      label: 'Rider App',
      color: '#47CF72',
      emoji: '🏍️',
      screens: [
        { label: 'Rider Login', key: 'riderlogin' },
        { label: 'Dashboard', key: 'riderdash' },
        { label: 'Job Detail', key: 'riderjob' },
        { label: 'Earnings', key: 'riderearnings' },
        { label: 'Account', key: 'rideraccount' },
      ],
    },
  ];

  const ADMIN_SCREENS: Screen[] = [
    'admindash',
    'adminmap',
    'admintrips',
    'admindrivers',
    'adminkyc',
    'adminvehicles',
    'admincustomers',
    'adminpricing',
    'adminincidents',
    'adminsupport',
    'adminanalytics',
    'adminreports',
    'adminsettings',
    'adminaudit',
    'adminprofile',
    'mxdash',
    'mxorders',
    'mxproducts',
    'mxstore',
    'mxearnings',
    'mxkyc',
    'mxbank',
    'mxapproval',
  ];
  const isDesktop = ADMIN_SCREENS.includes(screen);

  const [openGroup, setOpenGroup] = useState<string | null>('Driver App');
  const [navOpen, setNavOpen] = useState(true);

  // ── Design Preview gate ──────────────────────────────────────────────────
  // The module-navigator sidebar lists every screen in the platform, including
  // preview-only screens that are not part of any real user journey. It used to
  // render unconditionally, so a signed-in customer could open it and land on
  // demo data. It is now OFF by default and only shown when deliberately
  // enabled, so the team keeps it and customers never see it:
  //   • VITE_DESIGN_PREVIEW=true   — build/env flag (e.g. a preview deployment)
  //   • ?preview=1 in the URL      — remembered for the session on this device
  //   • ?preview=0                 — turns it back off
  // Local `pnpm dev` keeps it on automatically so day-to-day work is unchanged.
  const showDesignPreview = React.useMemo(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    const param = params.get('preview');
    if (param === '1') {
      window.sessionStorage.setItem('dx.designPreview', '1');
      return true;
    }
    if (param === '0') {
      window.sessionStorage.removeItem('dx.designPreview');
      return false;
    }
    if (window.sessionStorage.getItem('dx.designPreview') === '1') return true;
    if (import.meta.env.DEV) return true;
    return String(import.meta.env.VITE_DESIGN_PREVIEW ?? '') === 'true';
  }, []);

  return (
    <div
      className="flex gap-0 overflow-hidden"
      style={{
        height: '100dvh',
        background: `radial-gradient(ellipse at 50% 0%,#0D1E33 0%,#050A12 65%,#030709 100%)`,
      }}
    >
      <style>{GLOBAL_STYLES}</style>

      {/* ── Module Navigator sidebar (Design Preview only) ───────────────── */}
      {showDesignPreview && (
        <div
          className="flex min-h-0 flex-shrink-0 flex-col"
          style={{
            width: navOpen ? 220 : 36,
            height: '100%',
            transition: 'width .25s ease',
            overflow: 'hidden',
          }}
        >
          {/* collapse toggle */}
          <div className="flex justify-end px-2 pb-2 pt-4">
            <button
              onClick={() => setNavOpen((o) => !o)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,.12)',
                background: '#0D1B2E',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <span style={{ color: 'rgba(255,255,255,.6)', fontSize: 13 }}>
                {navOpen ? '‹' : '›'}
              </span>
            </button>
          </div>

          <div
            className="flex flex-1 flex-col gap-2 overflow-y-auto pb-8 pl-4 pr-2"
            style={{ scrollbarWidth: 'none', opacity: navOpen ? 1 : 0, transition: 'opacity .2s' }}
          >
            {/* Brand */}
            <div className="mb-4">
              <p
                style={{
                  fontFamily: "'Poppins',sans-serif",
                  fontSize: 16,
                  fontWeight: 700,
                  color: '#fff',
                  letterSpacing: '-0.02em',
                }}
              >
                DrippleX
              </p>
              <p
                style={{
                  fontFamily: "'Inter',sans-serif",
                  fontSize: 11,
                  color: 'rgba(255,255,255,.35)',
                  marginTop: 2,
                }}
              >
                {MODULE_GROUPS.reduce((s, g) => s + g.screens.length, 0)} screens · Design Preview
              </p>
            </div>

            {MODULE_GROUPS.map((group) => {
              const isOpen = openGroup === group.label;
              return (
                <div key={group.label}>
                  {/* Group header */}
                  <button
                    onClick={() => setOpenGroup(isOpen ? null : group.label)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 transition-all"
                    style={{
                      background: isOpen ? `${group.color}14` : 'transparent',
                      border: `1px solid ${isOpen ? `${group.color}30` : 'transparent'}`,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{group.emoji}</span>
                    <span
                      style={{
                        fontFamily: "'Inter',sans-serif",
                        fontSize: 12,
                        fontWeight: 600,
                        color: isOpen ? group.color : 'rgba(255,255,255,.5)',
                        flex: 1,
                        textAlign: 'left',
                      }}
                    >
                      {group.label}
                    </span>
                    <span
                      style={{
                        fontFamily: "'Inter',sans-serif",
                        fontSize: 10,
                        color: 'rgba(255,255,255,.25)',
                      }}
                    >
                      {isOpen ? '▲' : '▼'}
                    </span>
                  </button>

                  {/* Screen list */}
                  {isOpen && (
                    <div className="ml-2 mt-1 flex flex-col gap-0.5">
                      {group.screens.map((s) => {
                        const active = screen === s.key;
                        return (
                          <button
                            key={s.key}
                            onClick={() => go(s.key)}
                            className="w-full rounded-lg px-3 py-2 text-left transition-all active:scale-[.97]"
                            style={{
                              background: active ? `${group.color}20` : 'transparent',
                              borderLeft: `2px solid ${active ? group.color : 'transparent'}`,
                            }}
                          >
                            <span
                              style={{
                                fontFamily: "'Inter',sans-serif",
                                fontSize: 12,
                                color: active ? group.color : 'rgba(255,255,255,.45)',
                                fontWeight: active ? 600 : 400,
                              }}
                            >
                              {s.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Canvas ───────────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto py-3">
        <div
          style={{
            opacity: fading ? 0 : 1,
            transform: fading ? 'scale(.97)' : 'scale(1)',
            transition: 'all .22s ease',
          }}
        >
          {isDesktop ? (
            <DesktopFrame>{screens[screen]}</DesktopFrame>
          ) : (
            <PhoneFrame>{screens[screen]}</PhoneFrame>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ApiProvider>
      <AppShell />
    </ApiProvider>
  );
}
