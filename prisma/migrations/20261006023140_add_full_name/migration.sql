-- AlterTable
ALTER TABLE "users" ADD COLUMN     "full_name" TEXT;

-- RenameIndex
ALTER INDEX "reading_aggregate_device_id_sensor_type_id_bucket_interval_key" RENAME TO "reading_aggregate_device_id_sensor_type_id_bucket_interval__key";
