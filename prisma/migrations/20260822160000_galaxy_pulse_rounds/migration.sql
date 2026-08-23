CREATE TABLE "galaxy_pulse_rounds" (
    "drawingId" DECIMAL(78,0) NOT NULL,
    "entropy" CHAR(66) NOT NULL,
    "settlementTxHash" CHAR(66) NOT NULL,
    "settledAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "galaxy_pulse_rounds_pkey" PRIMARY KEY ("drawingId")
);

CREATE INDEX "galaxy_pulse_rounds_settledAt_idx" ON "galaxy_pulse_rounds"("settledAt");
