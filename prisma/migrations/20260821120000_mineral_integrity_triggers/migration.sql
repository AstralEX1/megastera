CREATE OR REPLACE FUNCTION prevent_planet_upgrade_purchase_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'planet upgrade purchase history is immutable';
END;
$$;

CREATE TRIGGER planet_upgrade_purchases_immutable
BEFORE UPDATE OR DELETE ON "planet_upgrade_purchases"
FOR EACH ROW EXECUTE FUNCTION prevent_planet_upgrade_purchase_mutation();

CREATE OR REPLACE FUNCTION prevent_mineral_account_identity_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."ownerAddress" IS DISTINCT FROM OLD."ownerAddress"
     OR NEW."openingBalanceMicros" IS DISTINCT FROM OLD."openingBalanceMicros" THEN
    RAISE EXCEPTION 'mineral account identity is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mineral_accounts_identity_immutable
BEFORE UPDATE ON "mineral_accounts"
FOR EACH ROW EXECUTE FUNCTION prevent_mineral_account_identity_mutation();

CREATE OR REPLACE FUNCTION prevent_ready_backend_planet_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- upgradeLevel, upgradeBonusBps, gifData, gifHash, generationError, and updatedAt remain mutable.
  IF OLD."status" = 'READY' AND (
    NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."ticketPurchaseId" IS DISTINCT FROM OLD."ticketPurchaseId"
    OR NEW."chainId" IS DISTINCT FROM OLD."chainId"
    OR NEW."ticketId" IS DISTINCT FROM OLD."ticketId"
    OR NEW."ownerAddress" IS DISTINCT FROM OLD."ownerAddress"
    OR NEW."seed" IS DISTINCT FROM OLD."seed"
    OR NEW."traitsHash" IS DISTINCT FROM OLD."traitsHash"
    OR NEW."generatorVersion" IS DISTINCT FROM OLD."generatorVersion"
    OR NEW."planetName" IS DISTINCT FROM OLD."planetName"
    OR NEW."planetType" IS DISTINCT FROM OLD."planetType"
    OR NEW."terrain" IS DISTINCT FROM OLD."terrain"
    OR NEW."rarity" IS DISTINCT FROM OLD."rarity"
    OR NEW."satelliteCount" IS DISTINCT FROM OLD."satelliteCount"
    OR NEW."hasRing" IS DISTINCT FROM OLD."hasRing"
    OR NEW."baseMineralsPerDay" IS DISTINCT FROM OLD."baseMineralsPerDay"
    OR NEW."generatedAt" IS DISTINCT FROM OLD."generatedAt"
    OR NEW."status" IS DISTINCT FROM OLD."status"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
  ) THEN
    RAISE EXCEPTION 'READY backend Planet identity/economic fields are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER backend_planets_ready_identity_immutable
BEFORE UPDATE ON "backend_planets"
FOR EACH ROW EXECUTE FUNCTION prevent_ready_backend_planet_mutation();
