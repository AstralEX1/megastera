import { describe, expect, it } from 'vitest';
import { createPostgresPoolConfig } from './database.js';

describe('serverless Postgres pool configuration', () => {
  it('limits every Vercel function instance to one database connection', () => {
    expect(createPostgresPoolConfig('postgresql://example.test/database')).toEqual({
      connectionString: 'postgresql://example.test/database',
      max: 1,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 10_000,
    });
  });

  it('rejects an empty database URL before creating a pool', () => {
    expect(() => createPostgresPoolConfig('  ')).toThrow('DATABASE_URL is required.');
  });

  it('uses libpq-compatible TLS semantics for sslmode=require URLs', () => {
    expect(
      createPostgresPoolConfig(
        'postgresql://user:password@region.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require',
      ).connectionString,
    ).toBe(
      'postgresql://user:password@region.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require&uselibpqcompat=true',
    );
  });
});
