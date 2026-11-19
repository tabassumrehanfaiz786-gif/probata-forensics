CREATE TYPE public.app_role AS ENUM ('analyst', 'compliance', 'admin');
CREATE TYPE public.case_status AS ENUM ('new', 'under_review', 'escalated', 'dismissed');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.top_role(_user_id uuid)
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
  ORDER BY CASE role WHEN 'admin' THEN 3 WHEN 'compliance' THEN 2 ELSE 1 END DESC LIMIT 1
$$;

CREATE POLICY "Team can view roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins grant roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins revoke roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'analyst') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.case_states (
  case_ref text PRIMARY KEY,
  status public.case_status,
  narrative_marc text,
  narrative_mica text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.case_states TO authenticated;
GRANT ALL ON public.case_states TO service_role;
ALTER TABLE public.case_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can view case decisions" ON public.case_states FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team can record case decisions" ON public.case_states FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Team can update case decisions" ON public.case_states FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION public.enforce_case_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  old_status public.case_status := CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END;
  old_marc text := CASE WHEN TG_OP = 'UPDATE' THEN OLD.narrative_marc ELSE NULL END;
  old_mica text := CASE WHEN TG_OP = 'UPDATE' THEN OLD.narrative_mica ELSE NULL END;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF NEW.status IS DISTINCT FROM old_status AND NEW.status IS NOT NULL THEN
    IF NEW.status IN ('escalated', 'dismissed', 'new')
       AND NOT (public.has_role(uid, 'compliance') OR public.has_role(uid, 'admin')) THEN
      RAISE EXCEPTION 'Your role cannot set status %', NEW.status;
    END IF;
  END IF;
  IF (NEW.narrative_marc IS DISTINCT FROM old_marc OR NEW.narrative_mica IS DISTINCT FROM old_mica)
     AND NOT (public.has_role(uid, 'analyst') OR public.has_role(uid, 'compliance')) THEN
    RAISE EXCEPTION 'Your role cannot edit narratives';
  END IF;
  NEW.updated_by := uid;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER case_states_enforce BEFORE INSERT OR UPDATE ON public.case_states FOR EACH ROW EXECUTE FUNCTION public.enforce_case_state();

CREATE TABLE public.live_cases (
  case_ref text PRIMARY KEY,
  scenario jsonb NOT NULL,
  promoted_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.live_cases TO authenticated;
GRANT ALL ON public.live_cases TO service_role;
ALTER TABLE public.live_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can view live cases" ON public.live_cases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team can promote live cases" ON public.live_cases FOR INSERT TO authenticated WITH CHECK (promoted_by = auth.uid());

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  actor text,
  role public.app_role,
  action text NOT NULL,
  target text NOT NULL,
  detail text NOT NULL DEFAULT '—'
);
CREATE INDEX audit_log_ts_idx ON public.audit_log (ts DESC);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can read audit log" ON public.audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team can append to audit log" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.stamp_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.ts := now();
  NEW.user_id := auth.uid();
  NEW.role := public.top_role(auth.uid());
  NEW.actor := (SELECT email FROM public.profiles WHERE id = auth.uid());
  RETURN NEW;
END;
$$;
CREATE TRIGGER audit_log_stamp BEFORE INSERT ON public.audit_log FOR EACH ROW EXECUTE FUNCTION public.stamp_audit();

ALTER PUBLICATION supabase_realtime ADD TABLE public.case_states;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_cases;
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_log;