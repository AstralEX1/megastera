CREATE TYPE "BackendPlanetStatus" AS ENUM ('READY', 'FAILED');

CREATE TABLE "backend_planets" (
    "id" UUID NOT NULL,
    "ticketPurchaseId" UUID NOT NULL,
    "chainId" INTEGER NOT NULL,
    "ticketId" DECIMAL(78,0) NOT NULL,
    "ownerAddress" VARCHAR(42) NOT NULL,
    "seed" CHAR(66) NOT NULL,
    "traitsHash" CHAR(66) NOT NULL,
    "generatorVersion" INTEGER NOT NULL,
    "planetName" VARCHAR(96) NOT NULL,
    "planetType" VARCHAR(32) NOT NULL,
    "terrain" VARCHAR(32) NOT NULL,
    "rarity" VARCHAR(16) NOT NULL,
    "satelliteCount" INTEGER NOT NULL,
    "hasRing" BOOLEAN NOT NULL,
    "baseMineralsPerDay" BIGINT NOT NULL,
    "generatedAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "BackendPlanetStatus" NOT NULL DEFAULT 'READY',
    "gifData" BYTEA,
    "gifHash" CHAR(66),
    "generationError" VARCHAR(512),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "backend_planets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "backend_planets_ticketPurchaseId_key" ON "backend_planets"("ticketPurchaseId");
CREATE INDEX "backend_planets_ownerAddress_generatedAt_idx" ON "backend_planets"("ownerAddress", "generatedAt");
CREATE INDEX "backend_planets_status_createdAt_idx" ON "backend_planets"("status", "createdAt");

ALTER TABLE "backend_planets"
  ADD CONSTRAINT "backend_planets_ticketPurchaseId_fkey"
  FOREIGN KEY ("ticketPurchaseId") REFERENCES "ticket_purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
