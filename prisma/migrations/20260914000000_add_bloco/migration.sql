CREATE TYPE "BlocoStatus" AS ENUM ('UPCOMING', 'LIVE', 'FINISHED', 'CANCELLED');

CREATE TABLE "Bloco" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "city" TEXT,
    "neighborhood" TEXT,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "status" "BlocoStatus" NOT NULL DEFAULT 'UPCOMING',
    "estimatedPeople" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bloco_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Bloco_status_idx" ON "Bloco"("status");
CREATE INDEX "Bloco_startAt_idx" ON "Bloco"("startAt");
CREATE INDEX "Bloco_city_idx" ON "Bloco"("city");
