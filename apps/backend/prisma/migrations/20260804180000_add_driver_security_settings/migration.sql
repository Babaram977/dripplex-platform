-- Driver-001 Security Standard: admin-configurable risk-engine settings.
-- See docs/DPX-DRIVER-001-SECURITY-STANDARD.md.

CREATE TABLE "driver_security_settings" (
  "id" UUID NOT NULL,
  "idle_hours" INTEGER NOT NULL,
  "gps_anomaly_speed_kmh" DOUBLE PRECISION NOT NULL,
  "lockout_threshold" INTEGER NOT NULL,
  "spot_check_denominator" INTEGER NOT NULL,
  "new_device_verification_enabled" BOOLEAN NOT NULL DEFAULT true,
  "admin_force_verification_enabled" BOOLEAN NOT NULL DEFAULT true,
  "updated_by" UUID,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),

  CONSTRAINT "driver_security_settings_pkey" PRIMARY KEY ("id")
);
