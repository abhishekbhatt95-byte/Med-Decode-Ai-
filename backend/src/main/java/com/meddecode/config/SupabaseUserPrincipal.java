package com.meddecode.config;

import java.util.Map;
import java.util.UUID;

/**
 * Immutable security context populated from verified Supabase JWT claims.
 */
public record SupabaseUserPrincipal(
    UUID userId,
    String email,
    String dbRole,
    boolean isAnonymous,
    Map<String, Object> claims,
    String rawToken
) {}
