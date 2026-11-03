package com.meddecode.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "review_flags", schema = "public")
public class ReviewFlag {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "analysis_id", nullable = false)
    private Analysis analysis;

    @Column(name = "flag_reason", nullable = false, columnDefinition = "TEXT")
    private String flagReason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "flagged_by")
    private Profile flaggedBy;

    @Enumerated(EnumType.STRING)
    @Column(name = "status")
    private ReviewStatus status = ReviewStatus.pending;

    @Column(name = "resolved_at")
    private OffsetDateTime resolvedAt;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public ReviewFlag() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public Analysis getAnalysis() { return analysis; }
    public void setAnalysis(Analysis analysis) { this.analysis = analysis; }

    public String getFlagReason() { return flagReason; }
    public void setFlagReason(String flagReason) { this.flagReason = flagReason; }

    public Profile getFlaggedBy() { return flaggedBy; }
    public void setFlaggedBy(Profile flaggedBy) { this.flaggedBy = flaggedBy; }

    public ReviewStatus getStatus() { return status; }
    public void setStatus(ReviewStatus status) { this.status = status; }

    public OffsetDateTime getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(OffsetDateTime resolvedAt) { this.resolvedAt = resolvedAt; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}
