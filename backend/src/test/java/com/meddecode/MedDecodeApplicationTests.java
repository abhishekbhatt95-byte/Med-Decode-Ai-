package com.meddecode;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class MedDecodeApplicationTests {

    @Test
    void contextLoads() {
        // Verifies Spring application context bootstrapping successfully under Java 25 & Spring Boot 3.5.16
    }
}
