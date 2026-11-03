package com.meddecode.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "usage", schema = "public", uniqueConstraints = {
    @UniqueConstraint(name = "usage_user_date_feature_unique", columnNames = {"user_id", "date", "feature"})
})
public class DailyUsage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private Profile profile;

    @Column(name = "date", nullable = false)
    private LocalDate date = LocalDate.now();

    @Column(name = "count", nullable = false)
    private Integer count = 0;

    @Column(name = "feature", nullable = false)
    private String feature = "analysis";

    public DailyUsage() {}

    public DailyUsage(Profile profile, LocalDate date, String feature) {
        this.profile = profile;
        this.date = date;
        this.feature = feature;
        this.count = 1;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public Profile getProfile() { return profile; }
    public void setProfile(Profile profile) { this.profile = profile; }

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

    public Integer getCount() { return count; }
    public void setCount(Integer count) { this.count = count; }

    public String getFeature() { return feature; }
    public void setFeature(String feature) { this.feature = feature; }
}
