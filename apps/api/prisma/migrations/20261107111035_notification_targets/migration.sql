-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "commentId" TEXT,
ADD COLUMN     "postId" TEXT;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Notification_postId_idx" ON "Notification"("postId");

-- CreateIndex
CREATE INDEX "Notification_commentId_idx" ON "Notification"("commentId");

-- Backfill: older post notifications stored the post id in "entityId".
UPDATE "Notification" n SET "postId" = n."entityId", "entityId" = NULL
WHERE n."type" IN ('REACTION', 'COMMENT', 'REPLY')
  AND EXISTS (SELECT 1 FROM "Post" p WHERE p."id" = n."entityId");
