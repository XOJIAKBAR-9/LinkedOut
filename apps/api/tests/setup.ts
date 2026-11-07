import { afterAll, beforeEach } from "vitest";
import { TEST_DATABASE_URL } from "./globalSetup.js";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.JWT_ACCESS_SECRET ??= "test-access-secret-test-access-secret-0123";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-test-refresh-secret-01";
process.env.UPLOAD_DIR ??= "/tmp/linkedout-test-uploads";

const { prisma } = await import("../src/lib/prisma.js");

beforeEach(async () => {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"${t.tablename}"`).join(", ");
  if (list) await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  await prisma.$disconnect();
});
