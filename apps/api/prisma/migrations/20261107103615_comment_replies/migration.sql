-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'REPLY';

-- DropIndex
DROP INDEX "Comment_postId_createdAt_idx";

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "parentId" TEXT;

-- CreateIndex
CREATE INDEX "Comment_postId_parentId_createdAt_idx" ON "Comment"("postId", "parentId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_parentId_createdAt_idx" ON "Comment"("parentId", "createdAt");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "replyToId" TEXT;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
