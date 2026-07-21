-- Database performance optimization: Create indexes on core foreign keys
--
-- Postgres does not automatically index foreign keys, leading to sequential table
-- scans when performing joins or filtering on parent records. The indexes below
-- optimize common query patterns like loading dashboard documents, results details,
-- prescription medicines, and checking user usage limits.

CREATE INDEX IF NOT EXISTS idx_documents_user_id 
  ON public.documents(user_id);

CREATE INDEX IF NOT EXISTS idx_analyses_document_id 
  ON public.analyses(document_id);

CREATE INDEX IF NOT EXISTS idx_extracted_text_document_id 
  ON public.extracted_text(document_id);

CREATE INDEX IF NOT EXISTS idx_medicines_analysis_id 
  ON public.medicines(analysis_id);

CREATE INDEX IF NOT EXISTS idx_confidence_scores_analysis_id 
  ON public.confidence_scores(analysis_id);

CREATE INDEX IF NOT EXISTS idx_ocr_results_document_id 
  ON public.ocr_results(document_id);

CREATE INDEX IF NOT EXISTS idx_feature_usage_user_id 
  ON public.feature_usage(user_id);
