-- Minerals Economy v2 account state and Planet upgrade history.
ALTER TABLE "backend_planets"
  ADD COLUMN "upgradeLevel" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "upgradeBonusBps" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "mineral_accounts" (
    "id" UUID NOT NULL,
    "ownerAddress" VARCHAR(42) NOT NULL,
    "openingBalanceMicros" BIGINT NOT NULL,
    "balanceMicros" BIGINT NOT NULL,
    "lastSettledAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mineral_accounts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "mineral_accounts_ownerAddress_lower_check" CHECK ("ownerAddress" = lower("ownerAddress")),
    CONSTRAINT "mineral_accounts_openingBalanceMicros_nonnegative_check" CHECK ("openingBalanceMicros" >= 0),
    CONSTRAINT "mineral_accounts_balanceMicros_nonnegative_check" CHECK ("balanceMicros" >= 0)
);

CREATE TABLE "planet_upgrade_purchases" (
    "id" UUID NOT NULL,
    "planetId" UUID NOT NULL,
    "walletAddress" VARCHAR(42) NOT NULL,
    "targetLevel" INTEGER NOT NULL,
    "bonusBpsAfter" INTEGER NOT NULL,
    "costMicros" BIGINT NOT NULL,
    "purchasedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "planet_upgrade_purchases_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "planet_upgrade_purchases_targetLevel_check" CHECK ("targetLevel" BETWEEN 1 AND 3),
    CONSTRAINT "planet_upgrade_purchases_bonusBpsAfter_nonnegative_check" CHECK ("bonusBpsAfter" >= 0),
    CONSTRAINT "planet_upgrade_purchases_costMicros_nonnegative_check" CHECK ("costMicros" >= 0)
);

ALTER TABLE "backend_planets"
  ADD CONSTRAINT "backend_planets_upgradeLevel_check" CHECK ("upgradeLevel" BETWEEN 0 AND 3),
  ADD CONSTRAINT "backend_planets_upgradeBonusBps_nonnegative_check" CHECK ("upgradeBonusBps" >= 0);

CREATE UNIQUE INDEX "mineral_accounts_ownerAddress_key"
  ON "mineral_accounts"("ownerAddress");
CREATE UNIQUE INDEX "planet_upgrade_purchases_planetId_targetLevel_key"
  ON "planet_upgrade_purchases"("planetId", "targetLevel");
CREATE INDEX "planet_upgrade_purchases_walletAddress_purchasedAt_idx"
  ON "planet_upgrade_purchases"("walletAddress", "purchasedAt");

ALTER TABLE "planet_upgrade_purchases"
  ADD CONSTRAINT "planet_upgrade_purchases_planetId_fkey"
  FOREIGN KEY ("planetId") REFERENCES "backend_planets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
