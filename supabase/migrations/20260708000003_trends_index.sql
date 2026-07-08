CREATE INDEX IF NOT EXISTS idx_documents_user_type_date
  ON public.documents (user_id, document_type, created_at DESC);
