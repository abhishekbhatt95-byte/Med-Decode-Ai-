package com.meddecode.repository;

import com.meddecode.entity.SharedLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SharedLinkRepository extends JpaRepository<SharedLink, UUID> {

    @Query("SELECT s FROM SharedLink s WHERE s.token = :token AND s.expiresAt > :now")
    Optional<SharedLink> findActiveByToken(@Param("token") String token, @Param("now") OffsetDateTime now);
}
