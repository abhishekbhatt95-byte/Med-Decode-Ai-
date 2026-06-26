-- =============================================================================
-- MIGRATION: Anonymous Auth Support
-- Purpose:
--   1. Re-point documents.user_id FK from public.profiles → auth.users so
--      anonymous users (who live in auth.users but NOT profiles) can upload.
--   2. Add a trigger that auto-inserts a minimal profiles row for every new
--      auth.users entry (covers both real sign-ups and anonymous sign-ins).
--   3. Tighten RLS on documents: remove the insecure "user_id IS NULL" escape
--      hatch now that every visitor has a real auth.uid().
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Switch documents.user_id FK to auth.users
-- -----------------------------------------------------------------------------

-- Drop the old FK that pointed to public.profiles
ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_user_id_fkey;

-- Add new FK pointing directly at auth.users
ALTER TABLE public.documents
  ADD CONSTRAINT documents_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;


-- -----------------------------------------------------------------------------
-- 2. Auto-create a minimal profile row for every new auth.users entry
--    (covers anonymous sign-ins as well as real sign-ups)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    -- For real users, try to pull name from raw_user_meta_data
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL),
    -- Anonymous users get 'guest' role; real users get 'user'
    CASE WHEN (NEW.raw_user_meta_data->>'is_anonymous')::boolean IS TRUE
         THEN 'guest'
         ELSE 'user'
    END
  )
  ON CONFLICT (id) DO NOTHING; -- idempotent: skip if profile already exists
  RETURN NEW;
END;
$$;

-- Attach trigger (drop first to make this re-runnable)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- -----------------------------------------------------------------------------
-- 3. Tighten RLS on documents: drop old permissive policies, add strict ones
-- -----------------------------------------------------------------------------

-- Remove old policies that allowed user_id IS NULL (guest bypass)
DROP POLICY IF EXISTS "Users can view their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON public.documents;

-- Re-create with strict auth.uid() = user_id (no null escape hatch)
CREATE POLICY "documents_select_own"
  ON public.documents
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "documents_insert_own"
  ON public.documents
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "documents_update_own"
  ON public.documents
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "documents_delete_own"
  ON public.documents
  FOR DELETE
  USING (auth.uid() = user_id);


-- -----------------------------------------------------------------------------
-- 4. Similarly tighten analyses / extracted_text / medicines
--    (these inherit ownership via documents, so just update the subquery check)
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view analyses for their documents" ON public.analyses;
DROP POLICY IF EXISTS "Service role can insert analyses" ON public.analyses;
DROP POLICY IF EXISTS "Users can view extracted text for their documents" ON public.extracted_text;

-- Analyses: user sees rows whose parent document belongs to them
CREATE POLICY "analyses_select_own"
  ON public.analyses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.documents
      WHERE documents.id = analyses.document_id
        AND documents.user_id = auth.uid()
    )
  );

-- Extracted text: same ownership chain
CREATE POLICY "extracted_text_select_own"
  ON public.extracted_text
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.documents
      JOIN public.analyses ON analyses.document_id = documents.id
      WHERE analyses.id = extracted_text.document_id
        AND documents.user_id = auth.uid()
    )
  );
