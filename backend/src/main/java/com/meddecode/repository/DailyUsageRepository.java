package com.meddecode.repository;

import com.meddecode.entity.DailyUsage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DailyUsageRepository extends JpaRepository<DailyUsage, UUID> {

    @Query("SELECT u FROM DailyUsage u WHERE u.profile.id = :userId AND u.date = :date AND u.feature = :feature")
    Optional<DailyUsage> findByUserIdAndDateAndFeature(
        @Param("userId") UUID userId,
        @Param("date") LocalDate date,
        @Param("feature") String feature
    );
}
