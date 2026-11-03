package com.meddecode.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "analyses", schema = "public")
public class Analysis {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id", nullable = false)
    private Document document;

    @Column(name = "summary", nullable = false, columnDefinition = "TEXT")
    private String summary;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "structured_output", nullable = false, columnDefinition = "jsonb")
    private String structuredOutput;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "doctor_questions", nullable = false, columnDefinition = "jsonb")
    private String doctorQuestions;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public Analysis() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public Document getDocument() { return document; }
    public void setDocument(Document document) { this.document = document; }

    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }

    public String getStructuredOutput() { return structuredOutput; }
    public void setStructuredOutput(String structuredOutput) { this.structuredOutput = structuredOutput; }

    public String getDoctorQuestions() { return doctorQuestions; }
    public void setDoctorQuestions(String doctorQuestions) { this.doctorQuestions = doctorQuestions; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}
