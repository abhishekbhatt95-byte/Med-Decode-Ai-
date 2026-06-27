-- =============================================================================
-- MIGRATION: Actually fix the guest-access RLS hole
--
-- The previous migration (20260627000001_anonymous_auth.sql) tried to drop
-- the old "user_id IS NULL OR auth.uid() = user_id" policies, but it used the
-- wrong policy names (e.g. "Users can view their own documents" instead of
-- the real name "Users can select own or guest documents"). DROP POLICY IF
-- EXISTS silently no-ops on a non-matching name, so the original insecure
-- policies were NEVER actually removed. Since Postgres combines multiple
-- permissive policies for the same command with OR, the old loose policy
-- was still in effect the whole time, fully re-opening the hole the new
-- "documents_select_own" etc. policies were supposed to close.
--
-- This migration drops the REAL old policies (exact names from
-- 20260625000000_init_schema.sql) and fixes a second, independent bug in
-- the new extracted_text policy (it compared extracted_text.document_id
-- against analyses.id instead of documents.id, so it never matched anyone).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Drop the REAL vulnerable policies on documents
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can select own or guest documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert own or guest documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update own or guest documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete own or guest documents" ON public.documents;

-- (documents_select_own / insert_own / update_own / delete_own from the
-- previous migration are correct as-is and remain in place.)

-- -----------------------------------------------------------------------------
-- 2. Drop the REAL vulnerable policy on analyses
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own or guest analyses" ON public.analyses;

-- (analyses_select_own from the previous migration is correct and remains.)

-- -----------------------------------------------------------------------------
-- 3. Drop the REAL vulnerable policy on extracted_text, and replace the
--    broken extracted_text_select_own policy with a correct one
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own or guest extracted text" ON public.extracted_text;
DROP POLICY IF EXISTS "extracted_text_select_own" ON public.extracted_text;

CREATE POLICY "extracted_text_select_own"
  ON public.extracted_text
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.documents
      WHERE documents.id = extracted_text.document_id
        AND documents.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 4. medicines needs no change — its policy checks "exists in analyses",
--    and that subquery is itself subject to analyses' own RLS, so it
--    automatically inherits the fix from step 2.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 5. Sanity check (run manually after applying, in the SQL editor):
--
--   select tablename, policyname, qual
--   from pg_policies
--   where tablename in ('documents','analyses','extracted_text','medicines')
--   order by tablename, policyname;
--
-- You should NOT see "or guest" or "IS NULL" anywhere in the `qual` column
-- for documents/analyses/extracted_text after this runs.
-- -----------------------------------------------------------------------------
