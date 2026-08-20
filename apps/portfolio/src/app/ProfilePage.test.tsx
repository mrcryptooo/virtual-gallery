import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProfilePage } from './ProfilePage';

const originalFetch = global.fetch;

function mockFetch(routes: Record<string, unknown>) {
  global.fetch = vi.fn((url: string) => {
    const key = Object.keys(routes).find((k) => url.includes(k));
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(key ? routes[key] : {}),
    });
  }) as unknown as typeof fetch;
}

afterEach(() => {
  global.fetch = originalFetch;
});

describe('ProfilePage', () => {
  it('shows a "sign in with X" state when signed out', async () => {
    mockFetch({ '/api/auth/me': { user: null } });
    render(<ProfilePage />);
    await waitFor(() => {
      expect(screen.getByText(/not signed in/i)).toBeInTheDocument();
    });
    // Two "Sign in with X" links exist (SiteHeader's + the page's own CTA)
    // once the header's own fetch resolves -- assert on the page's main
    // content specifically.
    const main = screen.getByRole('heading', { name: /not signed in/i }).closest('main');
    expect(main).not.toBeNull();
    expect(within(main!).getByRole('link', { name: /sign in with x/i })).toHaveAttribute(
      'href',
      expect.stringContaining('/api/auth/login'),
    );
  });

  it("renders the signed-in user's identity, editable fields, and gallery", async () => {
    mockFetch({
      '/api/auth/me': {
        user: {
          id: 'u1',
          xUsername: 'ada',
          displayName: 'Ada Lovelace',
          avatarUrl: null,
          bio: 'Mathematician',
          role: 'user',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      },
      '/api/me/screenshots': {
        screenshots: [
          {
            id: 's1',
            createdAt: '2026-01-02T00:00:00.000Z',
            userId: 'u1',
            projectId: 'modern-museum',
            panoramaId: '0-01',
            media: {
              url: 'https://blob.test/a.png',
              pathname: 'screenshots/media/a.png',
              contentType: 'image/png',
            },
            width: 800,
            height: 600,
            template: null,
            viewport: null,
          },
        ],
      },
    });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument();
    });
    expect(screen.getByText('@ada')).toBeInTheDocument();
    // Populating the form fields from currentUser happens in its own
    // effect, a separate render pass from the heading above -- wait for
    // it explicitly rather than assuming it lands in the same tick.
    await waitFor(() => {
      expect(screen.getByLabelText(/display name/i)).toHaveValue('Ada Lovelace');
    });
    expect(screen.getByLabelText(/bio/i)).toHaveValue('Mathematician');

    await waitFor(() => {
      expect(screen.getByAltText(/scene 0-01/i)).toBeInTheDocument();
    });
  });
});
