-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'STICKER');

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "stickerId" TEXT,
ADD COLUMN     "type" "MessageType" NOT NULL DEFAULT 'TEXT';

