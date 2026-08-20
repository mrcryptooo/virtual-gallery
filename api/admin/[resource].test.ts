import { describe, expect, it } from 'vitest';

const { GET: handler } = await import('./[resource].js');

describe('GET /api/admin/[resource]', () => {
  it('dispatches "users" to handleUsers (401 with no session, proving it was reached)', async () => {
    const res = await handler(new Request('https://seismic-museum.vercel.app/api/admin/users'));
    expect(res.status).toBe(401);
  });

  it('dispatches "submissions" to handleSubmissions (401 with no session)', async () => {
    const res = await handler(
      new Request('https://seismic-museum.vercel.app/api/admin/submissions'),
    );
    expect(res.status).toBe(401);
  });

  it('dispatches "screenshots" to handleScreenshots (401 with no session)', async () => {
    const res = await handler(
      new Request('https://seismic-museum.vercel.app/api/admin/screenshots'),
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 for an unrecognized resource', async () => {
    const res = await handler(
      new Request('https://seismic-museum.vercel.app/api/admin/not-a-real-resource'),
    );
    expect(res.status).toBe(404);
  });
});
