-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isSample" BOOLEAN NOT NULL DEFAULT false;


-- Backfill: accounts created by the seed script before this flag existed.
UPDATE "User" SET "isSample" = true WHERE "email" LIKE '%@example.test' OR "email" = 'demo@linkedout.test';
