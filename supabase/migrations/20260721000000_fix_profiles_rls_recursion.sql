-- Fix infinite recursion in public.profiles Row Level Security policy
--
-- The policy "Admins have full profile access" previously did a SELECT on
-- public.profiles to check if the current user is an admin. Because that SELECT
-- is itself subject to profiles RLS policies, it caused infinite recursion.
-- We fix this by utilizing a SECURITY DEFINER function to query public.profiles
-- bypassing the RLS check for that subquery.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

DROP POLICY IF EXISTS "Admins have full profile access" ON public.profiles;

CREATE POLICY "Admins have full profile access" ON public.profiles
  FOR ALL
  USING (public.is_admin());
