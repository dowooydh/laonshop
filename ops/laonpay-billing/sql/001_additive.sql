-- LAONPAY billing ledger additive schema.
-- Forward-only: existing tables/data and legacy ShopBillingCard columns are not removed.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('laonshop:laonpay-billing:additive:v1'));

DO $block$
BEGIN
  IF to_regclass('"ShopUser"') IS NULL OR to_regclass('"ShopOrder"') IS NULL THEN
    RAISE EXCEPTION 'LAONPAY billing prerequisites are missing';
  END IF;
END
$block$;

DO $block$
BEGIN
  CREATE TYPE "ShopBillingPaymentMethodStatus" AS ENUM (
    'ACTIVE', 'DEREGISTERING', 'DEREGISTERED', 'UNKNOWN'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END
$block$;

DO $block$
BEGIN
  CREATE TYPE "ShopBillingRegistrationStatus" AS ENUM (
    'REQUESTING', 'PENDING', 'PROCESSING', 'SUCCEEDED', 'DECLINED', 'UNKNOWN', 'EXPIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END
$block$;

DO $block$
BEGIN
  CREATE TYPE "ShopBillingChargeStatus" AS ENUM (
    'REQUESTING', 'PENDING', 'PAID', 'DECLINED', 'UNKNOWN', 'CANCEL_REQUESTED', 'CANCELED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END
$block$;

DO $block$
BEGIN
  CREATE TYPE "ShopBillingCancelRequestStatus" AS ENUM (
    'REQUESTING', 'REQUESTED', 'PROCESSING', 'DONE', 'REJECTED', 'UNKNOWN'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END
$block$;

CREATE TABLE IF NOT EXISTS "ShopBillingPaymentMethod" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "laonpayPaymentMethodId" TEXT NOT NULL,
  "cardName" TEXT NOT NULL,
  "cardLast4" TEXT NOT NULL,
  "cardType" TEXT NOT NULL,
  "status" "ShopBillingPaymentMethodStatus" NOT NULL,
  "deregisterIdempotencyKey" TEXT,
  "deregisterRequestAttempts" INTEGER NOT NULL DEFAULT 0,
  "providerRegisteredAt" TIMESTAMP(3) NOT NULL,
  "providerVerifiedAt" TIMESTAMP(3),
  "providerDeregisteredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShopBillingPaymentMethod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ShopBillingRegistration" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "laonpayRegistrationId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "requestAttempts" INTEGER NOT NULL DEFAULT 0,
  "status" "ShopBillingRegistrationStatus" NOT NULL DEFAULT 'REQUESTING',
  "expiresAt" TIMESTAMP(3),
  "paymentMethodId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShopBillingRegistration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ShopBillingCharge" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "paymentMethodId" TEXT NOT NULL,
  "laonpayChargeId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "requestAttempts" INTEGER NOT NULL DEFAULT 0,
  "amount" INTEGER NOT NULL,
  "status" "ShopBillingChargeStatus" NOT NULL DEFAULT 'REQUESTING',
  "providerPaymentId" TEXT,
  "failureCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShopBillingCharge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ShopBillingCancelRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "chargeId" TEXT NOT NULL,
  "laonpayCancelRequestId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "reason" TEXT,
  "rejectReason" TEXT,
  "requestSentAt" TIMESTAMP(3),
  "providerProcessedAt" TIMESTAMP(3),
  "status" "ShopBillingCancelRequestStatus" NOT NULL DEFAULT 'REQUESTING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShopBillingCancelRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShopOrder_id_userId_key"
  ON "ShopOrder"("id", "userId");

CREATE UNIQUE INDEX IF NOT EXISTS "ShopBillingPaymentMethod_laonpayPaymentMethodId_key"
  ON "ShopBillingPaymentMethod"("laonpayPaymentMethodId");
CREATE UNIQUE INDEX IF NOT EXISTS "ShopBillingPaymentMethod_deregisterIdempotencyKey_key"
  ON "ShopBillingPaymentMethod"("deregisterIdempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "ShopBillingPaymentMethod_id_userId_key"
  ON "ShopBillingPaymentMethod"("id", "userId");
CREATE INDEX IF NOT EXISTS "ShopBillingPaymentMethod_userId_status_createdAt_idx"
  ON "ShopBillingPaymentMethod"("userId", "status", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "ShopBillingRegistration_laonpayRegistrationId_key"
  ON "ShopBillingRegistration"("laonpayRegistrationId");
CREATE UNIQUE INDEX IF NOT EXISTS "ShopBillingRegistration_idempotencyKey_key"
  ON "ShopBillingRegistration"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "ShopBillingRegistration_userId_status_createdAt_idx"
  ON "ShopBillingRegistration"("userId", "status", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "ShopBillingCharge_orderId_key"
  ON "ShopBillingCharge"("orderId");
CREATE UNIQUE INDEX IF NOT EXISTS "ShopBillingCharge_orderId_userId_key"
  ON "ShopBillingCharge"("orderId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "ShopBillingCharge_laonpayChargeId_key"
  ON "ShopBillingCharge"("laonpayChargeId");
CREATE UNIQUE INDEX IF NOT EXISTS "ShopBillingCharge_idempotencyKey_key"
  ON "ShopBillingCharge"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "ShopBillingCharge_providerPaymentId_key"
  ON "ShopBillingCharge"("providerPaymentId");
CREATE UNIQUE INDEX IF NOT EXISTS "ShopBillingCharge_id_userId_key"
  ON "ShopBillingCharge"("id", "userId");
CREATE INDEX IF NOT EXISTS "ShopBillingCharge_userId_status_createdAt_idx"
  ON "ShopBillingCharge"("userId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "ShopBillingCharge_paymentMethodId_status_idx"
  ON "ShopBillingCharge"("paymentMethodId", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "ShopBillingCancelRequest_chargeId_key"
  ON "ShopBillingCancelRequest"("chargeId");
CREATE UNIQUE INDEX IF NOT EXISTS "ShopBillingCancelRequest_chargeId_userId_key"
  ON "ShopBillingCancelRequest"("chargeId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "ShopBillingCancelRequest_laonpayCancelRequestId_key"
  ON "ShopBillingCancelRequest"("laonpayCancelRequestId");
CREATE UNIQUE INDEX IF NOT EXISTS "ShopBillingCancelRequest_idempotencyKey_key"
  ON "ShopBillingCancelRequest"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "ShopBillingCancelRequest_userId_status_createdAt_idx"
  ON "ShopBillingCancelRequest"("userId", "status", "createdAt");

DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ShopBillingPaymentMethod_userId_fkey'
      AND conrelid = '"ShopBillingPaymentMethod"'::regclass
  ) THEN
    ALTER TABLE "ShopBillingPaymentMethod"
      ADD CONSTRAINT "ShopBillingPaymentMethod_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "ShopUser"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ShopBillingRegistration_userId_fkey'
      AND conrelid = '"ShopBillingRegistration"'::regclass
  ) THEN
    ALTER TABLE "ShopBillingRegistration"
      ADD CONSTRAINT "ShopBillingRegistration_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "ShopUser"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ShopBillingRegistration_paymentMethodId_userId_fkey'
      AND conrelid = '"ShopBillingRegistration"'::regclass
  ) THEN
    ALTER TABLE "ShopBillingRegistration"
      ADD CONSTRAINT "ShopBillingRegistration_paymentMethodId_userId_fkey"
      FOREIGN KEY ("paymentMethodId", "userId")
      REFERENCES "ShopBillingPaymentMethod"("id", "userId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ShopBillingCharge_userId_fkey'
      AND conrelid = '"ShopBillingCharge"'::regclass
  ) THEN
    ALTER TABLE "ShopBillingCharge"
      ADD CONSTRAINT "ShopBillingCharge_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "ShopUser"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ShopBillingCharge_orderId_userId_fkey'
      AND conrelid = '"ShopBillingCharge"'::regclass
  ) THEN
    ALTER TABLE "ShopBillingCharge"
      ADD CONSTRAINT "ShopBillingCharge_orderId_userId_fkey"
      FOREIGN KEY ("orderId", "userId") REFERENCES "ShopOrder"("id", "userId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ShopBillingCharge_paymentMethodId_userId_fkey'
      AND conrelid = '"ShopBillingCharge"'::regclass
  ) THEN
    ALTER TABLE "ShopBillingCharge"
      ADD CONSTRAINT "ShopBillingCharge_paymentMethodId_userId_fkey"
      FOREIGN KEY ("paymentMethodId", "userId")
      REFERENCES "ShopBillingPaymentMethod"("id", "userId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ShopBillingCancelRequest_userId_fkey'
      AND conrelid = '"ShopBillingCancelRequest"'::regclass
  ) THEN
    ALTER TABLE "ShopBillingCancelRequest"
      ADD CONSTRAINT "ShopBillingCancelRequest_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "ShopUser"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ShopBillingCancelRequest_chargeId_userId_fkey'
      AND conrelid = '"ShopBillingCancelRequest"'::regclass
  ) THEN
    ALTER TABLE "ShopBillingCancelRequest"
      ADD CONSTRAINT "ShopBillingCancelRequest_chargeId_userId_fkey"
      FOREIGN KEY ("chargeId", "userId")
      REFERENCES "ShopBillingCharge"("id", "userId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$block$;

COMMIT;
