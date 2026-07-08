CREATE TABLE IF NOT EXISTS public.usage (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  count integer NOT NULL DEFAULT 0,
  CONSTRAINT usage_user_date_unique UNIQUE (user_id, date)
);

ALTER TABLE public.usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usage_select_own"
  ON public.usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "usage_insert_own"
  ON public.usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "usage_update_own"
  ON public.usage FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.shared_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.shared_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shared_links_select_own"
  ON public.shared_links FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "shared_links_insert_own"
  ON public.shared_links FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "shared_links_delete_own"
  ON public.shared_links FOR DELETE
  USING (auth.uid() = user_id);

GRANT SELECT ON public.usage TO authenticated, anon;
GRANT INSERT ON public.usage TO authenticated, anon;
GRANT UPDATE ON public.usage TO authenticated, anon;
GRANT SELECT ON public.shared_links TO authenticated, anon;
GRANT INSERT ON public.shared_links TO authenticated, anon;
GRANT DELETE ON public.shared_links TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.increment_daily_usage(p_user_id uuid, p_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.usage (user_id, date, count)
  VALUES (p_user_id, p_date, 1)
  ON CONFLICT (user_id, date)
  DO UPDATE SET count = public.usage.count + 1;
END;
$$;
