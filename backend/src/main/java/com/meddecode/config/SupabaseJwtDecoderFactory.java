package com.meddecode.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.stereotype.Component;

import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Component
public class SupabaseJwtDecoderFactory {

    @Value("${supabase.url:https://knrpgzmeiinhyhmabaxo.supabase.co}")
    private String supabaseUrl;

    @Value("${supabase.jwt.issuer:#{null}}")
    private String expectedIssuer;

    @Value("${supabase.jwt.secret:#{null}}")
    private String legacyJwtSecret;

    private final ObjectMapper objectMapper = new ObjectMapper();

    public JwtDecoder createDecoder() {
        String issuer = expectedIssuer != null && !expectedIssuer.isBlank()
            ? expectedIssuer
            : supabaseUrl + "/auth/v1";

        NimbusJwtDecoder decoder;

        // If legacy symmetric secret is explicitly configured, support HS256 fallback
        if (legacyJwtSecret != null && !legacyJwtSecret.isBlank()) {
            SecretKeySpec secretKey = new SecretKeySpec(
                legacyJwtSecret.getBytes(StandardCharsets.UTF_8),
                "HmacSHA256"
            );
            decoder = NimbusJwtDecoder.withSecretKey(secretKey).build();
        } else {
            // Default: Production-grade JWKS endpoint verification with key rotation and kid matching
            String jwksUri = supabaseUrl + "/auth/v1/.well-known/jwks.json";
            decoder = NimbusJwtDecoder.withJwkSetUri(jwksUri)
                    .jwsAlgorithm(SignatureAlgorithm.ES256)
                    .build();
        }

        // Strict Validators: Issuer, Expiration, Not-Before, Audience
        OAuth2TokenValidator<Jwt> defaultValidator = JwtValidators.createDefaultWithIssuer(issuer);
        OAuth2TokenValidator<Jwt> audienceValidator = new AudienceValidator();
        OAuth2TokenValidator<Jwt> combinedValidator = new DelegatingOAuth2TokenValidator<>(defaultValidator, audienceValidator);

        decoder.setJwtValidator(combinedValidator);
        return decoder;
    }

    public Converter<Jwt, AbstractAuthenticationToken> authenticationConverter() {
        return jwt -> {
            String sub = jwt.getSubject();
            UUID userId = (sub != null && !sub.isBlank()) ? UUID.fromString(sub) : null;
            String email = jwt.getClaimAsString("email");

            // Extract role claim strictly from verified Supabase token
            String dbRole = jwt.getClaimAsString("role");
            if (dbRole == null || dbRole.isBlank()) {
                dbRole = "anon";
            }

            // Distinguish anonymous guest vs authenticated user
            boolean isAnonymous = "anon".equalsIgnoreCase(dbRole) ||
                Boolean.TRUE.equals(jwt.getClaimAsBoolean("is_anonymous"));

            List<SimpleGrantedAuthority> authorities = new ArrayList<>();
            authorities.add(new SimpleGrantedAuthority("ROLE_" + dbRole.toUpperCase(Locale.ROOT)));

            // Check if user has app-level admin role in app_metadata
            Map<String, Object> appMetadata = jwt.getClaim("app_metadata");
            if (appMetadata != null && appMetadata.containsKey("role")) {
                String appRole = String.valueOf(appMetadata.get("role"));
                authorities.add(new SimpleGrantedAuthority("ROLE_APP_" + appRole.toUpperCase(Locale.ROOT)));
            }

            SupabaseUserPrincipal principal = new SupabaseUserPrincipal(
                userId,
                email,
                dbRole,
                isAnonymous,
                jwt.getClaims(),
                jwt.getTokenValue()
            );

            return new SupabaseAuthenticationToken(principal, jwt, authorities);
        };
    }

    private static class AudienceValidator implements OAuth2TokenValidator<Jwt> {
        @Override
        public OAuth2TokenValidatorResult validate(Jwt jwt) {
            List<String> aud = jwt.getAudience();
            if (aud != null && (aud.contains("authenticated") || aud.contains("anon"))) {
                return OAuth2TokenValidatorResult.success();
            }
            OAuth2Error error = new OAuth2Error("invalid_audience", "JWT audience must contain authenticated or anon", null);
            return OAuth2TokenValidatorResult.failure(error);
        }
    }
}
