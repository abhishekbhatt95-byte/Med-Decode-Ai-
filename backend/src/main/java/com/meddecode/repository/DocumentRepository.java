package com.meddecode.repository;

import com.meddecode.entity.Document;
import com.meddecode.entity.DocumentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DocumentRepository extends JpaRepository<Document, UUID> {

    @Query("SELECT d FROM Document d WHERE d.profile.id = :userId AND d.deletedAt IS NULL ORDER BY d.createdAt DESC")
    List<Document> findByUserIdAndNotDeleted(@Param("userId") UUID userId);

    @Query("SELECT d FROM Document d WHERE d.id = :id AND d.profile.id = :userId AND d.deletedAt IS NULL")
    Optional<Document> findByIdAndUserId(@Param("id") UUID id, @Param("userId") UUID userId);

    @Query("SELECT d FROM Document d WHERE d.profile.id = :userId AND d.status = :status AND d.deletedAt IS NULL")
    List<Document> findByUserIdAndStatus(@Param("userId") UUID userId, @Param("status") DocumentStatus status);
}
