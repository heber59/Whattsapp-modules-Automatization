import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../shared/database/database.service';

export interface Business {
  id: string;
  name: string;
  role: 'owner' | 'admin' | 'operator';
}

@Injectable()
export class BusinessesRepository {
  constructor(private readonly database: DatabaseService) {}

  async create(userId: string, name: string): Promise<Business> {
    return this.database.transaction(async (client) => {
      const result = await client.query<{ id: string; name: string }>(
        'INSERT INTO app.businesses(name, created_by) VALUES ($1, $2) RETURNING id, name', [name, userId],
      );
      const business = result.rows[0]!;
      await client.query("INSERT INTO app.memberships(business_id, user_id, role) VALUES ($1, $2, 'owner')",
        [business.id, userId]);
      return { ...business, role: 'owner' };
    });
  }

  async list(userId: string): Promise<Business[]> {
    const result = await this.database.query<Business>(`
      SELECT b.id, b.name, m.role FROM app.businesses b
      JOIN app.memberships m ON m.business_id = b.id
      WHERE m.user_id = $1 ORDER BY b.created_at, b.id
    `, [userId]);
    return result.rows;
  }

  async find(userId: string, businessId: string): Promise<Business | undefined> {
    const result = await this.database.query<Business>(`
      SELECT b.id, b.name, m.role FROM app.businesses b
      JOIN app.memberships m ON m.business_id = b.id
      WHERE m.user_id = $1 AND b.id = $2
    `, [userId, businessId]);
    return result.rows[0];
  }
}
