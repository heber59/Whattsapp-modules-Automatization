ALTER TABLE app.operation_notifications ADD COLUMN delivery_state text NOT NULL DEFAULT 'inbox' CHECK (delivery_state IN ('inbox','pending','sending','sent','retry','manual_review','failed','discarded'));
ALTER TABLE app.operation_notifications ADD COLUMN payload jsonb;
ALTER TABLE app.operation_notifications ADD COLUMN attempts integer NOT NULL DEFAULT 0;
ALTER TABLE app.operation_notifications ADD COLUMN provider_message_id text UNIQUE;
ALTER TABLE app.operation_notifications ADD COLUMN available_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE app.operation_notifications ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX operation_notifications_delivery_idx ON app.operation_notifications(available_at,created_at) WHERE delivery_state IN ('pending','retry','sending');
