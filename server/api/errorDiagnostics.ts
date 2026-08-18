export type BackendErrorCategory = 'configuration' | 'connection' | 'schema' | 'runtime';

type ErrorDetails = {
  code?: string;
  message: string;
  name: string;
};

function readErrorDetails(error: unknown): ErrorDetails {
  if (error instanceof Error) {
    const code =
      typeof (error as Error & { code?: unknown }).code === 'string'
        ? (error as Error & { code: string }).code
        : undefined;
    return { code, message: error.message, name: error.name };
  }
  if (typeof error === 'string') return { message: error, name: 'Error' };
  if (error && typeof error === 'object') {
    const candidate = error as { code?: unknown; message?: unknown; name?: unknown };
    return {
      code: typeof candidate.code === 'string' ? candidate.code : undefined,
      message: typeof candidate.message === 'string' ? candidate.message : String(error),
      name: typeof candidate.name === 'string' ? candidate.name : 'UnknownError',
    };
  }
  return { message: String(error), name: 'UnknownError' };
}

export function sanitizeBackendErrorMessage(message: string): string {
  return message
    .replace(/([a-z][a-z\d+.-]*:\/\/)[^\s@]+@/gi, '$1[redacted]@')
    .replace(/(DATABASE_URL\s*[=:]\s*)\S+/gi, '$1[redacted]')
    .slice(0, 320);
}

export function classifyBackendError(error: unknown): BackendErrorCategory {
  const details = readErrorDetails(error);
  const code = details.code?.toUpperCase();
  const message = details.message.toLowerCase();

  if (
    message.includes('missing required server environment variable') ||
    message.includes('database_url is required') ||
    message.includes('base_rpc_url is required')
  ) {
    return 'configuration';
  }

  if (
    code === 'P2021' ||
    code === 'P2022' ||
    code === 'P2023' ||
    message.includes('relation') && message.includes('does not exist') ||
    message.includes('table') && message.includes('does not exist') ||
    message.includes('column') && message.includes('does not exist')
  ) {
    return 'schema';
  }

  if (
    code === 'P1000' ||
    code === 'P1001' ||
    code === 'P1002' ||
    code === 'P1008' ||
    code === 'P1010' ||
    code === 'P1017' ||
    code === 'P2024' ||
    /econn(refused|reset)|enotfound|connection|connect timeout|timed out|ssl|certificate|socket/.test(message)
  ) {
    return 'connection';
  }

  return 'runtime';
}

export function reportBackendError(route: string, error: unknown): Record<string, string> {
  const details = readErrorDetails(error);
  const category = classifyBackendError(error);
  process.stderr.write(
    `${JSON.stringify({
      service: 'megastera-api',
      level: 'error',
      route,
      category,
      errorName: details.name,
      errorCode: details.code ?? null,
      message: sanitizeBackendErrorMessage(details.message),
    })}\n`,
  );
  return { 'x-megastera-error-category': category };
}
