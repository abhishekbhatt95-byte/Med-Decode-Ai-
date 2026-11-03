package com.meddecode;

import com.meddecode.config.SupabaseAuthenticationToken;
import com.meddecode.config.SupabaseJwtDecoderFactory;
import com.meddecode.config.SupabaseUserPrincipal;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.SQLException;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Opt-in tests against the disposable Supabase PostgreSQL database. They are deliberately
 * disabled unless -Dmeddecode.rls.integration=true is supplied.
 *
 * Test fixtures are created separately by the reviewed SQL in src/test/resources/sql. This
 * suite never creates analysis fixtures or uses an elevated role for ordinary user requests.
 */
@SpringBootTest
@ActiveProfiles("rls-it")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@EnabledIfSystemProperty(named = "meddecode.rls.integration", matches = "true")
class PostgresRlsIntegrationTest {

    private static final String TEST_PROJECT_REF = "qcxbtqhfhcuciwtlihjn";
    private static final String APP_LOGIN_ROLE = "meddecode_backend";

    @Autowired private RlsTransactionalProbe probe;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private JwtDecoder jwtDecoder;
    @Autowired private SupabaseJwtDecoderFactory jwtDecoderFactory;
    @Autowired private PlatformTransactionManager transactionManager;

    @Value("${MEDDECODE_RLS_PROJECT_REF:}") private String projectRef;
    @Value("${MEDDECODE_RLS_USER_A_JWT:}") private String userAToken;
    @Value("${MEDDECODE_RLS_USER_B_JWT:}") private String userBToken;
    @Value("${MEDDECODE_RLS_ANON_USER_JWT:}") private String anonymousUserToken;
    @Value("${MEDDECODE_RLS_ANALYSIS_A_ID:}") private String analysisAId;
    @Value("${MEDDECODE_RLS_ANALYSIS_B_ID:}") private String analysisBId;
    @Value("${spring.datasource.username:}") private String datasourceUsername;
    @Value("${spring.datasource.url:}") private String datasourceUrl;
    @Value("${supabase.url:}") private String supabaseUrl;
    @Value("${supabase.jwt.issuer:}") private String jwtIssuer;

    private SupabaseAuthenticationToken userA;
    private SupabaseAuthenticationToken userB;
    private SupabaseAuthenticationToken anonymousUser;
    private final Map<UUID, SupabaseAuthenticationToken> insertedDocuments = new LinkedHashMap<>();

    @BeforeAll
    void verifyTestInputsAndDecodeTokens() {
        if (!TEST_PROJECT_REF.equals(projectRef)) {
            throw new IllegalStateException("RLS integration tests are restricted to the disposable test project ref");
        }
        if (!("https://" + TEST_PROJECT_REF + ".supabase.co").equals(supabaseUrl)
                || !("https://" + TEST_PROJECT_REF + ".supabase.co/auth/v1").equals(jwtIssuer)) {
            throw new IllegalStateException("Supabase URL and JWT issuer must match the disposable test project");
        }
        if (!(APP_LOGIN_ROLE + "." + TEST_PROJECT_REF).equals(datasourceUsername)) {
            throw new IllegalStateException("Datasource username must be the project-scoped meddecode_backend pooler username");
        }
        if (datasourceUrl == null
                || !datasourceUrl.startsWith("jdbc:postgresql://")
                || !datasourceUrl.contains(".pooler.supabase.com:5432/")
                || !datasourceUrl.toLowerCase(Locale.ROOT).contains("sslmode=require")) {
            throw new IllegalStateException("Use the disposable project's SSL-required Supabase Session Pooler JDBC URL on port 5432");
        }

        userA = decode(userAToken, "MEDDECODE_RLS_USER_A_JWT");
        userB = decode(userBToken, "MEDDECODE_RLS_USER_B_JWT");
        anonymousUser = decode(anonymousUserToken, "MEDDECODE_RLS_ANON_USER_JWT");

        assertAuthenticatedUser(userA, "User A", false);
        assertAuthenticatedUser(userB, "User B", false);
        assertAuthenticatedUser(anonymousUser, "anonymous Auth user", true);
        if (userA.getPrincipal().userId().equals(userB.getPrincipal().userId())
                || userA.getPrincipal().userId().equals(anonymousUser.getPrincipal().userId())
                || userB.getPrincipal().userId().equals(anonymousUser.getPrincipal().userId())) {
            throw new IllegalStateException("User A, User B and anonymous Auth user must be three distinct Auth identities");
        }

        UUID parsedAnalysisA = requiredUuid(analysisAId, "MEDDECODE_RLS_ANALYSIS_A_ID");
        UUID parsedAnalysisB = requiredUuid(analysisBId, "MEDDECODE_RLS_ANALYSIS_B_ID");
        if (parsedAnalysisA.equals(parsedAnalysisB)) {
            throw new IllegalStateException("Analysis A and Analysis B fixture IDs must be different");
        }
    }

