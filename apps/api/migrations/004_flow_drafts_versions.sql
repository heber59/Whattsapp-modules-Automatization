CREATE TABLE app.flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES app.businesses(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  steps jsonb NOT NULL CHECK (jsonb_typeof(steps) = 'array'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, id)
);
CREATE INDEX flows_business_idx ON app.flows(business_id, created_at, id);
CREATE TABLE app.flow_versions (
  business_id uuid NOT NULL,
  flow_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  source_revision integer NOT NULL CHECK (source_revision > 0),
  name text NOT NULL,
  steps jsonb NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, flow_id, version),
  UNIQUE (business_id, flow_id, source_revision),
  FOREIGN KEY (business_id, flow_id) REFERENCES app.flows(business_id, id) ON DELETE CASCADE
);
CREATE FUNCTION app.prevent_flow_version_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Published flow versions are immutable';
END;
$$;
CREATE TRIGGER flow_version_immutable BEFORE UPDATE ON app.flow_versions
FOR EACH ROW EXECUTE FUNCTION app.prevent_flow_version_update();
ALTER TABLE app.flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.flow_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app.flows, app.flow_versions FROM PUBLIC;
REVOKE ALL ON FUNCTION app.prevent_flow_version_update() FROM PUBLIC;
