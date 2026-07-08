ALTER TABLE public.usage ADD COLUMN IF NOT EXISTS feature text DEFAULT 'analysis';

ALTER TABLE public.usage DROP CONSTRAINT IF EXISTS usage_user_date_unique;

ALTER TABLE public.usage ADD CONSTRAINT usage_user_date_feature_unique UNIQUE (user_id, date, feature);

DROP FUNCTION IF EXISTS public.try_increment_daily_usage(uuid, date, int);

CREATE OR REPLACE FUNCTION public.try_increment_daily_usage(p_user_id uuid, p_date date, p_cap int, p_feature text DEFAULT 'analysis')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int;
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
