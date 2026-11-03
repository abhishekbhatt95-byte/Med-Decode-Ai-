-- =============================================================================
-- MedDecode AI Phase 3: synthetic PostgreSQL RLS fixtures
--
-- MANUAL REVIEW / MANUAL EXECUTION ONLY. This file is not run by Maven.
-- Run this only in the Supabase SQL Editor for disposable project
-- qcxbtqhfhcuciwtlihjn, after visually confirming the project URL.
-- The SQL Editor session must be the postgres database owner.
--
-- Replace all six UUID placeholders before execution:
--   __USER_A_UUID__       Supabase Auth user UUID for the disposable User A JWT
--   __USER_B_UUID__       Supabase Auth user UUID for the disposable User B JWT
--   __DOCUMENT_A_UUID__   New unique UUID for synthetic document A
--   __DOCUMENT_B_UUID__   New unique UUID for synthetic document B
--   __ANALYSIS_A_UUID__   New unique UUID for synthetic analysis A
--   __ANALYSIS_B_UUID__   New unique UUID for synthetic analysis B
--
-- The two Auth users must already exist. Their public.profiles rows should have
-- been created by the project's auth.users trigger. This script does not create
-- Auth users, profiles, service credentials, policies, grants, or database roles.
-- All inserted content is synthetic. No Storage objects are uploaded.
-- =============================================================================

BEGIN;

DO $fixture_guard$
DECLARE
    v_user_a uuid := '__USER_A_UUID__'::uuid;
    v_user_b uuid := '__USER_B_UUID__'::uuid;
    v_document_a uuid := '__DOCUMENT_A_UUID__'::uuid;
    v_document_b uuid := '__DOCUMENT_B_UUID__'::uuid;
    v_analysis_a uuid := '__ANALYSIS_A_UUID__'::uuid;
    v_analysis_b uuid := '__ANALYSIS_B_UUID__'::uuid;
BEGIN
    IF current_database() <> 'postgres' OR current_user <> 'postgres' THEN
        RAISE EXCEPTION 'Stop: run this fixture script in the disposable postgres database as postgres';
    END IF;

    IF v_user_a = v_user_b THEN
        RAISE EXCEPTION 'User A and User B must be different Auth identities';
    END IF;
    IF v_document_a = v_document_b OR v_analysis_a = v_analysis_b THEN
        RAISE EXCEPTION 'Document and analysis fixture IDs must be unique';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_a)
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_b) THEN
        RAISE EXCEPTION 'Both disposable Auth users must exist before creating fixtures';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_a)
       OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_b) THEN
        RAISE EXCEPTION 'Both Auth users must have profile rows created by the existing Auth trigger';
    END IF;

    IF EXISTS (SELECT 1 FROM public.documents WHERE id IN (v_document_a, v_document_b))
       OR EXISTS (SELECT 1 FROM public.analyses WHERE id IN (v_analysis_a, v_analysis_b)) THEN
        RAISE EXCEPTION 'One or more fixture IDs already exist; generate fresh UUIDs and review before retrying';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.documents
        WHERE file_path IN (
            'rls-phase3-fixture/' || v_document_a::text || '.pdf',
            'rls-phase3-fixture/' || v_document_b::text || '.pdf'
        )
    ) THEN
        RAISE EXCEPTION 'A fixture file_path already exists; generate fresh document UUIDs';
    END IF;
END;
$fixture_guard$;

-- Parent documents: each row is owned by exactly one disposable Auth user.
INSERT INTO public.documents
    (id, user_id, name, file_path, mime_type, size, status, document_type)
VALUES
    ('__DOCUMENT_A_UUID__'::uuid, '__USER_A_UUID__'::uuid,
     'Synthetic RLS fixture - User A',
     'rls-phase3-fixture/__DOCUMENT_A_UUID__.pdf',
     'application/pdf', 128, 'completed', 'blood_report'),
    ('__DOCUMENT_B_UUID__'::uuid, '__USER_B_UUID__'::uuid,
     'Synthetic RLS fixture - User B',
     'rls-phase3-fixture/__DOCUMENT_B_UUID__.pdf',
     'application/pdf', 128, 'completed', 'blood_report');

-- One analysis per document. These IDs are supplied to the Maven suite as
-- MEDDECODE_RLS_ANALYSIS_A_ID and MEDDECODE_RLS_ANALYSIS_B_ID.
INSERT INTO public.analyses
    (id, document_id, summary, structured_output, doctor_questions)
VALUES
    ('__ANALYSIS_A_UUID__'::uuid, '__DOCUMENT_A_UUID__'::uuid,
     'Synthetic analysis fixture for RLS User A',
     '{"fixture": true, "owner": "user-a"}'::jsonb,
     '["Synthetic question for RLS test A"]'::jsonb),
    ('__ANALYSIS_B_UUID__'::uuid, '__DOCUMENT_B_UUID__'::uuid,
     'Synthetic analysis fixture for RLS User B',
     '{"fixture": true, "owner": "user-b"}'::jsonb,
     '["Synthetic question for RLS test B"]'::jsonb);

INSERT INTO public.extracted_text
    (document_id, raw_text, ocr_provider, confidence)
VALUES
    ('__DOCUMENT_A_UUID__'::uuid, 'Synthetic OCR text owned by RLS User A', 'tesseract', 0.99),
    ('__DOCUMENT_B_UUID__'::uuid, 'Synthetic OCR text owned by RLS User B', 'tesseract', 0.99);

INSERT INTO public.medicines
    (analysis_id, brand_name, generic_name, category, confidence_score)
VALUES
    ('__ANALYSIS_A_UUID__'::uuid, 'Synthetic Test Medicine A', 'synthetic-a', 'test-fixture', 91.0),
    ('__ANALYSIS_B_UUID__'::uuid, 'Synthetic Test Medicine B', 'synthetic-b', 'test-fixture', 92.0);

INSERT INTO public.confidence_scores
    (analysis_id, ocr_confidence, ai_confidence, overall_confidence)
VALUES
    ('__ANALYSIS_A_UUID__'::uuid, 0.99, 0.98, 0.985),
    ('__ANALYSIS_B_UUID__'::uuid, 0.98, 0.97, 0.975);

-- These rows prove that ordinary roles cannot query review_flags. The test
-- expects an ACL-level permission-denied error, not a zero-row RLS filter.
INSERT INTO public.review_flags
    (analysis_id, flag_reason, flagged_by, status)
VALUES
    ('__ANALYSIS_A_UUID__'::uuid, 'Synthetic RLS test flag A', '__USER_A_UUID__'::uuid, 'pending'),
    ('__ANALYSIS_B_UUID__'::uuid, 'Synthetic RLS test flag B', '__USER_B_UUID__'::uuid, 'pending');

COMMIT;

-- Copy these two values exactly into the local PowerShell environment.
SELECT 'MEDDECODE_RLS_ANALYSIS_A_ID' AS environment_variable,
       '__ANALYSIS_A_UUID__' AS value
UNION ALL
SELECT 'MEDDECODE_RLS_ANALYSIS_B_ID',
       '__ANALYSIS_B_UUID__';
