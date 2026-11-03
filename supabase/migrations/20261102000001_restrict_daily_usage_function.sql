-- Keep quota increments available to trusted Edge Functions only.
-- The function is SECURITY DEFINER, so callers must not be able to select an
-- arbitrary user_id through the public PostgREST API.
BEGIN;

CREATE OR REPLACE FUNCTION public.try_increment_daily_usage(
  p_user_id uuid,
  p_date date,
  p_cap integer,
  p_feature text DEFAULT 'analysis'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.usage (user_id, date, count, feature)
  VALUES (p_user_id, p_date, 1, p_feature)
  ON CONFLICT (user_id, date, feature) DO UPDATE
    SET count = public.usage.count + 1
    WHERE public.usage.count < p_cap
  RETURNING count INTO v_count;

  RETURN v_count IS NOT NULL;
END;
$$;

REVOKE ALL PRIVILEGES
  ON FUNCTION public.try_increment_daily_usage(uuid, date, integer, text)
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE
  ON FUNCTION public.try_increment_daily_usage(uuid, date, integer, text)
  TO service_role;

COMMIT;
