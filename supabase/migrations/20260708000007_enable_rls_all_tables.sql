ALTER TABLE public.ai_disclosures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.failed_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_advisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_disclaimers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocr_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocr_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocr_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocr_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retention_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trust_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_languages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read ai_disclosures" ON public.ai_disclosures;
CREATE POLICY "Public read ai_disclosures" ON public.ai_disclosures
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read medical_disclaimers" ON public.medical_disclaimers;
CREATE POLICY "Public read medical_disclaimers" ON public.medical_disclaimers
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read medical_sources" ON public.medical_sources;
CREATE POLICY "Public read medical_sources" ON public.medical_sources
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read voice_languages" ON public.voice_languages;
CREATE POLICY "Public read voice_languages" ON public.voice_languages
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Manage own api_keys" ON public.api_keys;
CREATE POLICY "Manage own api_keys" ON public.api_keys
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Manage own medical_advisor profile" ON public.medical_advisors;
CREATE POLICY "Manage own medical_advisor profile" ON public.medical_advisors
  FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Select own api_usage" ON public.api_usage;
CREATE POLICY "Select own api_usage" ON public.api_usage
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.api_keys k
      WHERE k.id = api_usage.api_key_id
      AND k.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Select own analysis_sources" ON public.analysis_sources;
CREATE POLICY "Select own analysis_sources" ON public.analysis_sources
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.analyses a
      JOIN public.documents d ON a.document_id = d.id
      WHERE a.id = analysis_sources.analysis_id
      AND d.user_id = auth.uid()
    )
  );
