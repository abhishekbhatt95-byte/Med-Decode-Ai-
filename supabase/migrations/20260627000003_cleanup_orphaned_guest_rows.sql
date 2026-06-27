-- =============================================================================
-- OPTIONAL / DESTRUCTIVE — only run this if you want it.
--
-- Before the anonymous-auth fix, guest uploads were stored with
-- documents.user_id = NULL. Once 20260627000002_actually_fix_guest_rls.sql
-- is applied, those rows become permanently inaccessible to everyone (no
-- policy grants access to a NULL user_id anymore) — which is the correct,
-- safe outcome, but they'll just sit there as dead rows forever otherwise.
--
-- Since this is pre-launch, the simplest thing is to delete them outright
-- rather than try to figure out which anonymous browser session "owned"
-- each one (you can't — that information was never captured).
--
-- Run this AFTER 20260627000002, and only if you're fine losing any
-- pre-fix guest-uploaded documents/analyses (test uploads, presumably).
-- =============================================================================

-- Deletes cascade: documents -> extracted_text, analyses, ocr_results,
-- ocr_failures (all have ON DELETE CASCADE FKs to documents.id).
-- analyses -> medicines, confidence_scores cascade from there too.
DELETE FROM public.documents WHERE user_id IS NULL;

-- Storage objects for those documents are NOT auto-deleted by the above
-- (Postgres can't reach into Supabase Storage). If you want to also clear
-- the orphaned files from the "Med Decode Ai" bucket's "guest/" folder,
-- do that separately from the Storage tab in the dashboard, or via:
--   supabase storage rm -r "Med Decode Ai/guest" --linked
