import { describe, expect, it } from 'vitest';
import { classifyBackendError, sanitizeBackendErrorMessage } from './errorDiagnostics.js';

describe('backend error diagnostics', () => {
  it('recognizes missing server configuration', () => {
    expect(classifyBackendError(new Error('Missing required server environment variable DATABASE_URL.'))).toBe(
      'configuration',
    );
  });

  it('recognizes Prisma schema failures', () => {
    expect(classifyBackendError({ code: 'P2021', message: 'The table backend_planets does not exist.' })).toBe(
      'schema',
    );
  });

  it('recognizes database connection failures', () => {
    expect(classifyBackendError({ code: 'P1001', message: "Can't reach database server" })).toBe(
      'connection',
    );
  });

  it('does not expose credentials from a connection string in diagnostics', () => {
    expect(
      sanitizeBackendErrorMessage(
        'connect failed for postgresql://user:secret-password@example.supabase.co:5432/postgres',
      ),
    ).toBe('connect failed for postgresql://[redacted]@example.supabase.co:5432/postgres');
  });

  it('falls back to runtime for an unclassified error', () => {
    expect(classifyBackendError(new Error('unexpected failure'))).toBe('runtime');
  });
});
