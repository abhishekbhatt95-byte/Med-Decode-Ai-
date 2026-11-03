-- Allow authenticated users to read confidence scores only for their analyses.
-- Edge Functions using service_role continue to perform server-side inserts.
-- Review flags remain unavailable to ordinary API roles.
BEGIN;

ALTER TABLE public.confidence_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own confidence scores"
  ON public.confidence_scores;

CREATE POLICY "Users can view own confidence scores"
  ON public.confidence_scores
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.analyses a
      JOIN public.documents d ON d.id = a.document_id
      WHERE a.id = confidence_scores.analysis_id
        AND d.user_id = auth.uid()
    )
  );

REVOKE ALL PRIVILEGES ON TABLE public.confidence_scores
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.confidence_scores TO authenticated;

ALTER TABLE public.review_flags ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.review_flags
  FROM PUBLIC, anon, authenticated;

COMMIT;
