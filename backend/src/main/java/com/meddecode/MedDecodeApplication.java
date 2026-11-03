package com.meddecode;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.transaction.annotation.EnableTransactionManagement;

@SpringBootApplication
@EnableTransactionManagement(order = 100)
public class MedDecodeApplication {

    public static void main(String[] args) {
        SpringApplication.run(MedDecodeApplication.class, args);
    }
}