    @AfterEach
    void clearSecurityContextAndCreatedDocuments() {
        try {
            insertedDocuments.forEach((id, auth) -> asUser(auth, () -> probe.deleteDocument(id)));
            insertedDocuments.clear();
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @BeforeEach
    void verifyDedicatedLoginRoleIsRestricted() {
        Map<String, Object> role = jdbcTemplate.queryForMap("""
                SELECT rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolinherit
                FROM pg_roles WHERE rolname = 'meddecode_backend'
                """);
        assertThat(role.get("rolsuper")).isEqualTo(false);
        assertThat(role.get("rolbypassrls")).isEqualTo(false);
        assertThat(role.get("rolcreatedb")).isEqualTo(false);
        assertThat(role.get("rolcreaterole")).isEqualTo(false);
        assertThat(role.get("rolinherit")).isEqualTo(false);
        assertThat(jdbcTemplate.queryForObject("SELECT current_database()", String.class)).isEqualTo("postgres");
        assertThat(jdbcTemplate.queryForObject("SELECT session_user", String.class)).isEqualTo(APP_LOGIN_ROLE);

        Map<String, Object> membership = jdbcTemplate.queryForMap("""
                SELECT pg_has_role('meddecode_backend', 'anon', 'SET') AS can_set_anon,
                       pg_has_role('meddecode_backend', 'authenticated', 'SET') AS can_set_authenticated,
                       pg_has_role('meddecode_backend', 'service_role', 'SET') AS can_set_service_role
                """);
        assertThat(membership.get("can_set_anon")).isEqualTo(true);
        assertThat(membership.get("can_set_authenticated")).isEqualTo(true);
        assertThat(membership.get("can_set_service_role")).isEqualTo(false);

        var insecureTables = jdbcTemplate.queryForList("""
                SELECT c.relname
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public'
                  AND c.relname IN ('profiles', 'user_settings', 'documents', 'analyses',
                    'extracted_text', 'medicines', 'confidence_scores', 'review_flags',
                    'usage', 'shared_links', 'chat_conversations', 'chat_messages')
                  AND (NOT c.relrowsecurity OR pg_get_userbyid(c.relowner) = 'meddecode_backend')
                """, String.class);
        assertThat(insecureTables).isEmpty();
        assertThat(jdbcTemplate.queryForObject("""
                SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
                  AND c.relname IN ('profiles', 'user_settings', 'documents', 'analyses',
                    'extracted_text', 'medicines', 'confidence_scores', 'review_flags',
                    'usage', 'shared_links', 'chat_conversations', 'chat_messages')
                  AND c.relrowsecurity
                """, Integer.class)).isEqualTo(12);
    }

    @Test
    void usersCanReadOnlyTheirOwnDocuments() {
        UUID docA = createDocument(userA, "user-a");
        UUID docB = createDocument(userB, "user-b");

        assertThat(asUser(userA, () -> probe.visibleDocumentCount(docA))).isEqualTo(1);
        assertThat(asUser(userA, () -> probe.visibleDocumentCount(docB))).isZero();
        assertThat(asUser(userB, () -> probe.visibleDocumentCount(docB))).isEqualTo(1);
        assertThat(asUser(userB, () -> probe.visibleDocumentCount(docA))).isZero();
    }

    @Test
    void crossUserDocumentUpdatesAndDeletesAffectNoRows() {
        UUID docA = createDocument(userA, "user-a-update-delete");
        UUID docB = createDocument(userB, "user-b-update-delete");

        assertThat(asUser(userA, () -> probe.updateDocument(docB, "forged-by-a"))).isZero();
        assertThat(asUser(userA, () -> probe.deleteDocument(docB))).isZero();
        assertThat(asUser(userB, () -> probe.updateDocument(docA, "forged-by-b"))).isZero();
        assertThat(asUser(userB, () -> probe.deleteDocument(docA))).isZero();
        assertThat(asUser(userA, () -> probe.visibleDocumentCount(docA))).isEqualTo(1);
        assertThat(asUser(userB, () -> probe.visibleDocumentCount(docB))).isEqualTo(1);
    }

    @Test
    void documentOwnerCannotBeChangedToAnotherUser() {
        UUID documentA = createDocument(userA, "user-a-owner-change");
        assertPostgresError("42501", "row-level security", () ->
                asUser(userA, () -> probe.updateDocumentOwner(documentA, userB.getPrincipal().userId())));
        assertThat(asUser(userA, () -> probe.visibleDocumentOwner(documentA)))
                .isEqualTo(userA.getPrincipal().userId().toString());
        assertThat(asUser(userB, () -> probe.visibleDocumentCount(documentA))).isZero();
    }

    @Test
    void forgedOwnerOnDocumentInsertIsRejectedByRlsWithCheck() {
        UUID forgedId = UUID.randomUUID();
        assertPostgresError("42501", "row-level security", () -> asUser(userA, () -> probe.insertDocument(
                forgedId, userB.getPrincipal().userId(), "forged-owner")));
        assertThat(asUser(userB, () -> probe.visibleDocumentCount(forgedId))).isZero();
    }

    @Test
    void analysisFixturesAreOwnedByTheExpectedDistinctUsers() {
        UUID analysisA = requiredUuid(analysisAId, "MEDDECODE_RLS_ANALYSIS_A_ID");
        UUID analysisB = requiredUuid(analysisBId, "MEDDECODE_RLS_ANALYSIS_B_ID");
        UUID userAId = userA.getPrincipal().userId();
        UUID userBId = userB.getPrincipal().userId();

        assertThat(asUser(userA, () -> probe.visibleAnalysisOwner(analysisA))).isEqualTo(userAId.toString());
        assertThat(asUser(userB, () -> probe.visibleAnalysisOwner(analysisB))).isEqualTo(userBId.toString());
        assertThat(asUser(userA, () -> probe.visibleAnalysisCount(analysisB))).isZero();
        assertThat(asUser(userB, () -> probe.visibleAnalysisCount(analysisA))).isZero();
    }

    @Test
    void eachUserCanReadOnlyTheirOwnAnalysisFixture() {
        UUID analysisA = requiredUuid(analysisAId, "MEDDECODE_RLS_ANALYSIS_A_ID");
        UUID analysisB = requiredUuid(analysisBId, "MEDDECODE_RLS_ANALYSIS_B_ID");
        assertThat(asUser(userA, () -> probe.visibleAnalysisCount(analysisA))).isEqualTo(1);
        assertThat(asUser(userA, () -> probe.visibleAnalysisCount(analysisB))).isZero();
        assertThat(asUser(userB, () -> probe.visibleAnalysisCount(analysisB))).isEqualTo(1);
        assertThat(asUser(userB, () -> probe.visibleAnalysisCount(analysisA))).isZero();
    }

    @Test
    void relatedMedicalRowsAreVisibleOnlyThroughTheOwningDocument() {
        UUID analysisA = requiredUuid(analysisAId, "MEDDECODE_RLS_ANALYSIS_A_ID");
        UUID analysisB = requiredUuid(analysisBId, "MEDDECODE_RLS_ANALYSIS_B_ID");

        assertThat(asUser(userA, () -> probe.visibleExtractedTextCountForAnalysis(analysisA))).isEqualTo(1);
        assertThat(asUser(userA, () -> probe.visibleExtractedTextCountForAnalysis(analysisB))).isZero();
        assertThat(asUser(userB, () -> probe.visibleExtractedTextCountForAnalysis(analysisB))).isEqualTo(1);
        assertThat(asUser(userB, () -> probe.visibleExtractedTextCountForAnalysis(analysisA))).isZero();

        assertThat(asUser(userA, () -> probe.visibleMedicineCount(analysisA))).isEqualTo(1);
        assertThat(asUser(userA, () -> probe.visibleMedicineCount(analysisB))).isZero();
        assertThat(asUser(userB, () -> probe.visibleMedicineCount(analysisB))).isEqualTo(1);
        assertThat(asUser(userB, () -> probe.visibleMedicineCount(analysisA))).isZero();

        assertThat(asUser(userA, () -> probe.visibleConfidenceScoreCount(analysisA))).isEqualTo(1);
        assertThat(asUser(userA, () -> probe.visibleConfidenceScoreCount(analysisB))).isZero();
        assertThat(asUser(userB, () -> probe.visibleConfidenceScoreCount(analysisB))).isEqualTo(1);
        assertThat(asUser(userB, () -> probe.visibleConfidenceScoreCount(analysisA))).isZero();
    }

    @Test
    void tablePrivilegesMatchTheIntendedRlsVersusAclBoundaries() {
        // Existing Supabase API-role grants exist on these core tables. RLS, not the ACL,
        // is expected to filter cross-user rows and deny operations without matching policies.
        for (String table : new String[]{"public.documents", "public.analyses",
                "public.extracted_text", "public.medicines"}) {
            assertThat(hasTablePrivilege("authenticated", table, "SELECT")).isTrue();
            assertThat(hasTablePrivilege("authenticated", table, "INSERT")).isTrue();
            assertThat(hasTablePrivilege("authenticated", table, "UPDATE")).isTrue();
            assertThat(hasTablePrivilege("authenticated", table, "DELETE")).isTrue();
        }

        // The migration deliberately grants authenticated SELECT only on confidence_scores.
        assertThat(hasTablePrivilege("authenticated", "public.confidence_scores", "SELECT")).isTrue();
        assertThat(hasTablePrivilege("anon", "public.confidence_scores", "SELECT")).isFalse();
        for (String privilege : new String[]{"INSERT", "UPDATE", "DELETE"}) {
            assertThat(hasTablePrivilege("authenticated", "public.confidence_scores", privilege)).isFalse();
            assertThat(hasTablePrivilege("anon", "public.confidence_scores", privilege)).isFalse();
        }

        // review_flags has no user policy and no ordinary API-role table grants.
        for (String role : new String[]{"anon", "authenticated"}) {
            for (String privilege : new String[]{"SELECT", "INSERT", "UPDATE", "DELETE"}) {
                assertThat(hasTablePrivilege(role, "public.review_flags", privilege)).isFalse();
            }
        }
    }

    @Test
    void livePolicyCatalogHasOnlyTheExpectedReadPoliciesForDerivedTables() {
        Integer nonSelectPolicies = jdbcTemplate.queryForObject("""
                SELECT count(*)
                FROM pg_policies
                WHERE schemaname = 'public'
                  AND tablename IN ('analyses', 'extracted_text', 'medicines', 'confidence_scores')
                  AND cmd <> 'SELECT'
                """, Integer.class);
        assertThat(nonSelectPolicies).isZero();

        Integer confidenceSelectPolicies = jdbcTemplate.queryForObject("""
                SELECT count(*)
                FROM pg_policies
                WHERE schemaname = 'public'
                  AND tablename = 'confidence_scores'
                  AND cmd = 'SELECT'
                  AND roles::text = '{authenticated}'
                """, Integer.class);
        assertThat(confidenceSelectPolicies).isEqualTo(1);

        Integer reviewFlagPolicies = jdbcTemplate.queryForObject("""
                SELECT count(*)
                FROM pg_policies
                WHERE schemaname = 'public'
                  AND tablename = 'review_flags'
                """, Integer.class);
        assertThat(reviewFlagPolicies).isZero();
    }

    @Test
    void selectOnlyRelatedTablesRejectWritesAtTheirActualSecurityLayer() {
        UUID analysisA = requiredUuid(analysisAId, "MEDDECODE_RLS_ANALYSIS_A_ID");
        UUID analysisB = requiredUuid(analysisBId, "MEDDECODE_RLS_ANALYSIS_B_ID");

        // No INSERT policies exist on analyses, extracted_text or medicines. Existing table
        // grants allow the statement to reach RLS, where WITH CHECK rejects the new row.
        UUID documentA = asUser(userA, () -> probe.visibleAnalysisDocumentId(analysisA));
        assertThat(documentA).isNotNull();
        assertPostgresError("42501", "row-level security", () ->
                asUser(userA, () -> probe.insertAnalysisForDocument(documentA)));
        assertPostgresError("42501", "row-level security", () ->
                asUser(userA, () -> probe.insertExtractedTextForAnalysis(analysisA)));
        assertPostgresError("42501", "row-level security", () ->
                asUser(userB, () -> probe.insertExtractedTextForAnalysis(analysisB)));
        assertPostgresError("42501", "row-level security", () ->
                asUser(userA, () -> probe.insertMedicineForAnalysis(analysisA)));
        assertPostgresError("42501", "row-level security", () ->
                asUser(userB, () -> probe.insertMedicineForAnalysis(analysisB)));

        // UPDATE and DELETE have no policies on these tables. With table ACLs present,
        // PostgreSQL silently filters every candidate row, so the affected-row count is zero.
        assertThat(asUser(userA, () -> probe.updateAnalysis(analysisA))).isZero();
        assertThat(asUser(userA, () -> probe.deleteAnalysis(analysisA))).isZero();
        assertThat(asUser(userA, () -> probe.updateAnalysis(analysisB))).isZero();
        assertThat(asUser(userA, () -> probe.deleteAnalysis(analysisB))).isZero();
        assertThat(asUser(userB, () -> probe.updateAnalysis(analysisA))).isZero();
        assertThat(asUser(userB, () -> probe.deleteAnalysis(analysisA))).isZero();

        assertThat(asUser(userA, () -> probe.updateExtractedTextForAnalysis(analysisA))).isZero();
        assertThat(asUser(userA, () -> probe.deleteExtractedTextForAnalysis(analysisA))).isZero();
        assertThat(asUser(userA, () -> probe.updateExtractedTextForAnalysis(analysisB))).isZero();
        assertThat(asUser(userA, () -> probe.deleteExtractedTextForAnalysis(analysisB))).isZero();

        assertThat(asUser(userA, () -> probe.updateMedicineForAnalysis(analysisA))).isZero();
        assertThat(asUser(userA, () -> probe.deleteMedicineForAnalysis(analysisA))).isZero();
        assertThat(asUser(userA, () -> probe.updateMedicineForAnalysis(analysisB))).isZero();
        assertThat(asUser(userA, () -> probe.deleteMedicineForAnalysis(analysisB))).isZero();

        // confidence_scores has SELECT only for authenticated; the ACL denies writes before RLS.
        assertPostgresError("42501", "permission denied", () ->
                asUser(userA, () -> probe.insertConfidenceScoreForAnalysis(analysisA)));
        assertPostgresError("42501", "permission denied", () ->
                asUser(userA, () -> probe.updateConfidenceScoreForAnalysis(analysisA)));
        assertPostgresError("42501", "permission denied", () ->
                asUser(userA, () -> probe.deleteConfidenceScoreForAnalysis(analysisA)));

        // review_flags is not granted to ordinary roles; all four operations are ACL-denied,
        // not silently filtered by RLS.
        assertPostgresError("42501", "permission denied", () ->
                asUser(userA, () -> probe.visibleReviewFlagCount(analysisA)));
        assertPostgresError("42501", "permission denied", () ->
                asUser(userA, () -> probe.insertReviewFlagForAnalysis(analysisA, userA.getPrincipal().userId())));
        assertPostgresError("42501", "permission denied", () ->
                asUser(userA, () -> probe.updateReviewFlagForAnalysis(analysisA)));
        assertPostgresError("42501", "permission denied", () ->
                asUser(userA, () -> probe.deleteReviewFlagForAnalysis(analysisA)));
    }

    @Test
    void reviewFlagsAreDeniedByTablePrivilegesToAuthenticatedAndAnonRoles() {
        UUID analysisA = requiredUuid(analysisAId, "MEDDECODE_RLS_ANALYSIS_A_ID");
        assertPostgresError("42501", "permission denied", () ->
                asUser(userA, () -> probe.visibleReviewFlagCount(analysisA)));
        assertPostgresError("42501", "permission denied", () ->
                asUser(userB, () -> probe.visibleReviewFlagCount(analysisA)));
        assertPostgresError("42501", "permission denied", () ->
                asUser(anonymousUser, () -> probe.visibleReviewFlagCount(analysisA)));
        assertPostgresError("42501", "permission denied", () ->
                asUnauthenticatedAnon(() -> jdbcTemplate.queryForObject(
                        "SELECT count(*) FROM public.review_flags WHERE analysis_id = ?", Integer.class, analysisA)));
    }

    @Test
    void anonymousAuthUserCanAccessOnlyRowsOwnedByItsAuthUid() {
        UUID anonDocument = createDocument(anonymousUser, "anonymous-auth-user");
        UUID docA = createDocument(userA, "private-user-a");
        UUID analysisA = requiredUuid(analysisAId, "MEDDECODE_RLS_ANALYSIS_A_ID");
        assertThat(asUser(anonymousUser, () -> probe.visibleDocumentCount(anonDocument))).isEqualTo(1);
        assertThat(asUser(anonymousUser, () -> probe.visibleDocumentCount(docA))).isZero();
        assertThat(asUser(anonymousUser, () -> probe.visibleAnalysisCount(analysisA))).isZero();
        assertThat(asUser(anonymousUser, () -> probe.visibleExtractedTextCountForAnalysis(analysisA))).isZero();
        assertThat(asUser(anonymousUser, () -> probe.visibleMedicineCount(analysisA))).isZero();
        assertThat(asUser(anonymousUser, () -> probe.visibleConfidenceScoreCount(analysisA))).isZero();
        assertThat(anonymousUser.getPrincipal().dbRole()).isEqualTo("authenticated");
        assertThat(anonymousUser.getPrincipal().isAnonymous()).isTrue();
    }

    @Test
    void unauthenticatedAnonRoleHasNullUidAndCannotReadPrivateRows() {
        UUID docA = createDocument(userA, "private-user-a-for-anon-role");
        UUID analysisA = requiredUuid(analysisAId, "MEDDECODE_RLS_ANALYSIS_A_ID");
        Integer anonBackendPid = asUnauthenticatedAnon(() -> jdbcTemplate.queryForObject(
                "SELECT pg_backend_pid()", Integer.class));

        Integer visibleDocuments = asUnauthenticatedAnon(() -> jdbcTemplate.queryForObject(
                "SELECT count(*) FROM public.documents WHERE id = ?", Integer.class, docA));
        Integer visibleAnalyses = asUnauthenticatedAnon(() -> jdbcTemplate.queryForObject(
                "SELECT count(*) FROM public.analyses WHERE id = ?", Integer.class, analysisA));
        Integer visibleExtractedText = asUnauthenticatedAnon(() -> jdbcTemplate.queryForObject("""
                SELECT count(*)
                FROM public.extracted_text et
                JOIN public.analyses a ON a.document_id = et.document_id
                WHERE a.id = ?
                """, Integer.class, analysisA));
        Integer visibleMedicines = asUnauthenticatedAnon(() -> jdbcTemplate.queryForObject(
                "SELECT count(*) FROM public.medicines WHERE analysis_id = ?", Integer.class, analysisA));

        assertThat(visibleDocuments).isZero();
        assertThat(visibleAnalyses).isZero();
        assertThat(visibleExtractedText).isZero();
        assertThat(visibleMedicines).isZero();
        assertPostgresError("42501", "permission denied", () -> asUnauthenticatedAnon(
                () -> jdbcTemplate.queryForObject(
                        "SELECT count(*) FROM public.confidence_scores WHERE analysis_id = ?", Integer.class, analysisA)));

        Map<String, Object> afterAnonTransaction = jdbcTemplate.queryForMap("""
                SELECT pg_backend_pid() AS pid, session_user AS login_user, current_user AS db_user,
                       current_setting('request.jwt.claims', true) AS claims,
                       current_setting('request.jwt.claim.sub', true) AS subject,
                       current_setting('request.jwt.claim.role', true) AS jwt_role
                """);
        assertThat(((Number) afterAnonTransaction.get("pid")).intValue()).isEqualTo(anonBackendPid);
        assertThat(afterAnonTransaction.get("login_user")).isEqualTo(APP_LOGIN_ROLE);
        assertThat(afterAnonTransaction.get("db_user")).isEqualTo(APP_LOGIN_ROLE);
        assertThat((String) afterAnonTransaction.get("claims")).isNullOrEmpty();
        assertThat((String) afterAnonTransaction.get("subject")).isNullOrEmpty();
        assertThat((String) afterAnonTransaction.get("jwt_role")).isNullOrEmpty();
    }

    @Test
    void claimsSubjectAndEffectiveRoleMatchVerifiedJwt() {
        RlsTransactionalProbe.RlsContext context = asUser(userA, probe::currentContext);
        assertThat(context.sessionUser()).isEqualTo(APP_LOGIN_ROLE);
        assertThat(context.currentUser()).isEqualTo(userA.getPrincipal().dbRole());
        assertThat(context.authUid()).isEqualTo(userA.getPrincipal().userId().toString());
        assertThat(context.subjectSetting()).isEqualTo(userA.getPrincipal().userId().toString());
        assertThat(context.authRole()).isEqualTo(userA.getPrincipal().dbRole());
        assertThat(context.roleSetting()).isEqualTo(userA.getPrincipal().dbRole());
        assertThat(context.claims()).contains(userA.getPrincipal().userId().toString());
    }

    @Test
    void mismatchedPrincipalClaimsFailBeforeDatabaseWork() {
        SupabaseUserPrincipal original = userA.getPrincipal();
        Map<String, Object> mismatchedClaims = new HashMap<>(original.claims());
        mismatchedClaims.put("sub", userB.getPrincipal().userId().toString());
        SupabaseUserPrincipal mismatched = new SupabaseUserPrincipal(original.userId(), original.email(),
                original.dbRole(), original.isAnonymous(), mismatchedClaims, original.rawToken());
        SupabaseAuthenticationToken invalid = new SupabaseAuthenticationToken(mismatched, userA.getJwt(),
                userA.getAuthorities());

        assertThatThrownBy(() -> asUser(invalid, probe::currentContext))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("claims do not match");
    }

    @Test
    void missingAuthenticationFailsClosed() {
        SecurityContextHolder.clearContext();
        assertThatThrownBy(probe::currentContext)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("verified Supabase user is required");
    }

    @Test
    void rollbackAndExceptionClearTransactionLocalContextOnReusedConnection() {
        UUID rolledBackId = UUID.randomUUID();
        RlsTransactionalProbe.RlsContext initialA = asUser(userA, probe::currentContext);
        int pidA = initialA.backendPid();
        assertThat(initialA.sessionUser()).isEqualTo(APP_LOGIN_ROLE);

        assertThatThrownBy(() -> asUser(userA, () -> {
                    probe.insertDocumentThenFail(rolledBackId, userA.getPrincipal().userId());
                    return null;
                }))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("intentional RLS integration rollback");

        assertThat(asUser(userA, () -> probe.visibleDocumentCount(rolledBackId))).isZero();
        RlsTransactionalProbe.RlsContext contextB = asUser(userB, probe::currentContext);
        assertThat(contextB.backendPid()).isEqualTo(pidA);
        assertThat(contextB.currentUser()).isEqualTo("authenticated");

        RlsTransactionalProbe.RlsContext anonymousContext = asUser(anonymousUser, probe::currentContext);
        assertThat(anonymousContext.backendPid()).isEqualTo(pidA);
        assertThat(anonymousContext.authUid()).isEqualTo(anonymousUser.getPrincipal().userId().toString());
        assertThat(anonymousContext.currentUser()).isEqualTo("authenticated");

        Map<String, Object> afterTransaction = jdbcTemplate.queryForMap("""
                SELECT pg_backend_pid() AS pid, session_user AS login_user, current_user AS db_user,
                       current_setting('request.jwt.claims', true) AS claims,
                       current_setting('request.jwt.claim.sub', true) AS subject,
                       current_setting('request.jwt.claim.role', true) AS jwt_role
                """);
        assertThat(((Number) afterTransaction.get("pid")).intValue()).isEqualTo(pidA);
        assertThat(afterTransaction.get("login_user")).isEqualTo(APP_LOGIN_ROLE);
        assertThat(afterTransaction.get("db_user")).isEqualTo(APP_LOGIN_ROLE);
        assertThat((String) afterTransaction.get("claims")).isNullOrEmpty();
        assertThat((String) afterTransaction.get("subject")).isNullOrEmpty();
        assertThat((String) afterTransaction.get("jwt_role")).isNullOrEmpty();
    }

    private void assertAuthenticatedUser(SupabaseAuthenticationToken auth, String label, boolean anonymousExpected) {
        SupabaseUserPrincipal principal = auth.getPrincipal();
        if (principal.userId() == null || !"authenticated".equals(principal.dbRole())
                || principal.isAnonymous() != anonymousExpected) {
            throw new IllegalStateException(label + " JWT must be a valid authenticated Supabase identity with the expected anonymous flag");
        }
    }

    private UUID requiredUuid(String value, String variableName) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("Set " + variableName + " to the matching disposable fixture UUID");
        }
        try {
            return UUID.fromString(value.trim());
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException(variableName + " must contain a valid UUID", exception);
        }
    }

