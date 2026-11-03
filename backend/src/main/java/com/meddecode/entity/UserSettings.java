package com.meddecode.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "user_settings", schema = "public")
public class UserSettings {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "id")
    private Profile profile;

    @Column(name = "theme")
    private String theme = "light";

    @Column(name = "large_text")
    private Boolean largeText = false;

    @Column(name = "high_contrast")
    private Boolean highContrast = false;

    @Column(name = "email_notifications")
    private Boolean emailNotifications = true;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    public UserSettings() {}

    public UserSettings(Profile profile) {
        this.profile = profile;
        this.id = profile != null ? profile.getId() : null;
        this.updatedAt = OffsetDateTime.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public Profile getProfile() { return profile; }
    public void setProfile(Profile profile) { this.profile = profile; }

    public String getTheme() { return theme; }
    public void setTheme(String theme) { this.theme = theme; }

    public Boolean getLargeText() { return largeText; }
    public void setLargeText(Boolean largeText) { this.largeText = largeText; }

    public Boolean getHighContrast() { return highContrast; }
    public void setHighContrast(Boolean highContrast) { this.highContrast = highContrast; }

    public Boolean getEmailNotifications() { return emailNotifications; }
    public void setEmailNotifications(Boolean emailNotifications) { this.emailNotifications = emailNotifications; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
