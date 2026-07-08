-- Migration: Add processing_stage column to documents table
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS processing_stage text DEFAULT NULL
  CHECK (processing_stage IN ('ocr', 'ai_analysis', 'saving', NULL));