    private boolean hasTablePrivilege(String role, String table, String privilege) {
        return Boolean.TRUE.equals(jdbcTemplate.queryForObject(
                "SELECT has_table_privilege(?, ?, ?)", Boolean.class, role, table, privilege));
    }

    private void assertPostgresError(String expectedSqlState, String expectedMessage, ThrowingSupplier<?> action) {
        assertThatThrownBy(action::get).satisfies(thrown -> {
            SQLException sqlException = findSqlException(thrown);
            assertThat(sqlException != null)
                    .as("Expected a PostgreSQL SQLException with SQLSTATE %s", expectedSqlState)
                    .isTrue();
            assertThat(sqlException.getSQLState())
                    .as("PostgreSQL exception class=%s, SQLSTATE=%s, errorCode=%s, message=%s",
                            sqlException.getClass().getName(), sqlException.getSQLState(),
                            sqlException.getErrorCode(), sqlException.getMessage())
                    .isEqualTo(expectedSqlState);
            assertThat(sqlException.getMessage().toLowerCase(Locale.ROOT))
                    .contains(expectedMessage.toLowerCase(Locale.ROOT));
        });
    }

    private SQLException findSqlException(Throwable failure) {
        Throwable current = failure;
        while (current != null) {
            if (current instanceof SQLException sqlException) {
                return sqlException;
            }
            current = current.getCause();
        }
        return null;
    }

