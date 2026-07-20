-- Read-only metadata verification for the LAONPAY billing additive schema.
-- No application rows or secret-bearing values are selected.

BEGIN TRANSACTION READ ONLY;

DO $block$
DECLARE
  actual_labels TEXT[];
  expected_labels TEXT[];
  enum_name TEXT;
BEGIN
  FOR enum_name, expected_labels IN
    SELECT * FROM (VALUES
      ('ShopBillingPaymentMethodStatus', ARRAY['ACTIVE', 'DEREGISTERING', 'DEREGISTERED', 'UNKNOWN']::TEXT[]),
      ('ShopBillingRegistrationStatus', ARRAY['REQUESTING', 'PENDING', 'PROCESSING', 'SUCCEEDED', 'DECLINED', 'UNKNOWN', 'EXPIRED']::TEXT[]),
      ('ShopBillingChargeStatus', ARRAY['REQUESTING', 'PENDING', 'PAID', 'DECLINED', 'UNKNOWN', 'CANCEL_REQUESTED', 'CANCELED']::TEXT[]),
      ('ShopBillingCancelRequestStatus', ARRAY['REQUESTING', 'REQUESTED', 'PROCESSING', 'DONE', 'REJECTED', 'UNKNOWN']::TEXT[])
    ) AS expected(name, labels)
  LOOP
    SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder)
      INTO actual_labels
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = enum_name;

    IF actual_labels IS DISTINCT FROM expected_labels THEN
      RAISE EXCEPTION 'LAONPAY billing enum contract mismatch: %', enum_name;
    END IF;
  END LOOP;
END
$block$;

DO $block$
DECLARE
  missing_count INTEGER;
BEGIN
  SELECT count(*) INTO missing_count
  FROM (VALUES
    ('ShopBillingPaymentMethod', 'id', 'text', 'NO'),
    ('ShopBillingPaymentMethod', 'userId', 'text', 'NO'),
    ('ShopBillingPaymentMethod', 'laonpayPaymentMethodId', 'text', 'NO'),
    ('ShopBillingPaymentMethod', 'cardName', 'text', 'NO'),
    ('ShopBillingPaymentMethod', 'cardLast4', 'text', 'NO'),
    ('ShopBillingPaymentMethod', 'cardType', 'text', 'NO'),
    ('ShopBillingPaymentMethod', 'status', 'ShopBillingPaymentMethodStatus', 'NO'),
    ('ShopBillingPaymentMethod', 'deregisterIdempotencyKey', 'text', 'YES'),
    ('ShopBillingPaymentMethod', 'deregisterRequestAttempts', 'int4', 'NO'),
    ('ShopBillingPaymentMethod', 'providerRegisteredAt', 'timestamp', 'NO'),
    ('ShopBillingPaymentMethod', 'providerVerifiedAt', 'timestamp', 'YES'),
    ('ShopBillingPaymentMethod', 'providerDeregisteredAt', 'timestamp', 'YES'),
    ('ShopBillingPaymentMethod', 'createdAt', 'timestamp', 'NO'),
    ('ShopBillingPaymentMethod', 'updatedAt', 'timestamp', 'NO'),
    ('ShopBillingRegistration', 'id', 'text', 'NO'),
    ('ShopBillingRegistration', 'userId', 'text', 'NO'),
    ('ShopBillingRegistration', 'laonpayRegistrationId', 'text', 'YES'),
    ('ShopBillingRegistration', 'idempotencyKey', 'text', 'NO'),
    ('ShopBillingRegistration', 'requestFingerprint', 'text', 'NO'),
    ('ShopBillingRegistration', 'requestAttempts', 'int4', 'NO'),
    ('ShopBillingRegistration', 'status', 'ShopBillingRegistrationStatus', 'NO'),
    ('ShopBillingRegistration', 'expiresAt', 'timestamp', 'YES'),
    ('ShopBillingRegistration', 'paymentMethodId', 'text', 'YES'),
    ('ShopBillingRegistration', 'createdAt', 'timestamp', 'NO'),
    ('ShopBillingRegistration', 'updatedAt', 'timestamp', 'NO'),
    ('ShopBillingCharge', 'id', 'text', 'NO'),
    ('ShopBillingCharge', 'userId', 'text', 'NO'),
    ('ShopBillingCharge', 'orderId', 'text', 'NO'),
    ('ShopBillingCharge', 'paymentMethodId', 'text', 'NO'),
    ('ShopBillingCharge', 'laonpayChargeId', 'text', 'YES'),
    ('ShopBillingCharge', 'idempotencyKey', 'text', 'NO'),
    ('ShopBillingCharge', 'requestFingerprint', 'text', 'NO'),
    ('ShopBillingCharge', 'requestAttempts', 'int4', 'NO'),
    ('ShopBillingCharge', 'amount', 'int4', 'NO'),
    ('ShopBillingCharge', 'status', 'ShopBillingChargeStatus', 'NO'),
    ('ShopBillingCharge', 'providerPaymentId', 'text', 'YES'),
    ('ShopBillingCharge', 'failureCode', 'text', 'YES'),
    ('ShopBillingCharge', 'createdAt', 'timestamp', 'NO'),
    ('ShopBillingCharge', 'updatedAt', 'timestamp', 'NO'),
    ('ShopBillingCancelRequest', 'id', 'text', 'NO'),
    ('ShopBillingCancelRequest', 'userId', 'text', 'NO'),
    ('ShopBillingCancelRequest', 'chargeId', 'text', 'NO'),
    ('ShopBillingCancelRequest', 'laonpayCancelRequestId', 'text', 'YES'),
    ('ShopBillingCancelRequest', 'idempotencyKey', 'text', 'NO'),
    ('ShopBillingCancelRequest', 'reason', 'text', 'YES'),
    ('ShopBillingCancelRequest', 'rejectReason', 'text', 'YES'),
    ('ShopBillingCancelRequest', 'requestSentAt', 'timestamp', 'YES'),
    ('ShopBillingCancelRequest', 'providerProcessedAt', 'timestamp', 'YES'),
    ('ShopBillingCancelRequest', 'status', 'ShopBillingCancelRequestStatus', 'NO'),
    ('ShopBillingCancelRequest', 'createdAt', 'timestamp', 'NO'),
    ('ShopBillingCancelRequest', 'updatedAt', 'timestamp', 'NO')
  ) AS expected(table_name, column_name, udt_name, is_nullable)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = current_schema()
      AND c.table_name = expected.table_name
      AND c.column_name = expected.column_name
      AND c.udt_name = expected.udt_name
      AND c.is_nullable = expected.is_nullable
  );

  IF missing_count <> 0 THEN
    RAISE EXCEPTION 'LAONPAY billing required column contract mismatch';
  END IF;
