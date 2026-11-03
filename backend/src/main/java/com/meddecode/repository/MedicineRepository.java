package com.meddecode.repository;

import com.meddecode.entity.Medicine;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface MedicineRepository extends JpaRepository<Medicine, UUID> {

    @Query("SELECT m FROM Medicine m WHERE m.analysis.id = :analysisId")
    List<Medicine> findByAnalysisId(@Param("analysisId") UUID analysisId);

    @Query("SELECT m FROM Medicine m WHERE m.analysis.document.profile.id = :userId")
    List<Medicine> findByUserId(@Param("userId") UUID userId);
}
