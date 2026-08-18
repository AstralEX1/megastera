import type { NavKey } from '@/components/layout/Nav';

export type AppRoute = { active: NavKey; planetId?: string };

export function parseAppRoute(pathname: string): AppRoute {
  if (pathname === '/play') return { active: 'play' };
  if (pathname === '/my-planets' || pathname === '/planets') return { active: 'planets' };
  if (pathname === '/leaderboard') return { active: 'history' };
  if (pathname === '/coming-soon') return { active: 'comingSoon' };
  if (pathname === '/tickets') return { active: 'tickets' };
  if (pathname === '/lab') return { active: 'lab' };
  const planetMatch = pathname.match(/^\/planet\/([A-Za-z0-9-]+)$/);
  if (planetMatch?.[1]) return { active: 'planets', planetId: planetMatch[1] };
  return { active: 'home' };
}

export function navPath(key: NavKey) {
  switch (key) {
    case 'play': return '/play';
    case 'planets': return '/my-planets';
    case 'history': return '/leaderboard';
    case 'comingSoon': return '/coming-soon';
    case 'tickets': return '/tickets';
    case 'lab': return '/lab';
    case 'home': return '/';
  }
}
