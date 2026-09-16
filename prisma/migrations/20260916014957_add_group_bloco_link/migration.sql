-- AlterTable
ALTER TABLE "Event" ALTER COLUMN "latitude" DROP NOT NULL,
ALTER COLUMN "longitude" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "blocoId" INTEGER;

-- CreateIndex
CREATE INDEX "Group_blocoId_idx" ON "Group"("blocoId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_blocoId_fkey" FOREIGN KEY ("blocoId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
