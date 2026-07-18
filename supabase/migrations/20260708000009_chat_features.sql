ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS pinned boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_conversations_pinned ON public.chat_conversations(pinned);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_archived ON public.chat_conversations(archived);
