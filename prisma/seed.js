import "dotenv/config";
import { createHash, randomBytes, scryptSync } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/index.js";

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

async function seed(prisma) {
  // Pemasangan dan kalibrasi awal berlaku sejak tujuh hari kalender UTC lalu.
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end.getTime() - 7 * DAY);

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
        await tx.sensorInstallation.upsert({
          where: { id: seedId(`installation:${sensor.serialNumber}`) },
          update: {},
          create: {
            id: seedId(`installation:${sensor.serialNumber}`),
            sensorId: sensor.id,
            deviceId: device.id,
            installedAt: start,
          },
        });
        await tx.sensorCalibration.upsert({
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


      }
    }

    // Device ini dibuat lewat API; lengkapi pemasangannya tanpa mengganti
    // identitas, lokasi, API key, status, atau membuat reading demo tambahan.
    const extraDevice = await tx.device.findFirst({
      where: { deviceCode: "WS-GRT-004", deletedAt: null },
      select: { id: true, deviceCode: true, status: true },
    });
    if (extraDevice && extraDevice.status !== "DECOMMISSIONED") {
      const installedAt = new Date();
      for (const type of types) {
        if (type.deletedAt) throw new Error(`Tipe sensor ${type.code} sudah dihapus; pemasangan seed dibatalkan.`);
        // Jangan menambah sensor tipe yang sama jika sudah terpasang:
        // payload firmware hanya membawa kode tipe, sehingga akan ambigu.
        const active = await tx.sensorInstallation.findMany({
          where: { deviceId: extraDevice.id, removedAt: null, sensor: { sensorTypeId: type.id } },
          include: { sensor: true },
        });
        if (active.length > 1 || active.some((item) => item.sensor.deletedAt)) {
          throw new Error(`Pemasangan ${extraDevice.deviceCode}/${type.code} perlu diperiksa sebelum seed.`);
        }
        if (active.length === 1) continue;

        const serialNumber = `${extraDevice.deviceCode}-${type.code}`;
        const sensor = await tx.sensor.upsert({
          where: { serialNumber }, update: {},
          create: { serialNumber, name: `${type.name} ${extraDevice.deviceCode}`, sensorTypeId: type.id },
        });
        const existing = await tx.sensorInstallation.findFirst({ where: { sensorId: sensor.id, removedAt: null } });
        if (sensor.deletedAt || sensor.sensorTypeId !== type.id || existing) {
          throw new Error(`Sensor ${serialNumber} tidak tersedia untuk pemasangan seed.`);
        }
        // UUID tetap membuat rerun aman; pemasangan lama yang telah ditutup
        // tidak dibuka kembali. Sensor yang dipindah perlu ditangani operator.
        const installationId = seedId(`installation:${serialNumber}`);
        if (await tx.sensorInstallation.findUnique({ where: { id: installationId } })) {
          throw new Error(`Riwayat pemasangan ${serialNumber} sudah ada; pasang ulang melalui pengelolaan sensor.`);
        }
        await tx.sensorInstallation.create({
          data: { id: installationId, sensorId: sensor.id, deviceId: extraDevice.id, installedAt },
        });
      }
      console.log("Pemasangan WS-GRT-004 siap untuk 7 tipe sensor; API key tetap.");
    } else {
      console.log("Pemasangan WS-GRT-004 dilewati: device belum terdaftar, sudah dihapus, atau decommissioned.");
    }
  }, { timeout: 60000 });

  console.log("Seed berhasil: 1 user demo, 3 lokasi, 3 device, 7 tipe sensor, 21 sensor, pemasangan, dan kalibrasi.");
  console.log(`Pemasangan dan kalibrasi awal berlaku sejak ${start.toISOString()}.`);
  console.log("Seeder tidak mengisi sensor_reading atau reading_aggregate; kirim telemetry untuk menambah pembacaan.");
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
