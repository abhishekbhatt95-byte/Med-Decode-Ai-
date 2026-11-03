package com.meddecode.repository;

import com.meddecode.entity.Analysis;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AnalysisRepository extends JpaRepository<Analysis, UUID> {

    @Query("SELECT a FROM Analysis a WHERE a.document.id = :documentId ORDER BY a.createdAt DESC")
    List<Analysis> findByDocumentId(@Param("documentId") UUID documentId);

    @Query("SELECT a FROM Analysis a WHERE a.id = :analysisId AND a.document.profile.id = :userId")
    Optional<Analysis> findByIdAndUserId(@Param("analysisId") UUID analysisId, @Param("userId") UUID userId);
}
