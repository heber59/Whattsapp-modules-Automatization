import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../shared/database/database.service';

@Injectable()
export class CommercialRepository {
  constructor(private readonly database: DatabaseService) {}

  async create(input: { email?: string; phone?: string; name?: string; message?: string }, subject: string | null, plan: string | null) {
    await this.database.query(
      `INSERT INTO app.commercial_requests (auth_user_id, email, phone, name, message, plan, kind)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [subject, input.email ?? null, input.phone ?? null, input.name ?? null, input.message ?? null, plan, plan ? 'purchase' : 'contact'],
    );
  }
}
