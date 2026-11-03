package com.meddecode;

import com.meddecode.config.SupabaseJwtDecoderFactory;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SupabaseSecurityAndIsolationIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private static final String TEST_ONLY_SIGNING_SECRET = "local-test-only-signing-key-not-a-supabase-credential-32-bytes";
    private static final String TEST_ISSUER = "https://meddecode-test.invalid/auth/v1";
    private SecretKey secretKey;

    @DynamicPropertySource
    static void testJwtProperties(DynamicPropertyRegistry registry) {
        registry.add("supabase.jwt.issuer", () -> TEST_ISSUER);
        registry.add("supabase.jwt.secret", () -> TEST_ONLY_SIGNING_SECRET);
    }

    private UUID userAId;
    private UUID userBId;

    @BeforeEach
    void setUp() {
        secretKey = Keys.hmacShaKeyFor(TEST_ONLY_SIGNING_SECRET.getBytes(StandardCharsets.UTF_8));
        jdbcTemplate.update("DELETE FROM documents");
        jdbcTemplate.update("DELETE FROM profiles");

        userAId = UUID.randomUUID();
        userBId = UUID.randomUUID();

        jdbcTemplate.update("INSERT INTO profiles (id, full_name, role, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)", userAId, "Alice Patient", "user");
        jdbcTemplate.update("INSERT INTO profiles (id, full_name, role, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)", userBId, "Bob Patient", "user");
    }

    private String generateToken(
        UUID userId,
        String email,
        String role,
        String issuer,
        String audience,
        Date expiresAt,
        SecretKey signingKey
    ) {
        return Jwts.builder()
            .header().add("typ", "JWT").add("alg", "HS256").and()
            .subject(userId != null ? userId.toString() : UUID.randomUUID().toString())
            .claim("email", email)
            .claim("role", role)
            .claim("is_anonymous", "anon".equalsIgnoreCase(role))
            .issuer(issuer)
            .audience().add(audience).and()
            .issuedAt(new Date())
            .expiration(expiresAt)
            .signWith(signingKey, Jwts.SIG.HS256)
            .compact();
    }

    @Test
    @DisplayName("1. Valid Supabase JWT authenticates successfully and returns user claims")
    void validJwt_authenticatesSuccessfully() throws Exception {
        Date expiry = Date.from(Instant.now().plus(1, ChronoUnit.HOURS));
        String token = generateToken(userAId, "alice@example.com", "authenticated", TEST_ISSUER, "authenticated", expiry, secretKey);

        mockMvc.perform(get("/api/v1/auth/me")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.userId").value(userAId.toString()))
            .andExpect(jsonPath("$.email").value("alice@example.com"))
            .andExpect(jsonPath("$.dbRole").value("authenticated"))
            .andExpect(jsonPath("$.isAnonymous").value(false));
    }

    @Test
    @DisplayName("2. Expired JWT is rejected with 401 Unauthorized")
    void expiredJwt_rejectedWith401() throws Exception {
        Date pastExpiry = Date.from(Instant.now().minus(1, ChronoUnit.HOURS));
        String token = generateToken(userAId, "alice@example.com", "authenticated", TEST_ISSUER, "authenticated", pastExpiry, secretKey);

        mockMvc.perform(get("/api/v1/auth/me")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("3. JWT with invalid signature is rejected with 401 Unauthorized")
    void invalidSignatureJwt_rejectedWith401() throws Exception {
        SecretKey wrongKey = Keys.hmacShaKeyFor("different-invalid-secret-key-32-bytes-min".getBytes(StandardCharsets.UTF_8));
        Date expiry = Date.from(Instant.now().plus(1, ChronoUnit.HOURS));
        String token = generateToken(userAId, "alice@example.com", "authenticated", TEST_ISSUER, "authenticated", expiry, wrongKey);

        mockMvc.perform(get("/api/v1/auth/me")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("4. JWT with incorrect issuer is rejected with 401 Unauthorized")
    void invalidIssuerJwt_rejectedWith401() throws Exception {
        Date expiry = Date.from(Instant.now().plus(1, ChronoUnit.HOURS));
        String token = generateToken(userAId, "alice@example.com", "authenticated", "https://malicious-issuer.com", "authenticated", expiry, secretKey);

        mockMvc.perform(get("/api/v1/auth/me")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("5. JWT with incorrect audience is rejected with 401 Unauthorized")
    void invalidAudienceJwt_rejectedWith401() throws Exception {
        Date expiry = Date.from(Instant.now().plus(1, ChronoUnit.HOURS));
        String token = generateToken(userAId, "alice@example.com", "authenticated", TEST_ISSUER, "wrong-aud", expiry, secretKey);

        mockMvc.perform(get("/api/v1/auth/me")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("6. Anonymous user access is authenticated with anon role and marked as anonymous")
    void anonymousUser_authenticatedWithAnonRole() throws Exception {
        Date expiry = Date.from(Instant.now().plus(1, ChronoUnit.HOURS));
        String token = generateToken(null, null, "anon", TEST_ISSUER, "anon", expiry, secretKey);

        mockMvc.perform(get("/api/v1/auth/me")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.dbRole").value("anon"))
            .andExpect(jsonPath("$.isAnonymous").value(true));
    }

}
