package com.meddecode.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.core.annotation.Order;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.Objects;
import java.util.UUID;

/**
 * Injects verified Supabase JWT claims directly into the PostgreSQL transaction session.
 * This guarantees Supabase auth.uid() and auth.jwt() evaluate identically in PostgreSQL RLS policies.
 */
@Aspect
@Component
@Order(200) // Transaction advice (default order 0) starts first; this advice initializes RLS before repository work.
public class RlsSecurityContextAspect {

    private final EntityManager entityManager;
    private final ObjectMapper objectMapper;

    public RlsSecurityContextAspect(EntityManager entityManager, ObjectMapper objectMapper) {
        this.entityManager = entityManager;
        this.objectMapper = objectMapper;
    }

    @Around("@annotation(org.springframework.transaction.annotation.Transactional) || " +
            "execution(* org.springframework.data.repository.Repository+.*(..))")
    public Object applyRlsSecurityContext(ProceedingJoinPoint joinPoint) throws Throwable {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        if (!(auth instanceof SupabaseAuthenticationToken token)
                || !token.isAuthenticated()
                || token.getPrincipal() == null) {
            throw new IllegalStateException("A verified Supabase user is required for database access");
        }

        if (!TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new IllegalStateException("RLS context must be initialized inside an active database transaction");
        }

        injectPostgreSqlRlsClaims(token.getPrincipal());
        return joinPoint.proceed();
    }

    private void injectPostgreSqlRlsClaims(SupabaseUserPrincipal principal) {
        String role = principal.dbRole();
        UUID subject = principal.userId();
        if (principal.claims() == null || subject == null || role == null || role.isBlank()) {
            throw new IllegalStateException("Verified Supabase principal is missing required claims");
        }

        Object subjectClaim = principal.claims().get("sub");
        Object roleClaim = principal.claims().get("role");
        if (!subject.toString().equals(subjectClaim)
                || !role.equals(roleClaim)
                || !("anon".equals(role) || "authenticated".equals(role))) {
            throw new IllegalStateException("Supabase principal claims do not match an allowed database role and subject");
        }

        final String claimsJson;
        try {
            claimsJson = objectMapper.writeValueAsString(principal.claims());
        } catch (Exception e) {
            throw new IllegalStateException("Could not serialize verified Supabase JWT claims", e);
        }

        // Supabase auth.jwt() reads the JSON claims setting. auth.uid() implementations may
        // read either the legacy subject setting or the sub claim in the JSON, so establish both.
        // The third set_config argument makes each value transaction-local; commit/rollback
        // restores the prior connection state before Hikari can reuse this physical connection.
        entityManager.createNativeQuery("SELECT set_config('request.jwt.claims', :claims, true)")
            .setParameter("claims", claimsJson)
            .getSingleResult();
        entityManager.createNativeQuery("SELECT set_config('request.jwt.claim.sub', :subject, true)")
            .setParameter("subject", subject.toString())
            .getSingleResult();
        entityManager.createNativeQuery("SELECT set_config('request.jwt.claim.role', :role, true)")
            .setParameter("role", role)
            .getSingleResult();

        // Only the two Supabase request roles are accepted; role text is not interpolated from arbitrary input.
        String databaseRole = "authenticated".equals(role) ? "authenticated" : "anon";
        entityManager.createNativeQuery("SET LOCAL ROLE " + databaseRole).executeUpdate();

        Object configuredClaims = entityManager.createNativeQuery("SELECT current_setting('request.jwt.claims', true)")
            .getSingleResult();
        if (!Objects.equals(claimsJson, configuredClaims)) {
            throw new IllegalStateException("PostgreSQL did not retain the transaction-local JWT claims");
        }

        Object configuredSubject = entityManager.createNativeQuery("SELECT current_setting('request.jwt.claim.sub', true)")
            .getSingleResult();
        if (!Objects.equals(subject.toString(), configuredSubject)) {
            throw new IllegalStateException("PostgreSQL did not retain the transaction-local JWT subject");
        }

        Object configuredRoleClaim = entityManager.createNativeQuery("SELECT current_setting('request.jwt.claim.role', true)")
            .getSingleResult();
        if (!Objects.equals(role, configuredRoleClaim)) {
            throw new IllegalStateException("PostgreSQL did not retain the transaction-local JWT role claim");
        }

        Object configuredRole = entityManager.createNativeQuery("SELECT current_user").getSingleResult();
        if (!databaseRole.equals(configuredRole)) {
            throw new IllegalStateException("PostgreSQL did not activate the expected request role");
        }

        Object resolvedRole = entityManager.createNativeQuery("SELECT auth.role()")
            .getSingleResult();
        if (!role.equals(resolvedRole)) {
            throw new IllegalStateException("Supabase auth.role() did not resolve to the verified JWT role");
        }

        Object resolvedUserId = entityManager.createNativeQuery("SELECT auth.uid()")
            .getSingleResult();
        if (!subject.equals(asUuid(resolvedUserId))) {
            throw new IllegalStateException("Supabase auth.uid() did not resolve to the verified JWT subject");
        }
    }

    private UUID asUuid(Object value) {
        if (value instanceof UUID uuid) {
            return uuid;
        }
        if (value instanceof String text && !text.isBlank()) {
            return UUID.fromString(text);
        }
        throw new IllegalStateException("Supabase auth.uid() returned no user UUID");
    }
}
