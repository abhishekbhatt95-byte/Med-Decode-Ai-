package com.meddecode.entity;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "medicines", schema = "public")
public class Medicine {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "analysis_id", nullable = false)
    private Analysis analysis;

    @Column(name = "brand_name", nullable = false)
    private String brandName;

    @Column(name = "generic_name")
    private String genericName;

    @Column(name = "category")
    private String category;

    @Column(name = "common_uses", columnDefinition = "TEXT")
    private String commonUses;

    @Column(name = "how_it_works", columnDefinition = "TEXT")
    private String howItWorks;

    @Column(name = "side_effects", columnDefinition = "TEXT")
    private String sideEffects;

    @Column(name = "food_restrictions", columnDefinition = "TEXT")
    private String foodRestrictions;

    @Column(name = "precautions", columnDefinition = "TEXT")
    private String precautions;

    @Column(name = "confidence_score", nullable = false)
    private Double confidenceScore = 100.0;

    public Medicine() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public Analysis getAnalysis() { return analysis; }
    public void setAnalysis(Analysis analysis) { this.analysis = analysis; }

    public String getBrandName() { return brandName; }
    public void setBrandName(String brandName) { this.brandName = brandName; }

    public String getGenericName() { return genericName; }
    public void setGenericName(String genericName) { this.genericName = genericName; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getCommonUses() { return commonUses; }
    public void setCommonUses(String commonUses) { this.commonUses = commonUses; }

    public String getHowItWorks() { return howItWorks; }
    public void setHowItWorks(String howItWorks) { this.howItWorks = howItWorks; }

    public String getSideEffects() { return sideEffects; }
    public void setSideEffects(String sideEffects) { this.sideEffects = sideEffects; }

    public String getFoodRestrictions() { return foodRestrictions; }
    public void setFoodRestrictions(String foodRestrictions) { this.foodRestrictions = foodRestrictions; }

    public String getPrecautions() { return precautions; }
    public void setPrecautions(String precautions) { this.precautions = precautions; }

    public Double getConfidenceScore() { return confidenceScore; }
    public void setConfidenceScore(Double confidenceScore) { this.confidenceScore = confidenceScore; }
}
