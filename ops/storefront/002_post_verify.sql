-- Read-only verification. A false row or unexpected count blocks activation.
BEGIN READ ONLY;
SELECT to_regclass('"ShopShipment"') IS NOT NULL
  AND to_regclass('"ShopShipmentEvent"') IS NOT NULL
  AND to_regclass('"ShopProductReview"') IS NOT NULL AS tables_ready;
SELECT table_name, COUNT(*) AS columns
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('ShopShipment', 'ShopShipmentEvent', 'ShopProductReview')
GROUP BY table_name ORDER BY table_name;
SELECT conrelid::regclass AS table_name, conname, contype, convalidated
FROM pg_constraint
WHERE conrelid IN ('"ShopShipment"'::regclass, '"ShopShipmentEvent"'::regclass, '"ShopProductReview"'::regclass)
ORDER BY table_name, conname;
SELECT tgname, tgenabled FROM pg_trigger
WHERE tgname = 'laonshop_shipment_event_immutable' AND tgrelid = '"ShopShipmentEvent"'::regclass;
SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'
  AND tablename IN ('ShopShipment', 'ShopShipmentEvent', 'ShopProductReview', 'ShopOrderItem')
ORDER BY tablename, indexname;
COMMIT;
