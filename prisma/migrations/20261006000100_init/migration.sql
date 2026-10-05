-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'DECOMMISSIONED');

-- CreateEnum
CREATE TYPE "QualityFlag" AS ENUM ('GOOD', 'OUT_OF_RANGE', 'INVALID');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "location" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "altitude_m" DECIMAL(8,2) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "location_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "location_latitude_check" CHECK ("latitude" BETWEEN -90 AND 90),
    CONSTRAINT "location_longitude_check" CHECK ("longitude" BETWEEN -180 AND 180)
);

CREATE TABLE "device" (
    "id" UUID NOT NULL,
    "device_code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "location_id" UUID NOT NULL,
    "api_key_hash" VARCHAR(255) NOT NULL,
    "status" "DeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_seen_at" TIMESTAMPTZ(3),
    "last_device_time" TIMESTAMPTZ(3),
    "firmware_version" VARCHAR(50),
    "battery_v" DECIMAL(5,2),
    "rssi" INTEGER,
    "uptime_s" BIGINT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    CONSTRAINT "device_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "device_battery_v_check" CHECK ("battery_v" IS NULL OR "battery_v" >= 0),
    CONSTRAINT "device_uptime_s_check" CHECK ("uptime_s" IS NULL OR "uptime_s" >= 0)
);

CREATE TABLE "device_status_history" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "from_status" "DeviceStatus",
    "to_status" "DeviceStatus" NOT NULL,
    "reason" TEXT,
    "changed_by_user_id" UUID,
    "changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "device_status_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sensor_type" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "unit" VARCHAR(30) NOT NULL,
    "valid_min" DECIMAL(12,4) NOT NULL,
    "valid_max" DECIMAL(12,4) NOT NULL,
    "precision" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    CONSTRAINT "sensor_type_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sensor_type_range_check" CHECK ("valid_min" < "valid_max"),
    CONSTRAINT "sensor_type_precision_check" CHECK ("precision" >= 0)
);

