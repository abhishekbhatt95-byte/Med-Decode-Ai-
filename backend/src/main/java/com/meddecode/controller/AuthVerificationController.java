package com.meddecode.controller;

import com.meddecode.config.SupabaseUserPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthVerificationController {

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getAuthenticatedUser(
        @AuthenticationPrincipal SupabaseUserPrincipal principal
    ) {
        if (principal == null) {
            return ResponseEntity.status(401).build();
        }

        return ResponseEntity.ok(Map.of(
            "userId", principal.userId() != null ? principal.userId().toString() : "null",
            "email", principal.email() != null ? principal.email() : "anonymous",
            "dbRole", principal.dbRole(),
            "isAnonymous", principal.isAnonymous()
        ));
    }
}
