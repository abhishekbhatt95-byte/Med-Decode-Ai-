package com.meddecode.repository;

import com.meddecode.entity.ChatConversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ChatConversationRepository extends JpaRepository<ChatConversation, UUID> {

    @Query("SELECT c FROM ChatConversation c WHERE c.profile.id = :userId ORDER BY c.updatedAt DESC")
    List<ChatConversation> findByUserId(@Param("userId") UUID userId);

    @Query("SELECT c FROM ChatConversation c WHERE c.id = :id AND c.profile.id = :userId")
    Optional<ChatConversation> findByIdAndUserId(@Param("id") UUID id, @Param("userId") UUID userId);
}
