import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { AdminPage } from './AdminPage';

const originalFetch = global.fetch;

function mockFetch(routes: Record<string, unknown>) {
  global.fetch = vi.fn((url: string) => {
    const key = Object.keys(routes).find((k) => url.includes(k));
    const value = key ? routes[key] : { status: 404 };
    const status = (value as { status?: number }).status ?? 200;
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(value),
    });
  }) as unknown as typeof fetch;
}

afterEach(() => {
  global.fetch = originalFetch;
});

describe('AdminPage', () => {
  it('prompts sign-in for an unauthenticated visitor (never shows admin data)', async () => {
    mockFetch({ '/api/auth/me': { user: null } });
    render(<AdminPage />);
    await waitFor(() => {
      const main = document.querySelector('main');
      expect(
        within(main as HTMLElement).getByText(/sign in with an admin account/i),
      ).toBeInTheDocument();
    });
  });

  it('rejects an authenticated non-admin (client-side gate agrees with what the server would say)', async () => {
    mockFetch({
      '/api/auth/me': {
        user: {
          id: 'u1',
          xUsername: 'ada',
          displayName: 'Ada',
          avatarUrl: null,
          bio: null,
          role: 'user',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      },
    });
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText(/does not have admin access/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('shows the tabbed dashboard for an admin and lists users from the real admin API', async () => {
    mockFetch({
      '/api/auth/me': {
        user: {
          id: 'admin-1',
          xUsername: 'root',
          displayName: 'Root Admin',
          avatarUrl: null,
          bio: null,
          role: 'admin',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      },
      '/api/admin/users': {
        users: [
          {
            id: 'u1',
            x_username: 'ada',
            display_name: 'Ada',
            role: 'user',
            created_at: '2026-01-01T00:00:00.000Z',
          },
        ],
        count: 1,
      },
    });
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Users' })).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText('Ada')).toBeInTheDocument();
    });
    expect(screen.getByText(/@ada/)).toBeInTheDocument();
  });

  it('shows screenshot stats, a thumbnail grid, and a lightbox on click', async () => {
    mockFetch({
      '/api/auth/me': {
        user: {
          id: 'admin-1',
          xUsername: 'root',
          displayName: 'Root Admin',
          avatarUrl: null,
          bio: null,
          role: 'admin',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      },
      '/api/admin/screenshots': {
        records: [
          {
            id: 's1',
            createdAt: '2026-08-21T09:00:00.000Z',
            userId: 'u1',
            projectId: 'modern-museum',
            panoramaId: '5-06',
            panoramaTitle: '5.06',
            media: {
              url: 'https://blob.test/shot.png',
              pathname: 'screenshots/media/shot.png',
              contentType: 'image/png',
            },
            width: 1920,
            height: 1080,
            template: 'template-4',
            viewport: null,
          },
        ],
        count: 1,
      },
    });
    const { container } = render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Users' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Screenshots' }));

    await waitFor(() => {
      expect(screen.getByAltText(/captured artwork: 5\.06/i)).toBeInTheDocument();
    });
    expect(screen.getByText('Total captured')).toBeInTheDocument();
    expect(screen.getAllByText('1')).toHaveLength(2); // total + the one per-day count
    expect(screen.getByText(/template-4/)).toBeInTheDocument();

    fireEvent.click(screen.getByAltText(/captured artwork: 5\.06/i).closest('button')!);

    await waitFor(() => {
      expect(screen.getAllByAltText(/captured artwork: 5\.06/i).length).toBeGreaterThan(1);
    });
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('surfaces a 401/403 from the admin API as "not authorized" rather than crashing', async () => {
    mockFetch({
      '/api/auth/me': {
        user: {
          id: 'admin-1',
          xUsername: 'root',
          displayName: 'Root Admin',
          avatarUrl: null,
          bio: null,
          role: 'admin',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      },
      '/api/admin/users': { status: 403, error: 'Forbidden' },
    });
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText(/not authorized to view this/i)).toBeInTheDocument();
    });
  });
});
