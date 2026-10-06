import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/index.js";

// Satu client digunakan bersama oleh service yang mengakses database.
const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
});

const prisma = new PrismaClient({ adapter });

export default prisma;
