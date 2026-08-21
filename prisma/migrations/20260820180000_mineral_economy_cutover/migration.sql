CREATE TABLE "mineral_economy_cutover" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "cutoverAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mineral_economy_cutover_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "mineral_economy_cutover_singleton_check" CHECK ("id" = 1),
    CONSTRAINT "mineral_economy_cutover_midnight_check"
      CHECK (("cutoverAt" AT TIME ZONE 'UTC')::time = TIME '00:00:00')
);

CREATE OR REPLACE FUNCTION prevent_mineral_economy_cutover_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'mineral economy cutover is immutable';
END;
$$;

CREATE TRIGGER mineral_economy_cutover_immutable
BEFORE UPDATE OR DELETE ON "mineral_economy_cutover"
FOR EACH ROW EXECUTE FUNCTION prevent_mineral_economy_cutover_mutation();
