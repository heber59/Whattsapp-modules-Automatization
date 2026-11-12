ALTER TABLE app.commercial_requests DROP CONSTRAINT commercial_requests_plan_check;
UPDATE app.commercial_requests SET plan = 'full-access' WHERE kind = 'purchase';
ALTER TABLE app.commercial_requests ADD CONSTRAINT commercial_requests_plan_check CHECK (plan = 'full-access');