    private <T> T asUnauthenticatedAnon(ThrowingSupplier<T> action) {
        SecurityContextHolder.clearContext();
        try {
            return new TransactionTemplate(transactionManager).execute(status -> {
                jdbcTemplate.execute("SET LOCAL ROLE anon");
                jdbcTemplate.queryForObject(
                        "SELECT set_config('request.jwt.claims', '{\"role\":\"anon\"}', true)", String.class);
                jdbcTemplate.queryForObject(
                        "SELECT set_config('request.jwt.claim.role', 'anon', true)", String.class);
                jdbcTemplate.queryForObject(
                        "SELECT set_config('request.jwt.claim.sub', '', true)", String.class);
                assertThat(jdbcTemplate.queryForObject("SELECT current_user", String.class)).isEqualTo("anon");
                assertThat(jdbcTemplate.queryForObject("SELECT auth.role()", String.class)).isEqualTo("anon");
                assertThat(jdbcTemplate.queryForObject("SELECT auth.uid()::text", String.class)).isNull();
                try {
                    return action.get();
                } catch (RuntimeException exception) {
                    throw exception;
                } catch (Exception exception) {
                    throw new IllegalStateException(exception);
                }
            });
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private UUID createDocument(SupabaseAuthenticationToken auth, String label) {
        UUID id = UUID.randomUUID();
        UUID inserted = asUser(auth, () -> probe.insertDocument(id, auth.getPrincipal().userId(), label));
        insertedDocuments.put(inserted, auth);
        return inserted;
    }

    private SupabaseAuthenticationToken decode(String rawToken, String variableName) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new IllegalStateException("Set " + variableName + " to a disposable test-user access token");
        }
        Jwt jwt = jwtDecoder.decode(rawToken);
        return (SupabaseAuthenticationToken) jwtDecoderFactory.authenticationConverter().convert(jwt);
    }

    private <T> T asUser(SupabaseAuthenticationToken auth, ThrowingSupplier<T> action) {
        SecurityContextHolder.getContext().setAuthentication(auth);
        try {
            return action.get();
        } catch (RuntimeException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @FunctionalInterface
    private interface ThrowingSupplier<T> {
        T get() throws Exception;
    }
}
