-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "resolution" TEXT,
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "title" TEXT;

-- CreateIndex
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");
