CREATE TABLE public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view own ai messages" ON public.ai_messages
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert own ai messages" ON public.ai_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete own ai messages" ON public.ai_messages
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX ai_messages_user_created_idx ON public.ai_messages(user_id, created_at);