END
$block$;

DO $block$
DECLARE
  unexpected_count INTEGER;
BEGIN
  SELECT count(*) INTO unexpected_count
  FROM information_schema.columns c
  JOIN (VALUES
    ('ShopBillingPaymentMethod', ARRAY[
      'id', 'userId', 'laonpayPaymentMethodId', 'cardName', 'cardLast4',
      'cardType', 'status', 'deregisterIdempotencyKey',
      'deregisterRequestAttempts', 'providerRegisteredAt',
      'providerVerifiedAt', 'providerDeregisteredAt', 'createdAt', 'updatedAt'
    ]::TEXT[]),
    ('ShopBillingRegistration', ARRAY[
      'id', 'userId', 'laonpayRegistrationId', 'idempotencyKey',
      'requestFingerprint', 'requestAttempts', 'status', 'expiresAt',
      'paymentMethodId', 'createdAt', 'updatedAt'
    ]::TEXT[]),
    ('ShopBillingCharge', ARRAY[
      'id', 'userId', 'orderId', 'paymentMethodId', 'laonpayChargeId',
      'idempotencyKey', 'requestFingerprint', 'requestAttempts', 'amount',
      'status', 'providerPaymentId', 'failureCode', 'createdAt', 'updatedAt'
    ]::TEXT[]),
    ('ShopBillingCancelRequest', ARRAY[
      'id', 'userId', 'chargeId', 'laonpayCancelRequestId',
      'idempotencyKey', 'reason', 'rejectReason', 'requestSentAt',
      'providerProcessedAt', 'status', 'createdAt', 'updatedAt'
    ]::TEXT[])
  ) AS expected(table_name, columns)
    ON expected.table_name = c.table_name
  WHERE c.table_schema = current_schema()
    AND NOT (c.column_name = ANY(expected.columns));

  IF unexpected_count <> 0 THEN
    RAISE EXCEPTION 'LAONPAY billing unexpected column detected';
  END IF;
