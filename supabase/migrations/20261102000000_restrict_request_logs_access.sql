-- Restrict request log access to the trusted Edge Function service role.
-- This migration changes permissions only; it does not alter or delete rows.
BEGIN;

ALTER TABLE public.request_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role has full access to request_logs"
  ON public.request_logs;

CREATE POLICY "Service role can access request_logs"
  ON public.request_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL PRIVILEGES ON TABLE public.request_logs
  FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, INSERT ON TABLE public.request_logs TO service_role;

COMMIT;
