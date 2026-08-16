// RIDE feature module — Economy ride-hailing journey (Customer)
export {
  // Core journey
  RideHomeScreen,
  // Resolves the passenger's real pickup from the device — replaced the
  // hardcoded Lagos address every ride used to be booked from.
  useDevicePickup,
  DestinationSearchScreen,
  PickupConfirmScreen,
  FareEstimateScreen,
  FindingDriverScreen,
  DriverAssignedScreen,
  DriverArrivedScreen,
  RideInProgressScreen,
  TripCompletedScreen,
  RateDriverScreen,
  RideHistoryScreen,
  RideDetailScreen,
  // Extended screens
  RideHomeExtendedScreen,
  LiveTrackingScreen,
  DriverEnRouteScreen,
  PassengerWaitingScreen,
  DriverArrivedExtendedScreen,
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
  WalletPaySuccessScreen,
} from '../../app/rideScreen';
export type { RideDestination } from '../../app/rideScreen';
