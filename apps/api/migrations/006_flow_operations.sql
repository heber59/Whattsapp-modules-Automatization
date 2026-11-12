ALTER TABLE app.whatsapp_conversations ADD COLUMN variables jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE app.whatsapp_conversations ADD COLUMN operator_paused boolean NOT NULL DEFAULT false;
ALTER TABLE app.whatsapp_outbox ADD COLUMN payload jsonb;
ALTER TABLE app.whatsapp_outbox ADD COLUMN operator_message boolean NOT NULL DEFAULT false;
CREATE TABLE app.flow_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES app.businesses(id) ON DELETE CASCADE,
  phone_number_id text NOT NULL,
  sender text NOT NULL,
  inbox_id text NOT NULL REFERENCES app.whatsapp_inbox(id) ON DELETE CASCADE,
  step_id text NOT NULL,
  data jsonb NOT NULL,
  total numeric(16,2) CHECK (total >= 0),
  currency text NOT NULL DEFAULT 'COP',
  state text NOT NULL CHECK (state IN ('pending_approval','confirmed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(inbox_id,step_id),
  FOREIGN KEY(phone_number_id,sender) REFERENCES app.whatsapp_conversations(phone_number_id,sender) ON DELETE CASCADE
);
CREATE TABLE app.operation_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES app.businesses(id) ON DELETE CASCADE,
  sender text NOT NULL,
  inbox_id text NOT NULL REFERENCES app.whatsapp_inbox(id) ON DELETE CASCADE,
  step_id text NOT NULL,
  recipient text NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  UNIQUE(inbox_id,step_id)
);
CREATE INDEX flow_orders_business_idx ON app.flow_orders(business_id,created_at DESC);
CREATE INDEX operation_notifications_business_idx ON app.operation_notifications(business_id,created_at DESC);
ALTER TABLE app.flow_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.operation_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app.flow_orders,app.operation_notifications FROM PUBLIC;
