CREATE TABLE app.commercial_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid,
  kind text NOT NULL CHECK (kind IN ('contact', 'purchase')),
  email text CHECK (email IS NULL OR length(email) BETWEEN 3 AND 254),
  phone text CHECK (phone IS NULL OR phone ~ '^\+[1-9][0-9]{7,14}$'),
  name text CHECK (name IS NULL OR length(name) BETWEEN 1 AND 100),
  message text CHECK (message IS NULL OR length(message) <= 2000),
  plan text CHECK (plan IN ('starter', 'growth', 'scale')),
  status text NOT NULL DEFAULT 'pending_contact' CHECK (status IN ('pending_contact', 'contacted', 'closed')),
  consent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (email IS NOT NULL OR phone IS NOT NULL),
  CHECK ((kind = 'contact' AND plan IS NULL) OR (kind = 'purchase' AND plan IS NOT NULL AND auth_user_id IS NOT NULL))
);
ALTER TABLE app.commercial_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app.commercial_requests FROM PUBLIC;
