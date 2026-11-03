package com.meddecode.repository;

import com.meddecode.entity.ConfidenceScore;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ConfidenceScoreRepository extends JpaRepository<ConfidenceScore, UUID> {
    List<ConfidenceScore> findByAnalysisId(UUID analysisId);
}
