package com.meddecode;

import com.meddecode.repository.ProfileRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
class RlsSecurityContextAspectTest {

    @Autowired
    private ProfileRepository profileRepository;

    @Test
    void repositoryAccessWithoutVerifiedSupabasePrincipalFailsClosed() {
        SecurityContextHolder.clearContext();
        try {
            assertThatThrownBy(() -> profileRepository.findAll())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("verified Supabase user is required");
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}
