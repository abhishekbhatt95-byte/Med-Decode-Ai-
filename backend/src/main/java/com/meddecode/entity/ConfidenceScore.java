package com.meddecode.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "confidence_scores", schema = "public")
public class ConfidenceScore {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "analysis_id", nullable = false)
    private Analysis analysis;

    @Column(name = "ocr_confidence", nullable = false)
    private Double ocrConfidence;

    @Column(name = "ai_confidence", nullable = false)
    private Double aiConfidence;

    @Column(name = "overall_confidence", nullable = false)
    private Double overallConfidence;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public ConfidenceScore() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public Analysis getAnalysis() { return analysis; }
    public void setAnalysis(Analysis analysis) { this.analysis = analysis; }

    public Double getOcrConfidence() { return ocrConfidence; }
    public void setOcrConfidence(Double ocrConfidence) { this.ocrConfidence = ocrConfidence; }

    public Double getAiConfidence() { return aiConfidence; }
    public void setAiConfidence(Double aiConfidence) { this.aiConfidence = aiConfidence; }

    public Double getOverallConfidence() { return overallConfidence; }
    public void setOverallConfidence(Double overallConfidence) { this.overallConfidence = overallConfidence; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}
