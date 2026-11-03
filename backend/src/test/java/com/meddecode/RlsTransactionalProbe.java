package com.meddecode;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/** Executes direct SQL through the application's transaction and JDBC pool for PostgreSQL RLS tests. */
@Component
class RlsTransactionalProbe {

    private final JdbcTemplate jdbcTemplate;

    RlsTransactionalProbe(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    RlsContext currentContext() {
        return jdbcTemplate.queryForObject("""
                SELECT pg_backend_pid(), session_user, current_user,
                       current_setting('request.jwt.claims', true),
                       current_setting('request.jwt.claim.sub', true),
                       current_setting('request.jwt.claim.role', true),
                       auth.uid()::text,
                       auth.role()
                """, (rs, row) -> new RlsContext(
                rs.getInt(1), rs.getString(2), rs.getString(3), rs.getString(4),
                rs.getString(5), rs.getString(6), rs.getString(7), rs.getString(8)));
    }

    @Transactional
    UUID insertDocument(UUID id, UUID ownerId, String label) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO public.documents
                    (id, user_id, name, file_path, mime_type, size, document_type)
                VALUES (?, ?, ?, ?, 'application/pdf', 1, 'blood_report')
                RETURNING id
                """, UUID.class, id, ownerId, label, "rls-test/" + id + ".pdf");
    }

    @Transactional
    int visibleDocumentCount(UUID id) {
        return jdbcTemplate.queryForObject(
                "SELECT count(*) FROM public.documents WHERE id = ?", Integer.class, id);
    }

    /** Returns null when the document is hidden by RLS. */
    @Transactional
    String visibleDocumentOwner(UUID id) {
        List<String> owners = jdbcTemplate.query("""
                SELECT user_id::text FROM public.documents WHERE id = ?
                """, (rs, row) -> rs.getString(1), id);
        return owners.isEmpty() ? null : owners.get(0);
    }

    @Transactional
    int visibleAnalysisCount(UUID id) {
        return jdbcTemplate.queryForObject(
                "SELECT count(*) FROM public.analyses WHERE id = ?", Integer.class, id);
    }

    /** Returns the parent document ID visible through the current user's analysis policy. */
    @Transactional
    UUID visibleAnalysisDocumentId(UUID analysisId) {
        List<UUID> documentIds = jdbcTemplate.query("""
                SELECT a.document_id
                FROM public.analyses a
                WHERE a.id = ?
                """, (rs, row) -> rs.getObject(1, UUID.class), analysisId);
        return documentIds.isEmpty() ? null : documentIds.get(0);
    }

    /** Returns null when RLS filters the analysis row from the current user. */
    @Transactional
    String visibleAnalysisOwner(UUID analysisId) {
        List<String> owners = jdbcTemplate.query("""
                SELECT d.user_id::text
                FROM public.analyses a
                JOIN public.documents d ON d.id = a.document_id
                WHERE a.id = ?
                """, (rs, row) -> rs.getString(1), analysisId);
        return owners.isEmpty() ? null : owners.get(0);
    }

    @Transactional
    int visibleExtractedTextCountForAnalysis(UUID analysisId) {
        return jdbcTemplate.queryForObject("""
                SELECT count(*)
                FROM public.extracted_text et
                JOIN public.analyses a ON a.document_id = et.document_id
                WHERE a.id = ?
                """, Integer.class, analysisId);
    }

    @Transactional
    int visibleMedicineCount(UUID analysisId) {
        return jdbcTemplate.queryForObject(
                "SELECT count(*) FROM public.medicines WHERE analysis_id = ?", Integer.class, analysisId);
    }

    @Transactional
    int visibleConfidenceScoreCount(UUID analysisId) {
        return jdbcTemplate.queryForObject(
                "SELECT count(*) FROM public.confidence_scores WHERE analysis_id = ?", Integer.class, analysisId);
    }

    @Transactional
    int visibleReviewFlagCount(UUID analysisId) {
        return jdbcTemplate.queryForObject(
                "SELECT count(*) FROM public.review_flags WHERE analysis_id = ?", Integer.class, analysisId);
    }

    @Transactional
    int insertAnalysisForDocument(UUID documentId) {
        return jdbcTemplate.update("""
                INSERT INTO public.analyses
                    (document_id, summary, structured_output, doctor_questions)
                VALUES (?, 'synthetic RLS test analysis', '{}'::jsonb, '[]'::jsonb)
                """, documentId);
    }

    @Transactional
    int updateAnalysis(UUID id) {
        return jdbcTemplate.update("UPDATE public.analyses SET summary = 'tampered' WHERE id = ?", id);
    }

    @Transactional
    int deleteAnalysis(UUID id) {
        return jdbcTemplate.update("DELETE FROM public.analyses WHERE id = ?", id);
    }

    @Transactional
    int insertExtractedTextForAnalysis(UUID analysisId) {
        return jdbcTemplate.update("""
                INSERT INTO public.extracted_text (document_id, raw_text, ocr_provider, confidence)
                SELECT a.document_id, 'synthetic RLS test OCR text', 'tesseract', 0.99
                FROM public.analyses a
                WHERE a.id = ?
                """, analysisId);
    }

    @Transactional
    int updateExtractedTextForAnalysis(UUID analysisId) {
        return jdbcTemplate.update("""
                UPDATE public.extracted_text et
                SET raw_text = 'tampered by RLS test'
                FROM public.analyses a
                WHERE a.document_id = et.document_id AND a.id = ?
                """, analysisId);
    }

    @Transactional
    int deleteExtractedTextForAnalysis(UUID analysisId) {
        return jdbcTemplate.update("""
                DELETE FROM public.extracted_text et
                USING public.analyses a
                WHERE a.document_id = et.document_id AND a.id = ?
                """, analysisId);
    }

    @Transactional
    int insertMedicineForAnalysis(UUID analysisId) {
        return jdbcTemplate.update("""
                INSERT INTO public.medicines (analysis_id, brand_name, confidence_score)
                VALUES (?, 'Synthetic RLS Test Medicine', 91.0)
                """, analysisId);
    }

    @Transactional
    int updateMedicineForAnalysis(UUID analysisId) {
        return jdbcTemplate.update("""
                UPDATE public.medicines
                SET brand_name = 'Tampered RLS Test Medicine'
                WHERE analysis_id = ?
                """, analysisId);
    }

    @Transactional
    int deleteMedicineForAnalysis(UUID analysisId) {
        return jdbcTemplate.update(
                "DELETE FROM public.medicines WHERE analysis_id = ?", analysisId);
    }

    @Transactional
    int insertConfidenceScoreForAnalysis(UUID analysisId) {
        return jdbcTemplate.update("""
                INSERT INTO public.confidence_scores
                    (analysis_id, ocr_confidence, ai_confidence, overall_confidence)
                VALUES (?, 0.99, 0.98, 0.985)
                """, analysisId);
    }

    @Transactional
    int updateConfidenceScoreForAnalysis(UUID analysisId) {
        return jdbcTemplate.update("""
                UPDATE public.confidence_scores
                SET overall_confidence = 0.01
                WHERE analysis_id = ?
                """, analysisId);
    }

    @Transactional
    int deleteConfidenceScoreForAnalysis(UUID analysisId) {
        return jdbcTemplate.update(
                "DELETE FROM public.confidence_scores WHERE analysis_id = ?", analysisId);
    }

    @Transactional
    int insertReviewFlagForAnalysis(UUID analysisId, UUID userId) {
        return jdbcTemplate.update("""
                INSERT INTO public.review_flags (analysis_id, flag_reason, flagged_by)
                VALUES (?, 'Synthetic RLS test flag', ?)
                """, analysisId, userId);
    }

    @Transactional
    int updateReviewFlagForAnalysis(UUID analysisId) {
        return jdbcTemplate.update("""
                UPDATE public.review_flags
                SET flag_reason = 'Tampered synthetic RLS test flag'
                WHERE analysis_id = ?
                """, analysisId);
    }

    @Transactional
    int deleteReviewFlagForAnalysis(UUID analysisId) {
        return jdbcTemplate.update("DELETE FROM public.review_flags WHERE analysis_id = ?", analysisId);
    }

    @Transactional
    int updateDocument(UUID id, String name) {
        return jdbcTemplate.update("UPDATE public.documents SET name = ? WHERE id = ?", name, id);
    }

    @Transactional
    int updateDocumentOwner(UUID id, UUID newOwnerId) {
        return jdbcTemplate.update("UPDATE public.documents SET user_id = ? WHERE id = ?", newOwnerId, id);
    }

    @Transactional
    int deleteDocument(UUID id) {
        return jdbcTemplate.update("DELETE FROM public.documents WHERE id = ?", id);
    }

    @Transactional
    void insertDocumentThenFail(UUID id, UUID ownerId) {
        insertDocument(id, ownerId, "rollback-" + id);
        throw new IllegalStateException("intentional RLS integration rollback");
    }

    record RlsContext(int backendPid, String sessionUser, String currentUser, String claims,
                      String subjectSetting, String roleSetting, String authUid, String authRole) {}
}
