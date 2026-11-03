package com.meddecode.repository;

import com.meddecode.entity.ReviewFlag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ReviewFlagRepository extends JpaRepository<ReviewFlag, UUID> {
    List<ReviewFlag> findByAnalysisId(UUID analysisId);
}
