package com.meddecode.repository;

import com.meddecode.entity.ExtractedText;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ExtractedTextRepository extends JpaRepository<ExtractedText, UUID> {
    List<ExtractedText> findByDocumentId(UUID documentId);
}