END
$block$;

DO $block$
DECLARE
  mismatch_count INTEGER;
BEGIN
  SELECT count(*) INTO mismatch_count
  FROM (VALUES
    ('ShopBillingPaymentMethod', 'deregisterRequestAttempts', '^0$'),
    ('ShopBillingPaymentMethod', 'createdAt', '^CURRENT_TIMESTAMP$'),
    ('ShopBillingRegistration', 'requestAttempts', '^0$'),
    ('ShopBillingRegistration', 'status', '^''REQUESTING''::'),
    ('ShopBillingRegistration', 'createdAt', '^CURRENT_TIMESTAMP$'),
    ('ShopBillingCharge', 'requestAttempts', '^0$'),
    ('ShopBillingCharge', 'status', '^''REQUESTING''::'),
    ('ShopBillingCharge', 'createdAt', '^CURRENT_TIMESTAMP$'),
    ('ShopBillingCancelRequest', 'status', '^''REQUESTING''::'),
    ('ShopBillingCancelRequest', 'createdAt', '^CURRENT_TIMESTAMP$')
  ) AS expected(table_name, column_name, default_pattern)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = current_schema()
      AND c.table_name = expected.table_name
      AND c.column_name = expected.column_name
      AND c.column_default ~ expected.default_pattern
  );

  IF mismatch_count <> 0 THEN
    RAISE EXCEPTION 'LAONPAY billing default contract mismatch';
  END IF;
END
$block$;

DO $block$
DECLARE
  prohibited_count INTEGER;
BEGIN
  SELECT count(*) INTO prohibited_count
  FROM information_schema.columns c
  WHERE c.table_schema = current_schema()
    AND c.table_name IN (
      'ShopBillingPaymentMethod',
      'ShopBillingRegistration',
      'ShopBillingCharge',
      'ShopBillingCancelRequest'
    )
    AND lower(c.column_name) IN (
      'cardnumber',
      'cardnumb',
      'card_number',
      'cardpassword',
      'card_password',
      'expiry',
      'expiredate',
      'birthday',
      'birthdate',
      'billingtoken',
      'providertoken',
      'pgapi',
      'authorization',
      'privatekey',
      'cardraw'
    );

  IF prohibited_count <> 0 THEN
    RAISE EXCEPTION 'LAONPAY billing prohibited sensitive column detected';
  END IF;
END
$block$;

DO $block$
DECLARE
  expected_record RECORD;
  actual_columns TEXT[];
  actual_unique BOOLEAN;
