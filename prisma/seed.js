import "dotenv/config";
import { createHash, randomBytes, scryptSync } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../generated/prisma/index.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

// UUID tetap membuat lokasi, pemasangan, dan kalibrasi tidak duplikat.
function seedId(key) {
  const hex = createHash("sha256").update(`weather-demo:${key}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

// Rentang berikut adalah asumsi demo, bukan spesifikasi sensor produksi.
const sensorTypes = [
  { code: "temp_air", name: "Suhu Udara", unit: "°C", validMin: -40, validMax: 80, precision: 2, base: 26, amplitude: 5 },
  { code: "humidity", name: "Kelembapan", unit: "%", validMin: 0, validMax: 100, precision: 2, base: 70, amplitude: 15 },
  { code: "pressure", name: "Tekanan Udara", unit: "hPa", validMin: 300, validMax: 1100, precision: 2, base: 1005, amplitude: 8 },
  { code: "wind_speed", name: "Kecepatan Angin", unit: "m/s", validMin: 0, validMax: 60, precision: 2, base: 4, amplitude: 3 },
  { code: "wind_dir", name: "Arah Angin", unit: "°", validMin: 0, validMax: 360, precision: 1, base: 180, amplitude: 150 },
  { code: "rain_counter", name: "Penghitung Hujan", unit: "count", validMin: 0, validMax: 1000000, precision: 0 },
  { code: "solar_rad", name: "Radiasi Matahari", unit: "W/m²", validMin: 0, validMax: 1500, precision: 2 },
];

const stations = [
  { code: "DEMO-WS-GRT-001", name: "Demo Garut", latitude: -7.2167, longitude: 107.9, altitudeM: 717 },
  { code: "DEMO-WS-BDG-002", name: "Demo Bandung", latitude: -6.9175, longitude: 107.6191, altitudeM: 768 },
  { code: "DEMO-WS-TSM-003", name: "Demo Tasikmalaya", latitude: -7.3274, longitude: 108.2207, altitudeM: 350 },
];

function rawValueFor(type, stationIndex, hourIndex) {
  // Siklus siang/malam memakai jam UTC+7; timestamp tetap disimpan dalam UTC.
  const localHour = (hourIndex + 7) % 24;
  if (type.code === "rain_counter") return Math.floor(hourIndex / 6) + stationIndex;
  if (type.code === "solar_rad") {
    return Number((Math.max(0, Math.sin(((localHour - 6) / 12) * Math.PI)) * (800 + stationIndex * 50)).toFixed(4));
  }
  return Number((type.base + type.amplitude * Math.sin((localHour / 24) * Math.PI * 2) + stationIndex).toFixed(4));
}

async function seed(prisma) {
  // Tujuh hari kalender UTC sebelum hari ini, satu sampel setiap jam.
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end.getTime() - 7 * DAY);
  let readingsAdded = 0;
  let aggregatesAdded = 0;

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { email: "operator.demo@example.com" },
      update: {
        name: "Operator Demo",
      },
      create: {
        name: "Operator Demo",
        full_name: "Operator Weather Station Demo",
        email: "operator.demo@example.com",
        passwordHash: hashPassword("DemoWeather123!"),
      },
    });

    const types = [];
    for (const definition of sensorTypes) {
      console.log("definition:", JSON.stringify(definition, null, 2));

      // const base  = definition.base;
      // const amplitude = definition.amplitude;
      // const data = {
      //   code: definition.code,
      //   name: definition.name,
      //   unit: definition.unit,
      //   validMin: new Prisma.Decimal(definition.validMin),
      //   validMax: new Prisma.Decimal(definition.validMax),
      //   precision: definition.precision,
      // }

      const { base, amplitude, ...data } = definition;
      console.log("data:", JSON.stringify(data, null, 2));
      types.push(await tx.sensorType.upsert({
        where: { code: data.code },
        update: {},
        create: data,
      }));
    }

    for (const [stationIndex, station] of stations.entries()) {
      const location = await tx.location.upsert({
        where: { id: seedId(`location:${station.code}`) },
        update: {},
        create: {
          id: seedId(`location:${station.code}`),
          name: station.name,
          latitude: station.latitude,
          longitude: station.longitude,
          altitudeM: station.altitudeM,
        },
      });
      const demoApiKey = `demo-only-${station.code}`;
      const device = await tx.device.upsert({
        where: { deviceCode: station.code },
        update: {},
        create: {
          deviceCode: station.code,
          name: station.name,
          locationId: location.id,
          apiKeyHash: createHash("sha256").update(demoApiKey).digest("hex"),
          status: "ACTIVE",
          firmwareVersion: "1.4.2",
          batteryV: "3.90",
          rssi: -70 - stationIndex,
          uptimeS: BigInt(7 * 24 * 60 * 60),
          lastDeviceTime: new Date(end.getTime() - HOUR),
          lastSeenAt: new Date(end.getTime() - HOUR + 2000),
        },
      });
      await tx.deviceStatusHistory.upsert({
        where: { id: seedId(`status:${station.code}`) },
        update: {},
        create: {
          id: seedId(`status:${station.code}`),
          deviceId: device.id,
          toStatus: "ACTIVE",
          reason: "Perangkat demo dibuat oleh seeder",
          changedByUserId: user.id,
          changedAt: start,
        },
      });

      for (const [typeIndex, definition] of sensorTypes.entries()) {
        const type = types[typeIndex];
        const sensor = await tx.sensor.upsert({
          where: { serialNumber: `${station.code}-${type.code}` },
          update: {},
          create: {
            serialNumber: `${station.code}-${type.code}`,
            name: `${definition.name} ${station.name}`,
            sensorTypeId: type.id,
          },
        });
        const installation = await tx.sensorInstallation.upsert({
          where: { id: seedId(`installation:${sensor.serialNumber}`) },
          update: {},
          create: {
            id: seedId(`installation:${sensor.serialNumber}`),
            sensorId: sensor.id,
            deviceId: device.id,
            installedAt: start,
          },
        });
        const calibration = await tx.sensorCalibration.upsert({
          where: { id: seedId(`calibration:${sensor.serialNumber}`) },
          update: {},
          create: {
            id: seedId(`calibration:${sensor.serialNumber}`),
            sensorId: sensor.id,
            effectiveFrom: start,
            offset: 0,
            scale: 1,
            note: "Kalibrasi awal demo: nilai mentah tidak dikoreksi",
          },
        });

        const rows = [];
        for (let hour = 0; hour < 7 * 24; hour++) {
          const deviceTime = new Date(start.getTime() + hour * HOUR);
          if (deviceTime < installation.installedAt ||
            (installation.removedAt && deviceTime >= installation.removedAt)) {
            throw new Error(`Pemasangan ${sensor.serialNumber} tidak mencakup periode seed.`);
          }
          let rawValue = new Prisma.Decimal(rawValueFor(definition, stationIndex, hour));
          // Satu pembacaan suhu di luar rentang per device per hari.
          if (type.code === "temp_air" && hour % 24 === 12) {
            rawValue = type.validMax.plus(10);
          }
          const correctedValue = rawValue.mul(calibration.scale).plus(calibration.offset).toDecimalPlaces(4);
          const qualityFlag = correctedValue.lt(type.validMin) || correctedValue.gt(type.validMax)
            ? "OUT_OF_RANGE" : "GOOD";
          rows.push({
            installationId: installation.id,
            calibrationId: calibration.id,
            deviceTime,
            serverTime: new Date(deviceTime.getTime() + 2000),
            seq: Math.floor(deviceTime.getTime() / HOUR),
            rawValue,
            correctedValue,
            qualityFlag,
          });
        }
        const inserted = await tx.sensorReading.createMany({ data: rows, skipDuplicates: true });
        readingsAdded += inserted.count;

        // Ringkasan berasal dari data tersimpan, hanya sampel berkualitas GOOD.
        const saved = await tx.sensorReading.findMany({
          where: { installationId: installation.id, deviceTime: { gte: start, lt: end }, qualityFlag: "GOOD" },
          select: { deviceTime: true, correctedValue: true },
        });
        const aggregates = [];
        for (let day = 0; day < 7; day++) {
          const bucketStart = new Date(start.getTime() + day * DAY);
          const values = saved.filter((row) => row.deviceTime >= bucketStart && row.deviceTime.getTime() < bucketStart.getTime() + DAY)
            .map((row) => row.correctedValue);
          const sum = values.reduce((total, value) => total.plus(value), new Prisma.Decimal(0));
          aggregates.push({
            deviceId: device.id,
            sensorTypeId: type.id,
            bucketStart,
            bucketInterval: "1d",
            minValue: values.length ? Prisma.Decimal.min(...values) : null,
            maxValue: values.length ? Prisma.Decimal.max(...values) : null,
            avgValue: values.length ? sum.div(values.length).toDecimalPlaces(4) : null,
            sumValue: values.length ? sum : null,
            sampleCount: values.length,
          });
        }
        const insertedAggregates = await tx.readingAggregate.createMany({ data: aggregates, skipDuplicates: true });
        aggregatesAdded += insertedAggregates.count;
      }
    }
  }, { timeout: 60000 });

  console.log("Seed berhasil: 1 user demo, 3 lokasi, 3 device, 7 tipe sensor, 21 sensor, pemasangan, dan kalibrasi.");
  console.log(`Periode UTC: ${start.toISOString()} sampai ${end.toISOString()} (batas akhir tidak termasuk).`);
  console.log(`Data baru: ${readingsAdded} pembacaan, ${aggregatesAdded} aggregate harian.`);
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL belum diisi di .env.");
  // console.log(
  //   "Seeder mulai, menghubungkan ke database...",
  //   process.env.DATABASE_URL
  // );
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
  const prisma = new PrismaClient({ adapter });
  try {
    await seed(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Seeder gagal:", error.message);
  process.exitCode = 1;
});
