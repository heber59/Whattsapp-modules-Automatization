import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Pool, PoolClient } from 'pg';
import { validateEnvironment } from '../config/config';

export async function migrate(connectionString: string): Promise<void> {
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 3000 });
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query("SELECT pg_advisory_lock(hashtext('wa:schema-migrations'))");
    await client.query(`CREATE SCHEMA IF NOT EXISTS app;
      REVOKE ALL ON SCHEMA app FROM PUBLIC;
      CREATE TABLE IF NOT EXISTS app.schema_migrations (
        version text PRIMARY KEY, checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);
    const directory = path.resolve(__dirname, '../../../migrations');
    for (const version of readdirSync(directory).filter((file) => /^\d+.*\.sql$/.test(file)).sort()) {
      const sql = readFileSync(path.join(directory, version), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const existing = await client.query<{ checksum: string }>(
        'SELECT checksum FROM app.schema_migrations WHERE version = $1', [version],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== checksum) throw new Error('Migración aplicada fue modificada: ' + version);
        continue;
      }
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO app.schema_migrations(version, checksum) VALUES ($1, $2)', [version, checksum]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    try {
      if (client) {
        try { await client.query("SELECT pg_advisory_unlock(hashtext('wa:schema-migrations'))"); }
        finally { client.release(); }
      }
    } finally { await pool.end(); }
  }
}

if (require.main === module) {
  for (const file of ['.env', '../../.env']) if (existsSync(file)) process.loadEnvFile(file);
  void (async () => {
    const config = validateEnvironment(process.env);
    await migrate(config.DATABASE_URL);
    console.log('Migraciones al día');
  })().catch(() => {
    console.error('No se aplicaron las migraciones. Revisa conexión, permisos e historial.');
    process.exitCode = 1;
  });
}
