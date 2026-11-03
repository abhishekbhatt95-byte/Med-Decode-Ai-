package com.meddecode.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
public class HealthController {

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> getHealth() {
        return ResponseEntity.ok(Map.of(
            "status", "UP",
            "service", "MedDecode AI Backend",
            "runtime", "Java 25",
            "framework", "Spring Boot 3.5.16",
            "architecture", "Hybrid Spring Boot + Supabase",
            "timestamp", Instant.now().toString()
        ));
    }
}
