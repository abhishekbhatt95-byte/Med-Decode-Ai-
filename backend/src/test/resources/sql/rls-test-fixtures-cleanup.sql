-- =============================================================================
-- MedDecode AI Phase 3: cleanup for the synthetic RLS fixtures
--
-- MANUAL REVIEW / MANUAL EXECUTION ONLY. Run only in disposable project
-- qcxbtqhfhcuciwtlihjn using the SQL Editor as postgres.
-- Reuse the same six UUID values used in rls-test-fixtures-setup.sql.
--
-- Deletes only the two exact fixture documents when ID, owner UUID, and
-- synthetic file_path marker all match. Child rows are removed by the existing
-- ON DELETE CASCADE foreign keys. Auth users and profiles are never deleted.
-- =============================================================================

BEGIN;

DO $fixture_cleanup$
DECLARE
    v_user_a uuid := '__USER_A_UUID__'::uuid;
    v_user_b uuid := '__USER_B_UUID__'::uuid;
    v_document_a uuid := '__DOCUMENT_A_UUID__'::uuid;
    v_document_b uuid := '__DOCUMENT_B_UUID__'::uuid;
    v_deleted integer;
BEGIN
    IF current_database() <> 'postgres' OR current_user <> 'postgres' THEN
        RAISE EXCEPTION 'Stop: run cleanup in the disposable postgres database as postgres';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.documents
        WHERE id = v_document_a
          AND (user_id IS DISTINCT FROM v_user_a
               OR file_path IS DISTINCT FROM 'rls-phase3-fixture/' || v_document_a::text || '.pdf')
    ) OR EXISTS (
        SELECT 1 FROM public.documents
        WHERE id = v_document_b
          AND (user_id IS DISTINCT FROM v_user_b
               OR file_path IS DISTINCT FROM 'rls-phase3-fixture/' || v_document_b::text || '.pdf')
    ) THEN
        RAISE EXCEPTION 'Cleanup stopped: a fixture document ID exists with an unexpected owner or file_path';
    END IF;

    DELETE FROM public.documents
    WHERE id = v_document_a
      AND user_id = v_user_a
      AND file_path = 'rls-phase3-fixture/' || v_document_a::text || '.pdf';
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    IF v_deleted NOT IN (0, 1) THEN
        RAISE EXCEPTION 'Unexpected number of User A fixture documents deleted: %', v_deleted;
    END IF;

    DELETE FROM public.documents
    WHERE id = v_document_b
      AND user_id = v_user_b
      AND file_path = 'rls-phase3-fixture/' || v_document_b::text || '.pdf';
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    IF v_deleted NOT IN (0, 1) THEN
        RAISE EXCEPTION 'Unexpected number of User B fixture documents deleted: %', v_deleted;
    END IF;
END;
$fixture_cleanup$;

COMMIT;
