package com.meddecode;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Read-only connection and role-switch smoke checks against the configured RLS database. */
@SpringBootTest
@ActiveProfiles("rls-it")
class PostgresRlsSmokeTest {

    private static final String EXPECTED_DATABASE_LOGIN = "meddecode_backend";
    private static final String EXPECTED_PROJECT_REF = "qcxbtqhfhcuciwtlihjn";

    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private PlatformTransactionManager transactionManager;
    @Autowired private DataSource dataSource;

    @org.springframework.beans.factory.annotation.Value("${MEDDECODE_RLS_PROJECT_REF:}")
    private String projectRef;

    @org.springframework.beans.factory.annotation.Value("${spring.datasource.username}")
    private String datasourceUsername;

    @Test
    void dedicatedLoginHasExpectedIdentityAndRestrictedAttributes() {
        assertThat(projectRef).isEqualTo(EXPECTED_PROJECT_REF);
        assertThat(datasourceUsername).isEqualTo("meddecode_backend.qcxbtqhfhcuciwtlihjn");

        Map<String, Object> role = jdbcTemplate.queryForMap("""
                SELECT session_user AS session_user,
                       current_user AS current_user,
                       current_database() AS database_name,
                       r.rolsuper AS is_superuser,
                       r.rolbypassrls AS bypasses_rls,
                       has_schema_privilege(session_user, 'public', 'USAGE') AS public_usage
                FROM pg_roles r
                WHERE r.rolname = session_user
                """);

        assertThat(role.get("session_user")).isEqualTo(EXPECTED_DATABASE_LOGIN);
        assertThat(role.get("current_user")).isEqualTo(EXPECTED_DATABASE_LOGIN);
        assertThat(role.get("is_superuser")).isEqualTo(false);
        assertThat(role.get("bypasses_rls")).isEqualTo(false);
        assertThat(role.get("public_usage")).isEqualTo(true);
        assertThat(role.get("database_name")).isEqualTo("postgres");

        Integer ownedApplicationTableCount = jdbcTemplate.queryForObject("""
                SELECT count(*)
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public'
                  AND c.relkind IN ('r', 'p')
                  AND c.relowner = (SELECT oid FROM pg_roles WHERE rolname = session_user)
                """, Integer.class);
        assertThat(ownedApplicationTableCount).isZero();

        // Exercise actual Hikari-backed DataSource acquisition without exposing connection details.
        assertThat(dataSource).isNotNull();
        assertThat(jdbcTemplate.queryForObject("SELECT 1", Integer.class)).isEqualTo(1);
    }

    @Test
    void authenticatedAndAnonRolesAreSettableLocallyAndResetAfterCommit() {
        int backendPid = inTransaction(TransactionDefinition.PROPAGATION_REQUIRES_NEW,
                () -> switchRoleAndReturnBackendPid("authenticated"));
        assertLoginRoleAndPid(backendPid);

        int anonBackendPid = inTransaction(TransactionDefinition.PROPAGATION_REQUIRES_NEW,
                () -> switchRoleAndReturnBackendPid("anon"));
        assertThat(anonBackendPid).isEqualTo(backendPid);
        assertLoginRoleAndPid(backendPid);
    }

    @Test
    void localRoleIsResetAfterRollbackAndConnectionReuse() {
        int backendPid = inTransaction(TransactionDefinition.PROPAGATION_REQUIRES_NEW, () -> {
            switchRole("authenticated");
            return currentBackendPid();
        });
        assertLoginRoleAndPid(backendPid);

        TransactionTemplate rollbackTemplate = newTransaction(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        assertThatThrownBy(() -> rollbackTemplate.execute(status -> {
            switchRole("anon");
            int pid = currentBackendPid();
            status.setRollbackOnly();
            throw new SmokeRollbackException(pid);
        })).isInstanceOf(SmokeRollbackException.class);

        // Pool size is one in application-rls-it.yml: this must reuse the same Hikari connection.
        assertLoginRoleAndPid(backendPid);
    }

    @Test
    void serviceRoleCannotBeSelectedAndLoginRoleIsRestored() {
        TransactionTemplate transaction = newTransaction(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        assertThatThrownBy(() -> transaction.execute(status -> {
            try {
                jdbcTemplate.execute("SET LOCAL ROLE service_role");
                throw new AssertionError("SET LOCAL ROLE service_role unexpectedly succeeded");
            } catch (org.springframework.dao.DataAccessException expected) {
                status.setRollbackOnly();
                throw expected;
            }
        })).isInstanceOf(org.springframework.dao.DataAccessException.class);

        Map<String, Object> state = jdbcTemplate.queryForMap("""
                SELECT session_user AS session_user,
                       current_user AS current_user,
                       pg_backend_pid() AS backend_pid
                """);
        assertThat(state.get("session_user")).isEqualTo(EXPECTED_DATABASE_LOGIN);
        assertThat(state.get("current_user")).isEqualTo(EXPECTED_DATABASE_LOGIN);
    }

    private int switchRoleAndReturnBackendPid(String role) {
        switchRole(role);
        assertThat(jdbcTemplate.queryForObject("SELECT current_user", String.class)).isEqualTo(role);
        return currentBackendPid();
    }

    private void switchRole(String role) {
        if (!"anon".equals(role) && !"authenticated".equals(role)) {
            throw new IllegalArgumentException("Only approved Supabase request roles may be selected");
        }
        jdbcTemplate.execute("SET LOCAL ROLE " + role);
        assertThat(jdbcTemplate.queryForObject("SELECT current_user", String.class)).isEqualTo(role);
    }

    private int currentBackendPid() {
        return jdbcTemplate.queryForObject("SELECT pg_backend_pid()", Integer.class);
    }

    private void assertLoginRoleAndPid(int expectedPid) {
        Map<String, Object> state = jdbcTemplate.queryForMap("""
                SELECT session_user AS session_user,
                       current_user AS current_user,
                       pg_backend_pid() AS backend_pid
                """);
        assertThat(state.get("session_user")).isEqualTo(EXPECTED_DATABASE_LOGIN);
        assertThat(state.get("current_user")).isEqualTo(EXPECTED_DATABASE_LOGIN);
        assertThat(((Number) state.get("backend_pid")).intValue()).isEqualTo(expectedPid);
    }

    private <T> T inTransaction(int propagation, java.util.function.Supplier<T> action) {
        return newTransaction(propagation).execute(status -> action.get());
    }

    private TransactionTemplate newTransaction(int propagation) {
        TransactionTemplate template = new TransactionTemplate(transactionManager);
        template.setPropagationBehavior(propagation);
        return template;
    }

    private static final class SmokeRollbackException extends RuntimeException {
        private SmokeRollbackException(int backendPid) {
            super("Intentional read-only smoke-test rollback on backend PID " + backendPid);
        }
    }
}
