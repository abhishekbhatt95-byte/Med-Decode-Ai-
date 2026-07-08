-- Migration: Add storage RLS policies for 'Med Decode Ai' bucket.
-- Make sure the bucket 'Med Decode Ai' is configured as private in your Supabase dashboard.

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users select own medical documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow users insert own medical documents" ON storage.objects;

CREATE POLICY "Allow users select own medical documents"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'Med Decode Ai'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Allow users insert own medical documents"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'Med Decode Ai'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
