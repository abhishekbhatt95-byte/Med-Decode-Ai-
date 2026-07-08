CREATE TABLE IF NOT EXISTS public.chat_conversations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    analysis_id uuid REFERENCES public.analyses(id) ON DELETE CASCADE,
    title text DEFAULT 'New Conversation' NOT NULL,
    role_persona text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content text NOT NULL,
    model_used text,
    token_count integer,
    status text DEFAULT 'completed' NOT NULL CHECK (status IN ('completed', 'cancelled')),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.voice_sessions
  ADD COLUMN IF NOT EXISTS analysis_id uuid REFERENCES public.analyses(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS started_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS ended_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS model_used text,
  ADD COLUMN IF NOT EXISTS interruptions integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reconnects integer DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON public.chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_analysis_id ON public.chat_conversations(analysis_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON public.chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_user_id ON public.voice_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_analysis_id ON public.voice_sessions(analysis_id);

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own conversations" ON public.chat_conversations;
CREATE POLICY "Users can manage their own conversations" ON public.chat_conversations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage messages in their conversations" ON public.chat_messages;
CREATE POLICY "Users can manage messages in their conversations" ON public.chat_messages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
      AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
      AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage their own voice sessions" ON public.voice_sessions;
CREATE POLICY "Users can manage their own voice sessions" ON public.voice_sessions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT ALL ON public.chat_conversations TO authenticated, anon;
GRANT ALL ON public.chat_messages TO authenticated, anon;
GRANT ALL ON public.voice_sessions TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.generate_chat_title_from_message(p_content text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_lower text;
BEGIN
  v_lower := lower(p_content);
  if v_lower like '%blood%' or v_lower like '%lipid%' or v_lower like '%cholesterol%' or v_lower like '%hba1c%' or v_lower like '%glucose%' then
    return 'Blood Test Discussion';
  elsif v_lower like '%bill%' or v_lower like '%invoice%' or v_lower like '%charge%' or v_lower like '%cost%' or v_lower like '%payment%' then
    return 'Hospital Bill Review';
  elsif v_lower like '%mri%' or v_lower like '%x-ray%' or v_lower like '%ct%' or v_lower like '%ultrasound%' or v_lower like '%scan%' or v_lower like '%imaging%' or v_lower like '%ecg%' or v_lower like '%ekg%' then
    return 'Diagnostic Scan Review';
  elsif v_lower like '%prescription%' or v_lower like '%medicine%' or v_lower like '%medication%' or v_lower like '%drug%' or v_lower like '%dose%' then
    return 'Prescription Review';
  else
    return initcap(substring(p_content from 1 for 35)) || case when length(p_content) > 35 then '...' else '' end;
  end if;
END;
$$;

CREATE OR REPLACE FUNCTION public.trig_handle_chat_message_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_msg_count int;
  v_generated_title text;
BEGIN
  if new.role = 'user' then
    SELECT count(*) INTO v_msg_count
    FROM public.chat_messages
    WHERE conversation_id = new.conversation_id;

    if v_msg_count = 1 then
      v_generated_title := public.generate_chat_title_from_message(new.content);
      UPDATE public.chat_conversations
      SET title = v_generated_title,
          updated_at = now()
      WHERE id = new.conversation_id;
    else
      UPDATE public.chat_conversations
      SET updated_at = now()
      WHERE id = new.conversation_id;
    end if;
  end if;
  return new;
END;
$$;

DROP TRIGGER IF EXISTS trig_chat_message_inserted ON public.chat_messages;
CREATE TRIGGER trig_chat_message_inserted
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trig_handle_chat_message_insert();

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  new.updated_at = now();
  return new;
END;
$$;

DROP TRIGGER IF EXISTS trig_chat_conversations_updated ON public.chat_conversations;
CREATE TRIGGER trig_chat_conversations_updated
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
