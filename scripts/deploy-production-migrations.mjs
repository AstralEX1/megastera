import { spawnSync } from 'node:child_process';

if (process.env.VERCEL_ENV === 'production') {
  const result = spawnSync('pnpm', ['db:migrate:deploy'], { stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
}
