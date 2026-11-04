-- LAONSHOP verified purchase reviews + operator-recorded shipping.
-- Forward-only. Run only after separate approval, backup and isolated verification.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('laonshop:storefront:additive:v1'));
CREATE UNIQUE INDEX IF NOT EXISTS "ShopOrder_id_userId_key" ON "ShopOrder"("id", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "ShopOrderItem_id_orderId_productId_key" ON "ShopOrderItem"("id", "orderId", "productId");

CREATE TABLE IF NOT EXISTS "ShopShipment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orderId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "carrier" TEXT NOT NULL,
  "trackingNumber" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SHIPPED',
  "shippedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShopShipment_orderId_userId_fkey" FOREIGN KEY ("orderId", "userId") REFERENCES "ShopOrder"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ShopShipment_orderId_key" ON "ShopShipment"("orderId");
CREATE UNIQUE INDEX IF NOT EXISTS "ShopShipment_orderId_userId_key" ON "ShopShipment"("orderId", "userId");

CREATE TABLE IF NOT EXISTS "ShopShipmentEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shipmentId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "carrier" TEXT NOT NULL,
  "trackingNumber" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShopShipmentEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "ShopShipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ShopShipmentEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "ShopUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ShopShipmentEvent_shipmentId_createdAt_idx" ON "ShopShipmentEvent"("shipmentId", "createdAt");

CREATE TABLE IF NOT EXISTS "ShopProductReview" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orderItemId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShopProductReview_orderId_userId_fkey" FOREIGN KEY ("orderId", "userId") REFERENCES "ShopOrder"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ShopProductReview_orderItemId_orderId_productId_fkey" FOREIGN KEY ("orderItemId", "orderId", "productId") REFERENCES "ShopOrderItem"("id", "orderId", "productId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ShopProductReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ShopUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ShopProductReview_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ShopProductReview_orderItemId_key" ON "ShopProductReview"("orderItemId");
CREATE UNIQUE INDEX IF NOT EXISTS "ShopProductReview_orderItemId_orderId_productId_key" ON "ShopProductReview"("orderItemId", "orderId", "productId");
CREATE INDEX IF NOT EXISTS "ShopProductReview_productId_createdAt_idx" ON "ShopProductReview"("productId", "createdAt");
CREATE INDEX IF NOT EXISTS "ShopProductReview_userId_createdAt_idx" ON "ShopProductReview"("userId", "createdAt");

DO $checks$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conname = 'ShopProductReview_rating_check' AND conrelid = '"ShopProductReview"'::regclass) THEN
    ALTER TABLE "ShopProductReview" ADD CONSTRAINT "ShopProductReview_rating_check" CHECK ("rating" BETWEEN 1 AND 5);
  END IF;
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conname = 'ShopProductReview_content_check' AND conrelid = '"ShopProductReview"'::regclass) THEN
    ALTER TABLE "ShopProductReview" ADD CONSTRAINT "ShopProductReview_content_check" CHECK (char_length(btrim("content")) BETWEEN 10 AND 2000);
  END IF;
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conname = 'ShopShipment_valid_check' AND conrelid = '"ShopShipment"'::regclass) THEN
    ALTER TABLE "ShopShipment" ADD CONSTRAINT "ShopShipment_valid_check" CHECK (
      "carrier" IN ('CJ', 'HANJIN', 'LOTTE', 'POST', 'LOGEN', 'CU', 'GS') AND
      "trackingNumber" ~ '^[0-9]{8,20}$' AND
      (("status" = 'SHIPPED' AND "deliveredAt" IS NULL) OR ("status" = 'DELIVERED' AND "deliveredAt" IS NOT NULL AND "deliveredAt" >= "shippedAt"))
    );
  END IF;
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conname = 'ShopShipmentEvent_valid_check' AND conrelid = '"ShopShipmentEvent"'::regclass) THEN
    ALTER TABLE "ShopShipmentEvent" ADD CONSTRAINT "ShopShipmentEvent_valid_check" CHECK (
      "action" IN ('SHIPPED', 'TRACKING_CORRECTED', 'DELIVERED') AND char_length(COALESCE("note", '')) <= 500 AND
      "carrier" IN ('CJ', 'HANJIN', 'LOTTE', 'POST', 'LOGEN', 'CU', 'GS') AND "trackingNumber" ~ '^[0-9]{8,20}$'
    );
  END IF;
END $checks$;

CREATE OR REPLACE FUNCTION laonshop_preserve_shipment_event() RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  RAISE EXCEPTION 'Shipment events are append-only';
END $function$;
DO $trigger$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_trigger WHERE tgname = 'laonshop_shipment_event_immutable' AND tgrelid = '"ShopShipmentEvent"'::regclass) THEN
    CREATE TRIGGER laonshop_shipment_event_immutable BEFORE UPDATE OR DELETE ON "ShopShipmentEvent" FOR EACH ROW EXECUTE FUNCTION laonshop_preserve_shipment_event();
  END IF;
END $trigger$;
COMMIT;
