CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_username text;
  final_username text;
  display text;
BEGIN
  base_username := COALESCE(
    NULLIF(regexp_replace(regexp_replace(new.raw_user_meta_data->>'username', '^@+', ''), '[^a-zA-Z0-9_]', '_', 'g'), ''),
    split_part(new.email, '@', 1),
    'user'
  );
  base_username := left(regexp_replace(base_username, '_+', '_', 'g'), 24);
  final_username := base_username;
  display := COALESCE(NULLIF(new.raw_user_meta_data->>'display_name', ''), base_username);

  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username AND id <> new.id) THEN
    final_username := left(base_username, 19) || '_' || substr(new.id::text, 1, 4);
  END IF;

  INSERT INTO public.profiles (id, username, display_name)
  VALUES (new.id, final_username, display)
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;