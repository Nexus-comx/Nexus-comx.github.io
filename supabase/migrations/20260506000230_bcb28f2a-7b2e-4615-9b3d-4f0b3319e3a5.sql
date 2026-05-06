
-- ============ STUDY GROUPS ============
CREATE TABLE public.study_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  topic text,
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.study_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
ALTER TABLE public.study_group_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.study_group_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  invitee_id uuid NOT NULL,
  inviter_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, invitee_id)
);
ALTER TABLE public.study_group_invites ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.study_group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.study_group_messages ENABLE ROW LEVEL SECURITY;

-- helper: is member of group
CREATE OR REPLACE FUNCTION public.is_group_member(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.study_group_members WHERE group_id = _group_id AND user_id = _user_id);
$$;

-- study_groups policies
CREATE POLICY "members view group" ON public.study_groups FOR SELECT TO authenticated
  USING (public.is_group_member(id, auth.uid()) OR owner_id = auth.uid());
CREATE POLICY "create own group" ON public.study_groups FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id AND NOT public.is_banned(auth.uid()));
CREATE POLICY "owner or admin delete group" ON public.study_groups FOR DELETE TO authenticated
  USING (auth.uid() = owner_id OR public.is_admin_or_owner(auth.uid()));
CREATE POLICY "owner update group" ON public.study_groups FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id);

-- members policies
CREATE POLICY "members view membership" ON public.study_group_members FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()) OR user_id = auth.uid());
CREATE POLICY "join via accepted invite" ON public.study_group_members FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND NOT public.is_banned(auth.uid()) AND (
      EXISTS (SELECT 1 FROM public.study_groups g WHERE g.id = group_id AND g.owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.study_group_invites i WHERE i.group_id = study_group_members.group_id AND i.invitee_id = auth.uid())
    )
  );
CREATE POLICY "leave group" ON public.study_group_members FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.study_groups g WHERE g.id = group_id AND g.owner_id = auth.uid()));

-- invites policies
CREATE POLICY "view related invites" ON public.study_group_invites FOR SELECT TO authenticated
  USING (auth.uid() = invitee_id OR auth.uid() = inviter_id OR EXISTS (SELECT 1 FROM public.study_groups g WHERE g.id = group_id AND g.owner_id = auth.uid()));
CREATE POLICY "owner invites" ON public.study_group_invites FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = inviter_id AND NOT public.is_banned(auth.uid())
    AND EXISTS (SELECT 1 FROM public.study_groups g WHERE g.id = group_id AND g.owner_id = auth.uid())
  );
CREATE POLICY "respond to own invite" ON public.study_group_invites FOR UPDATE TO authenticated
  USING (auth.uid() = invitee_id);
CREATE POLICY "delete own invite" ON public.study_group_invites FOR DELETE TO authenticated
  USING (auth.uid() = invitee_id OR auth.uid() = inviter_id);

-- group messages
CREATE POLICY "members view msgs" ON public.study_group_messages FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "members send msgs" ON public.study_group_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND NOT public.is_banned(auth.uid()) AND public.is_group_member(group_id, auth.uid()));

-- ============ VOICE CALLS ============
CREATE TABLE public.voice_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  started_by uuid NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.voice_calls ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.voice_call_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES public.voice_calls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  UNIQUE (call_id, user_id)
);
ALTER TABLE public.voice_call_participants ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.voice_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES public.voice_calls(id) ON DELETE CASCADE,
  from_user uuid NOT NULL,
  to_user uuid NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.voice_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group members view calls" ON public.voice_calls FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "group members start call" ON public.voice_calls FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = started_by AND NOT public.is_banned(auth.uid()) AND public.is_group_member(group_id, auth.uid()));
CREATE POLICY "starter ends call" ON public.voice_calls FOR UPDATE TO authenticated
  USING (auth.uid() = started_by OR public.is_group_member(group_id, auth.uid()));

CREATE POLICY "view call participants" ON public.voice_call_participants FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.voice_calls c WHERE c.id = call_id AND public.is_group_member(c.group_id, auth.uid())));
CREATE POLICY "join call" ON public.voice_call_participants FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_banned(auth.uid())
    AND EXISTS (SELECT 1 FROM public.voice_calls c WHERE c.id = call_id AND public.is_group_member(c.group_id, auth.uid())));
CREATE POLICY "leave call" ON public.voice_call_participants FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "delete own participant" ON public.voice_call_participants FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "view signals to me" ON public.voice_signals FOR SELECT TO authenticated
  USING (auth.uid() = to_user OR auth.uid() = from_user);
CREATE POLICY "send signals" ON public.voice_signals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = from_user AND NOT public.is_banned(auth.uid())
    AND EXISTS (SELECT 1 FROM public.voice_calls c WHERE c.id = call_id AND public.is_group_member(c.group_id, auth.uid())));
CREATE POLICY "delete own signals" ON public.voice_signals FOR DELETE TO authenticated
  USING (auth.uid() = from_user OR auth.uid() = to_user);

-- ============ NOTIFICATION TRIGGERS ============
CREATE OR REPLACE FUNCTION public.notify_group_invite()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g_name text; inviter_name text; is_admin_invite boolean;
BEGIN
  SELECT name INTO g_name FROM public.study_groups WHERE id = NEW.group_id;
  SELECT COALESCE(display_name, username) INTO inviter_name FROM public.profiles WHERE id = NEW.inviter_id;
  is_admin_invite := public.is_admin_or_owner(NEW.inviter_id);
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    NEW.invitee_id,
    CASE WHEN is_admin_invite THEN 'admin_invite' ELSE 'group_invite' END,
    CASE WHEN is_admin_invite THEN 'Invite from ' || COALESCE(inviter_name,'an admin') ELSE 'Study group invite' END,
    COALESCE(inviter_name,'Someone') || ' invited you to "' || COALESCE(g_name,'a group') || '"',
    '/study'
  );
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_group_invite AFTER INSERT ON public.study_group_invites
  FOR EACH ROW EXECUTE FUNCTION public.notify_group_invite();

CREATE OR REPLACE FUNCTION public.notify_group_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g_name text; sender_name text;
BEGIN
  SELECT name INTO g_name FROM public.study_groups WHERE id = NEW.group_id;
  SELECT COALESCE(display_name, username) INTO sender_name FROM public.profiles WHERE id = NEW.sender_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT m.user_id, 'group_message',
    COALESCE(sender_name,'Someone') || ' in ' || COALESCE(g_name,'a group'),
    left(NEW.content,120), '/study'
  FROM public.study_group_members m
  WHERE m.group_id = NEW.group_id AND m.user_id <> NEW.sender_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_group_message AFTER INSERT ON public.study_group_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_group_message();

CREATE OR REPLACE FUNCTION public.notify_voice_call()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g_name text; starter text;
BEGIN
  SELECT name INTO g_name FROM public.study_groups WHERE id = NEW.group_id;
  SELECT COALESCE(display_name, username) INTO starter FROM public.profiles WHERE id = NEW.started_by;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT m.user_id, 'voice_call',
    '📞 Voice call started in ' || COALESCE(g_name,'a group'),
    COALESCE(starter,'Someone') || ' started a call. Join now.',
    '/study'
  FROM public.study_group_members m
  WHERE m.group_id = NEW.group_id AND m.user_id <> NEW.started_by;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_voice_call AFTER INSERT ON public.voice_calls
  FOR EACH ROW EXECUTE FUNCTION public.notify_voice_call();

-- realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.study_groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.study_group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.study_group_invites;
ALTER PUBLICATION supabase_realtime ADD TABLE public.study_group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_call_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_signals;
