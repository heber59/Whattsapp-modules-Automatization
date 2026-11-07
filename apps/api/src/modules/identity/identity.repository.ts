import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../shared/database/database.service';
import type { Principal } from '../../shared/auth/auth.types';

export interface Identity {
  id: string;
  auth_user_id: string;
  email: string | null;
}

@Injectable()
export class IdentityRepository {
  constructor(private readonly database: DatabaseService) {}

  async sync(user: Principal): Promise<Identity> {
    const result = await this.database.query<Identity>(`
      INSERT INTO app.users(auth_user_id, email) VALUES ($1, $2)
      ON CONFLICT (auth_user_id) DO UPDATE SET email = EXCLUDED.email
      RETURNING id, auth_user_id, email
    `, [user.subject, user.email]);
    return result.rows[0]!;
  }
}
