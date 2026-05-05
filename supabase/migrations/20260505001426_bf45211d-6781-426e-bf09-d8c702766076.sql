
-- Roles enum + table
CREATE TYPE public.app_role AS ENUM ('owner','admin','user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_owner(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','owner'));
$$;

CREATE POLICY "anyone authed can view roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "owners manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner')) WITH CHECK (public.has_role(auth.uid(),'owner'));

-- Banned users
CREATE TABLE public.banned_users (
  user_id uuid PRIMARY KEY,
  reason text,
  banned_by uuid,
  banned_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.banned_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_banned(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.banned_users WHERE user_id = _user_id);
$$;

CREATE POLICY "view own ban or admin views all" ON public.banned_users FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin_or_owner(auth.uid()));
CREATE POLICY "admins ban users" ON public.banned_users FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_owner(auth.uid()) AND NOT public.has_role(user_id,'owner'));
CREATE POLICY "admins unban users" ON public.banned_users FOR DELETE TO authenticated
  USING (public.is_admin_or_owner(auth.uid()));

-- Notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notif_user ON public.notifications(user_id, read, created_at DESC);

CREATE POLICY "view own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "system inserts notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Trigger: notify on new DM
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sender_name text;
BEGIN
  SELECT COALESCE(display_name, username) INTO sender_name FROM public.profiles WHERE id = NEW.sender_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (NEW.recipient_id, 'message', 'New message from ' || COALESCE(sender_name,'someone'), left(NEW.content, 120), '/chat');
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_message AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();

-- Block banned users from sending messages or inserting into key tables
CREATE POLICY "banned users cannot send messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND NOT public.is_banned(auth.uid()));
DROP POLICY "send messages" ON public.messages;

-- Auto-assign roles by username on profile creation/update
CREATE OR REPLACE FUNCTION public.assign_seed_roles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u text; r public.app_role;
BEGIN
  u := lower(regexp_replace(COALESCE(NEW.username,''), '[^a-zA-Z0-9]', '', 'g'));
  IF u IN ('thecreatorofnexus') THEN r := 'owner';
  ELSIF u IN ('34noefaridtayonoubiengang','adriel_cool','adrielcool','mohomedbx','mohomed_bx') THEN r := 'admin';
  ELSE RETURN NEW;
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, r) ON CONFLICT DO NOTHING;
  IF r = 'owner' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_assign_seed_roles AFTER INSERT OR UPDATE OF username ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.assign_seed_roles();

-- Backfill existing matching profiles
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'owner'::public.app_role FROM public.profiles
WHERE lower(regexp_replace(username,'[^a-zA-Z0-9]','','g')) = 'thecreatorofnexus'
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM public.profiles
WHERE lower(regexp_replace(username,'[^a-zA-Z0-9]','','g')) IN
  ('thecreatorofnexus','34noefaridtayonoubiengang','adriel_cool','adrielcool','mohomedbx','mohomed_bx')
ON CONFLICT DO NOTHING;

-- Default 'user' role for everyone (optional but consistent)
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id,'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_assign_default_role AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.assign_default_role();

INSERT INTO public.user_roles (user_id, role) SELECT id, 'user' FROM public.profiles ON CONFLICT DO NOTHING;
