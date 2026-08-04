import { IsInt, IsLatitude, IsLongitude, IsOptional, Max, Min } from 'class-validator';

/** Driver Slice 2 item 5 — SOS/Emergency (founder-approved 2026-08-04):
 * deliberately does NOT accept `rideId`/`vehicleId` — the backend resolves
 * both server-side (active ride, approved+active vehicle) so pressing SOS
 * is a single tap and can't be spoofed to a ride/vehicle that isn't
 * actually the driver's. */
export class CreateSosAlertDto {
  @IsOptional()
  @IsLatitude()
  public latitude?: number;

  @IsOptional()
  @IsLongitude()
  public longitude?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  public batteryLevel?: number;
}
