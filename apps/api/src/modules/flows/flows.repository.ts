import { Injectable } from '@nestjs/common';
import type { FlowDetail, FlowStep, FlowSummary, PublishedFlowVersion } from '@wa/contracts';
import { DatabaseService } from '../../shared/database/database.service';

const fields = `f.id, f.business_id AS "businessId", f.name, f.revision, f.updated_at AS "updatedAt",
  (SELECT max(v.version) FROM app.flow_versions v WHERE v.business_id=f.business_id AND v.flow_id=f.id) AS "publishedVersion",
  (SELECT max(v.source_revision) FROM app.flow_versions v WHERE v.business_id=f.business_id AND v.flow_id=f.id) AS "publishedRevision"`;
const versionFields = `flow_id AS "flowId", business_id AS "businessId", version,
  source_revision AS "sourceRevision", name, steps, published_at AS "publishedAt"`;

@Injectable()
export class FlowsRepository {
  constructor(private readonly database: DatabaseService) {}

  async list(businessId: string): Promise<FlowSummary[]> {
    return (await this.database.query<FlowSummary>(`SELECT ${fields} FROM app.flows f WHERE f.business_id=$1 ORDER BY f.created_at,f.id`, [businessId])).rows;
  }

  async find(businessId: string, flowId: string): Promise<FlowDetail | undefined> {
    return (await this.database.query<FlowDetail>(`SELECT ${fields}, f.steps FROM app.flows f WHERE f.business_id=$1 AND f.id=$2`, [businessId, flowId])).rows[0];
  }

  async create(businessId: string, name: string, steps: FlowStep[]): Promise<FlowDetail> {
    const result = await this.database.query<{ id: string }>('INSERT INTO app.flows(business_id,name,steps) VALUES($1,$2,$3::jsonb) RETURNING id', [businessId, name, JSON.stringify(steps)]);
    return (await this.find(businessId, result.rows[0]!.id))!;
  }

  async save(businessId: string, flowId: string, revision: number, name: string, steps: FlowStep[]): Promise<FlowDetail | undefined> {
    return this.database.transaction(async (client) => {
      const result = await client.query(`UPDATE app.flows SET name=$4,steps=$5::jsonb,revision=revision+1,updated_at=now()
        WHERE business_id=$1 AND id=$2 AND revision=$3 RETURNING id`, [businessId, flowId, revision, name, JSON.stringify(steps)]);
      if (!result.rowCount) return undefined;
      return (await client.query<FlowDetail>(`SELECT ${fields}, f.steps FROM app.flows f WHERE f.business_id=$1 AND f.id=$2`, [businessId, flowId])).rows[0];
    });
  }

  async version(businessId: string, flowId: string, version: number): Promise<PublishedFlowVersion | undefined> {
    return (await this.database.query<PublishedFlowVersion>(`SELECT ${versionFields} FROM app.flow_versions WHERE business_id=$1 AND flow_id=$2 AND version=$3`, [businessId, flowId, version])).rows[0];
  }

  async publish(businessId: string, flowId: string, revision: number, validate: (steps: FlowStep[]) => void): Promise<PublishedFlowVersion | undefined> {
    return this.database.transaction(async (client) => {
      const locked = await client.query<{ revision: number; name: string; steps: FlowStep[] }>(
        'SELECT revision,name,steps FROM app.flows WHERE business_id=$1 AND id=$2 FOR UPDATE', [businessId, flowId]);
      const flow = locked.rows[0];
      if (!flow) return undefined;
      // Return the immutable prior publication when a caller retries a completed request.
      const existing = await client.query<PublishedFlowVersion>(`SELECT ${versionFields} FROM app.flow_versions WHERE business_id=$1 AND flow_id=$2 AND source_revision=$3`, [businessId, flowId, revision]);
      if (existing.rows[0]) return existing.rows[0];
      if (flow.revision !== revision) return undefined;
      validate(flow.steps);
      const result = await client.query<PublishedFlowVersion>(`INSERT INTO app.flow_versions(business_id,flow_id,version,source_revision,name,steps)
        SELECT $1,$2,COALESCE(max(version),0)+1,$3,$4,$5::jsonb FROM app.flow_versions WHERE business_id=$1 AND flow_id=$2
        RETURNING ${versionFields}`, [businessId, flowId, revision, flow.name, JSON.stringify(flow.steps)]);
      return result.rows[0];
    });
  }
}