BEGIN
  FOR expected_record IN
    SELECT * FROM (VALUES
      ('ShopOrder', 'ShopOrder_id_userId_key', TRUE, ARRAY['id', 'userId']::TEXT[]),
      ('ShopBillingPaymentMethod', 'ShopBillingPaymentMethod_pkey', TRUE, ARRAY['id']::TEXT[]),
      ('ShopBillingPaymentMethod', 'ShopBillingPaymentMethod_laonpayPaymentMethodId_key', TRUE, ARRAY['laonpayPaymentMethodId']::TEXT[]),
      ('ShopBillingPaymentMethod', 'ShopBillingPaymentMethod_deregisterIdempotencyKey_key', TRUE, ARRAY['deregisterIdempotencyKey']::TEXT[]),
      ('ShopBillingPaymentMethod', 'ShopBillingPaymentMethod_id_userId_key', TRUE, ARRAY['id', 'userId']::TEXT[]),
      ('ShopBillingPaymentMethod', 'ShopBillingPaymentMethod_userId_status_createdAt_idx', FALSE, ARRAY['userId', 'status', 'createdAt']::TEXT[]),
      ('ShopBillingRegistration', 'ShopBillingRegistration_pkey', TRUE, ARRAY['id']::TEXT[]),
      ('ShopBillingRegistration', 'ShopBillingRegistration_laonpayRegistrationId_key', TRUE, ARRAY['laonpayRegistrationId']::TEXT[]),
      ('ShopBillingRegistration', 'ShopBillingRegistration_idempotencyKey_key', TRUE, ARRAY['idempotencyKey']::TEXT[]),
      ('ShopBillingRegistration', 'ShopBillingRegistration_userId_status_createdAt_idx', FALSE, ARRAY['userId', 'status', 'createdAt']::TEXT[]),
      ('ShopBillingCharge', 'ShopBillingCharge_pkey', TRUE, ARRAY['id']::TEXT[]),
      ('ShopBillingCharge', 'ShopBillingCharge_orderId_key', TRUE, ARRAY['orderId']::TEXT[]),
      ('ShopBillingCharge', 'ShopBillingCharge_orderId_userId_key', TRUE, ARRAY['orderId', 'userId']::TEXT[]),
      ('ShopBillingCharge', 'ShopBillingCharge_laonpayChargeId_key', TRUE, ARRAY['laonpayChargeId']::TEXT[]),
      ('ShopBillingCharge', 'ShopBillingCharge_idempotencyKey_key', TRUE, ARRAY['idempotencyKey']::TEXT[]),
      ('ShopBillingCharge', 'ShopBillingCharge_providerPaymentId_key', TRUE, ARRAY['providerPaymentId']::TEXT[]),
      ('ShopBillingCharge', 'ShopBillingCharge_id_userId_key', TRUE, ARRAY['id', 'userId']::TEXT[]),
      ('ShopBillingCharge', 'ShopBillingCharge_userId_status_createdAt_idx', FALSE, ARRAY['userId', 'status', 'createdAt']::TEXT[]),
      ('ShopBillingCharge', 'ShopBillingCharge_paymentMethodId_status_idx', FALSE, ARRAY['paymentMethodId', 'status']::TEXT[]),
      ('ShopBillingCancelRequest', 'ShopBillingCancelRequest_pkey', TRUE, ARRAY['id']::TEXT[]),
      ('ShopBillingCancelRequest', 'ShopBillingCancelRequest_chargeId_key', TRUE, ARRAY['chargeId']::TEXT[]),
      ('ShopBillingCancelRequest', 'ShopBillingCancelRequest_chargeId_userId_key', TRUE, ARRAY['chargeId', 'userId']::TEXT[]),
      ('ShopBillingCancelRequest', 'ShopBillingCancelRequest_laonpayCancelRequestId_key', TRUE, ARRAY['laonpayCancelRequestId']::TEXT[]),
      ('ShopBillingCancelRequest', 'ShopBillingCancelRequest_idempotencyKey_key', TRUE, ARRAY['idempotencyKey']::TEXT[]),
      ('ShopBillingCancelRequest', 'ShopBillingCancelRequest_userId_status_createdAt_idx', FALSE, ARRAY['userId', 'status', 'createdAt']::TEXT[])
    ) AS expected(table_name, index_name, is_unique, columns)
  LOOP
    actual_columns := NULL;
    actual_unique := NULL;
    SELECT
      ARRAY(
        SELECT attribute.attname::TEXT
        FROM unnest(index_meta.indkey::SMALLINT[]) WITH ORDINALITY AS index_key(attnum, position)
        JOIN pg_attribute attribute
          ON attribute.attrelid = table_meta.oid
         AND attribute.attnum = index_key.attnum
        WHERE index_key.position <= index_meta.indnkeyatts
        ORDER BY index_key.position
      ),
      index_meta.indisunique
    INTO actual_columns, actual_unique
    FROM pg_class index_class
    JOIN pg_index index_meta ON index_meta.indexrelid = index_class.oid
    JOIN pg_class table_meta ON table_meta.oid = index_meta.indrelid
    JOIN pg_namespace namespace ON namespace.oid = table_meta.relnamespace
    WHERE namespace.nspname = current_schema()
      AND table_meta.relname = expected_record.table_name
      AND index_class.relname = expected_record.index_name;

    IF actual_columns IS DISTINCT FROM expected_record.columns
       OR actual_unique IS DISTINCT FROM expected_record.is_unique THEN
      RAISE EXCEPTION 'LAONPAY billing index contract mismatch: %', expected_record.index_name;
    END IF;
  END LOOP;
END
$block$;

DO $block$
DECLARE
  expected_record RECORD;
  actual_source TEXT[];
  actual_target TEXT[];
  actual_target_table TEXT;
  actual_delete "char";
  actual_update "char";
