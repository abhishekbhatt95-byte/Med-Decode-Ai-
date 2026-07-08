CREATE OR REPLACE FUNCTION public.try_increment_daily_usage(p_user_id uuid, p_date date, p_cap int)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int;
BEGIN
  INSERT INTO public.usage (user_id, date, count)
  VALUES (p_user_id, p_date, 1)
  ON CONFLICT (user_id, date) DO UPDATE
    SET count = public.usage.count + 1
    WHERE public.usage.count < p_cap
  RETURNING count INTO v_count;

  RETURN v_count IS NOT NULL;
END;
$$;

DROP FUNCTION IF EXISTS public.increment_daily_usage(uuid, date);
