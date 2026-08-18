import { describe, expect, it } from 'vitest';
import { navPath, parseAppRoute } from './appRoute';

describe('app routes', () => {
  it('uses /my-planets as the canonical collection route while accepting /planets', () => {
    expect(parseAppRoute('/my-planets')).toEqual({ active: 'planets' });
    expect(parseAppRoute('/planets')).toEqual({ active: 'planets' });
    expect(navPath('planets')).toBe('/my-planets');
  });

  it('parses a backend Planet detail route', () => {
    expect(parseAppRoute('/planet/planet-42')).toEqual({ active: 'planets', planetId: 'planet-42' });
    expect(parseAppRoute('/planet/not/a-planet')).toEqual({ active: 'home' });
  });

  it('maps the visible primary navigation to stable paths', () => {
    expect(navPath('play')).toBe('/play');
    expect(parseAppRoute('/tickets')).toEqual({ active: 'tickets' });
    expect(navPath('tickets')).toBe('/tickets');
    expect(navPath('history')).toBe('/leaderboard');
    expect(parseAppRoute('/coming-soon')).toEqual({ active: 'comingSoon' });
    expect(navPath('comingSoon')).toBe('/coming-soon');
    expect(navPath('home')).toBe('/');
  });
});