BEGIN
  FOR expected_record IN
    SELECT * FROM (VALUES
      ('ShopBillingPaymentMethod', 'ShopBillingPaymentMethod_userId_fkey', ARRAY['userId']::TEXT[], 'ShopUser', ARRAY['id']::TEXT[]),
      ('ShopBillingRegistration', 'ShopBillingRegistration_userId_fkey', ARRAY['userId']::TEXT[], 'ShopUser', ARRAY['id']::TEXT[]),
      ('ShopBillingRegistration', 'ShopBillingRegistration_paymentMethodId_userId_fkey', ARRAY['paymentMethodId', 'userId']::TEXT[], 'ShopBillingPaymentMethod', ARRAY['id', 'userId']::TEXT[]),
      ('ShopBillingCharge', 'ShopBillingCharge_userId_fkey', ARRAY['userId']::TEXT[], 'ShopUser', ARRAY['id']::TEXT[]),
      ('ShopBillingCharge', 'ShopBillingCharge_orderId_userId_fkey', ARRAY['orderId', 'userId']::TEXT[], 'ShopOrder', ARRAY['id', 'userId']::TEXT[]),
      ('ShopBillingCharge', 'ShopBillingCharge_paymentMethodId_userId_fkey', ARRAY['paymentMethodId', 'userId']::TEXT[], 'ShopBillingPaymentMethod', ARRAY['id', 'userId']::TEXT[]),
      ('ShopBillingCancelRequest', 'ShopBillingCancelRequest_userId_fkey', ARRAY['userId']::TEXT[], 'ShopUser', ARRAY['id']::TEXT[]),
      ('ShopBillingCancelRequest', 'ShopBillingCancelRequest_chargeId_userId_fkey', ARRAY['chargeId', 'userId']::TEXT[], 'ShopBillingCharge', ARRAY['id', 'userId']::TEXT[])
    ) AS expected(source_table, constraint_name, source_columns, target_table, target_columns)
  LOOP
    actual_source := NULL;
    actual_target := NULL;
    actual_target_table := NULL;
    actual_delete := NULL;
    actual_update := NULL;
    SELECT
      ARRAY(
        SELECT attribute.attname::TEXT
        FROM unnest(constraint_meta.conkey) WITH ORDINALITY AS source_key(attnum, position)
        JOIN pg_attribute attribute
          ON attribute.attrelid = source_table_meta.oid
         AND attribute.attnum = source_key.attnum
        ORDER BY source_key.position
      ),
      target_table_meta.relname,
      ARRAY(
        SELECT attribute.attname::TEXT
        FROM unnest(constraint_meta.confkey) WITH ORDINALITY AS target_key(attnum, position)
        JOIN pg_attribute attribute
          ON attribute.attrelid = target_table_meta.oid
         AND attribute.attnum = target_key.attnum
        ORDER BY target_key.position
      ),
      constraint_meta.confdeltype,
      constraint_meta.confupdtype
    INTO actual_source, actual_target_table, actual_target, actual_delete, actual_update
    FROM pg_constraint constraint_meta
    JOIN pg_class source_table_meta ON source_table_meta.oid = constraint_meta.conrelid
    JOIN pg_class target_table_meta ON target_table_meta.oid = constraint_meta.confrelid
    JOIN pg_namespace namespace ON namespace.oid = source_table_meta.relnamespace
    WHERE namespace.nspname = current_schema()
      AND source_table_meta.relname = expected_record.source_table
      AND constraint_meta.conname = expected_record.constraint_name
      AND constraint_meta.contype = 'f';

    IF actual_source IS DISTINCT FROM expected_record.source_columns
       OR actual_target_table IS DISTINCT FROM expected_record.target_table
       OR actual_target IS DISTINCT FROM expected_record.target_columns
       OR actual_delete IS DISTINCT FROM 'r'::"char"
       OR actual_update IS DISTINCT FROM 'c'::"char" THEN
      RAISE EXCEPTION 'LAONPAY billing foreign-key contract mismatch: %', expected_record.constraint_name;
    END IF;
  END LOOP;
END
$block$;

SELECT 'LAONPAY billing schema metadata verified' AS verification_result;

COMMIT;
