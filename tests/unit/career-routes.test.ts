import { describe, expect, it } from 'vitest';
import { routeDecision } from '@/lib/auth/route-rules';

describe('route protection for Career Intelligence', () => {
  it('sends signed-out visitors to login and back afterwards', () => {
    for (const pathname of ['/career-intelligence', '/career-intelligence/', '/mobile/profile']) {
      const d = routeDecision({ pathname, signedIn: false });
      expect(d).toEqual({ type: 'redirect', to: `/login?next=${encodeURIComponent(pathname)}` });
    }
  });

  it('lets signed-in users through, and leaves public pages alone', () => {
    expect(routeDecision({ pathname: '/career-intelligence', signedIn: true })).toEqual({ type: 'next' });
    for (const pathname of ['/', '/companies', '/tracker', '/mobile', '/reports']) expect(routeDecision({ pathname, signedIn: false })).toEqual({ type: 'next' });
  });
});