CREATE TABLE "sensor" (
    "id" UUID NOT NULL,
    "serial_number" VARCHAR(100) NOT NULL,
    "sensor_type_id" UUID NOT NULL,
    "name" VARCHAR(150),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    CONSTRAINT "sensor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sensor_installation" (
    "id" UUID NOT NULL,
    "sensor_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "installed_at" TIMESTAMPTZ(3) NOT NULL,
    "removed_at" TIMESTAMPTZ(3),
    CONSTRAINT "sensor_installation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sensor_installation_period_check"
        CHECK ("removed_at" IS NULL OR "removed_at" > "installed_at")
);

CREATE TABLE "sensor_calibration" (
    "id" UUID NOT NULL,
    "sensor_id" UUID NOT NULL,
    "effective_from" TIMESTAMPTZ(3) NOT NULL,
    "offset" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "scale" DECIMAL(12,6) NOT NULL DEFAULT 1,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sensor_calibration_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sensor_calibration_scale_check" CHECK ("scale" <> 0)
);

CREATE TABLE "sensor_reading" (
    "id" BIGSERIAL NOT NULL,
    "installation_id" UUID NOT NULL,
    "calibration_id" UUID,
    "device_time" TIMESTAMPTZ(3) NOT NULL,
    "server_time" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seq" INTEGER NOT NULL,
    "raw_value" DECIMAL(12,4) NOT NULL,
    "corrected_value" DECIMAL(12,4) NOT NULL,
    "quality_flag" "QualityFlag" NOT NULL DEFAULT 'GOOD',
    CONSTRAINT "sensor_reading_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sensor_reading_seq_check" CHECK ("seq" >= 0)
);

CREATE TABLE "reading_aggregate" (
    "id" BIGSERIAL NOT NULL,
    "device_id" UUID NOT NULL,
    "sensor_type_id" UUID NOT NULL,
    "bucket_start" TIMESTAMPTZ(3) NOT NULL,
    "bucket_interval" VARCHAR(10) NOT NULL,
    "min_value" DECIMAL(12,4),
    "max_value" DECIMAL(12,4),
    "avg_value" DECIMAL(12,4),
    "sum_value" DECIMAL(18,4),
    "sample_count" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "reading_aggregate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reading_aggregate_interval_check" CHECK ("bucket_interval" IN ('1m', '1h', '1d')),
    CONSTRAINT "reading_aggregate_sample_count_check" CHECK ("sample_count" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "device_device_code_key" ON "device"("device_code");
CREATE INDEX "device_location_id_idx" ON "device"("location_id");
CREATE INDEX "device_status_idx" ON "device"("status");
CREATE INDEX "device_last_seen_at_idx" ON "device"("last_seen_at");
CREATE INDEX "device_status_deleted_at_idx" ON "device"("status", "deleted_at");
CREATE INDEX "device_status_history_device_id_changed_at_idx" ON "device_status_history"("device_id", "changed_at");
CREATE UNIQUE INDEX "sensor_type_code_key" ON "sensor_type"("code");
CREATE UNIQUE INDEX "sensor_serial_number_key" ON "sensor"("serial_number");
CREATE INDEX "sensor_sensor_type_id_idx" ON "sensor"("sensor_type_id");
CREATE INDEX "sensor_installation_sensor_id_installed_at_idx" ON "sensor_installation"("sensor_id", "installed_at");
CREATE INDEX "sensor_installation_device_id_installed_at_idx" ON "sensor_installation"("device_id", "installed_at");
CREATE UNIQUE INDEX "sensor_installation_one_active_per_sensor_idx"
    ON "sensor_installation"("sensor_id")
    WHERE "removed_at" IS NULL;
CREATE INDEX "sensor_calibration_sensor_id_effective_from_idx" ON "sensor_calibration"("sensor_id", "effective_from");
CREATE INDEX "sensor_reading_device_time_idx" ON "sensor_reading"("device_time");
CREATE INDEX "sensor_reading_server_time_idx" ON "sensor_reading"("server_time");
CREATE UNIQUE INDEX "sensor_reading_installation_id_device_time_key" ON "sensor_reading"("installation_id", "device_time");
CREATE INDEX "reading_aggregate_device_id_bucket_start_idx" ON "reading_aggregate"("device_id", "bucket_start");
CREATE UNIQUE INDEX "reading_aggregate_device_id_sensor_type_id_bucket_interval_key"
    ON "reading_aggregate"("device_id", "sensor_type_id", "bucket_interval", "bucket_start");

-- AddForeignKey
ALTER TABLE "device"
    ADD CONSTRAINT "device_location_id_fkey"
    FOREIGN KEY ("location_id") REFERENCES "location"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "device_status_history"
    ADD CONSTRAINT "device_status_history_device_id_fkey"
    FOREIGN KEY ("device_id") REFERENCES "device"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "device_status_history"
    ADD CONSTRAINT "device_status_history_changed_by_user_id_fkey"
    FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sensor"
    ADD CONSTRAINT "sensor_sensor_type_id_fkey"
    FOREIGN KEY ("sensor_type_id") REFERENCES "sensor_type"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sensor_installation"
    ADD CONSTRAINT "sensor_installation_sensor_id_fkey"
    FOREIGN KEY ("sensor_id") REFERENCES "sensor"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sensor_installation"
    ADD CONSTRAINT "sensor_installation_device_id_fkey"
    FOREIGN KEY ("device_id") REFERENCES "device"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sensor_calibration"
    ADD CONSTRAINT "sensor_calibration_sensor_id_fkey"
    FOREIGN KEY ("sensor_id") REFERENCES "sensor"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sensor_reading"
    ADD CONSTRAINT "sensor_reading_installation_id_fkey"
    FOREIGN KEY ("installation_id") REFERENCES "sensor_installation"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sensor_reading"
    ADD CONSTRAINT "sensor_reading_calibration_id_fkey"
    FOREIGN KEY ("calibration_id") REFERENCES "sensor_calibration"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "reading_aggregate"
    ADD CONSTRAINT "reading_aggregate_device_id_fkey"
    FOREIGN KEY ("device_id") REFERENCES "device"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reading_aggregate"
    ADD CONSTRAINT "reading_aggregate_sensor_type_id_fkey"
    FOREIGN KEY ("sensor_type_id") REFERENCES "sensor_type"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
