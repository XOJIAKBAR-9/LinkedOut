-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('UPDATE', 'QUIT', 'WARNING', 'RED_FLAG');

-- AlterEnum
BEGIN;
CREATE TYPE "ReactionType_new" AS ENUM ('RESPECT', 'SAME', 'RUN', 'FUNNY');
-- Map old LinkedIn-style reactions onto the new themed set (no reaction is lost).
ALTER TABLE "Reaction" ALTER COLUMN "type" TYPE "ReactionType_new" USING (
  CASE "type"::text
    WHEN 'LIKE' THEN 'RESPECT'
    WHEN 'CELEBRATE' THEN 'RESPECT'
    WHEN 'SUPPORT' THEN 'SAME'
    WHEN 'INSIGHTFUL' THEN 'SAME'
    ELSE 'FUNNY'
  END
)::"ReactionType_new";
ALTER TYPE "ReactionType" RENAME TO "ReactionType_old";
ALTER TYPE "ReactionType_new" RENAME TO "ReactionType";
DROP TYPE "ReactionType_old";
COMMIT;

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "anonymous" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "headline" TEXT,
ADD COLUMN     "reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "role" TEXT,
ADD COLUMN     "tenureMonths" INTEGER,
ADD COLUMN     "type" "PostType" NOT NULL DEFAULT 'UPDATE';

-- CreateIndex
CREATE INDEX "Post_type_createdAt_idx" ON "Post"("type", "createdAt");

-- CreateIndex
CREATE INDEX "Post_companyId_idx" ON "Post"("companyId");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

