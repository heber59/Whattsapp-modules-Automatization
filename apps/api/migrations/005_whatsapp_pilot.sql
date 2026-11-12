CREATE TABLE app.whatsapp_channels (
  phone_number_id text PRIMARY KEY CHECK (phone_number_id ~ '^[0-9]{5,30}$'),
  business_id uuid NOT NULL UNIQUE REFERENCES app.businesses(id) ON DELETE CASCADE,
  flow_id uuid NOT NULL,
  version integer NOT NULL,
  configured_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (phone_number_id,business_id),
  FOREIGN KEY (business_id, flow_id, version) REFERENCES app.flow_versions(business_id, flow_id, version)
);
CREATE TABLE app.whatsapp_inbox (
  id text PRIMARY KEY,
  ingest_sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  phone_number_id text NOT NULL REFERENCES app.whatsapp_channels(phone_number_id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender ~ '^[1-9][0-9]{6,14}$'),
  text text,
  sent_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','processed','ignored','failed'))
);
CREATE INDEX whatsapp_inbox_pending_idx ON app.whatsapp_inbox(phone_number_id,sender,ingest_sequence) WHERE state='pending';
CREATE TABLE app.whatsapp_conversations (
  phone_number_id text NOT NULL REFERENCES app.whatsapp_channels(phone_number_id) ON DELETE CASCADE,
  sender text NOT NULL,
  business_id uuid NOT NULL,
  flow_id uuid NOT NULL,
  version integer NOT NULL,
  menu_step_id text,
  state text NOT NULL CHECK (state IN ('waiting','completed','paused')),
  last_inbound_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (phone_number_id,sender),
  FOREIGN KEY (phone_number_id,business_id) REFERENCES app.whatsapp_channels(phone_number_id,business_id) ON DELETE CASCADE,
  FOREIGN KEY (business_id,flow_id,version) REFERENCES app.flow_versions(business_id,flow_id,version)
);
CREATE TABLE app.whatsapp_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inbox_id text NOT NULL REFERENCES app.whatsapp_inbox(id) ON DELETE CASCADE,
  sequence integer NOT NULL,
  phone_number_id text NOT NULL REFERENCES app.whatsapp_channels(phone_number_id) ON DELETE CASCADE,
  recipient text NOT NULL,
  text text NOT NULL CHECK (length(text) BETWEEN 1 AND 4096),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','sending','sent','failed','manual_review','expired')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  provider_message_id text UNIQUE,
  delivery_status text,
  UNIQUE (inbox_id,sequence)
);
CREATE INDEX whatsapp_outbox_pending_idx ON app.whatsapp_outbox(available_at,created_at) WHERE state='pending';
CREATE TABLE app.whatsapp_status_events (
  message_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('sent','delivered','read','failed')),
  event_at timestamptz NOT NULL,
  PRIMARY KEY(message_id,status,event_at)
);
ALTER TABLE app.whatsapp_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.whatsapp_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.whatsapp_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.whatsapp_status_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app.whatsapp_channels,app.whatsapp_inbox,app.whatsapp_conversations,app.whatsapp_outbox,app.whatsapp_status_events FROM PUBLIC;
