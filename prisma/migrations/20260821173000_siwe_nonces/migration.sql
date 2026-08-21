CREATE TABLE "siwe_nonces" (
    "nonce" VARCHAR(96) NOT NULL,
    "walletAddress" VARCHAR(42) NOT NULL,
    "issuedAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "siwe_nonces_pkey" PRIMARY KEY ("nonce")
);

CREATE INDEX "siwe_nonces_expiresAt_idx" ON "siwe_nonces"("expiresAt");
