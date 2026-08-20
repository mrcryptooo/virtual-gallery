import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SiteHeader } from './SiteHeader';

const originalFetch = global.fetch;

function mockMe(user: unknown) {
  global.fetch = vi.fn(() =>
    Promise.resolve({ json: () => Promise.resolve({ user }) }),
  ) as unknown as typeof fetch;
}

afterEach(() => {
  global.fetch = originalFetch;
});

describe('SiteHeader', () => {
  it('renders the wordmark and the Museum / Competition / Submit Your Art nav', async () => {
    mockMe(null);
    render(<SiteHeader />);
    expect(screen.getByRole('link', { name: 'Seismic Museum' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Museum' })).toHaveAttribute(
      'href',
      '/p/modern-museum',
    );
    expect(screen.getByRole('link', { name: 'Competition' })).toHaveAttribute(
      'href',
      '/competition',
    );
    expect(screen.getByRole('link', { name: 'Submit Your Art' })).toHaveAttribute(
      'href',
      '/submit',
    );
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Sign in with X/i })).toBeInTheDocument();
    });
  });

  it('renders trailing content (the sound toggle) alongside the nav', async () => {
    mockMe(null);
    render(<SiteHeader trailing={<button type="button">Mute</button>} />);
    expect(screen.getAllByRole('button', { name: 'Mute' }).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Sign in with X/i })).toBeInTheDocument();
    });
  });

  it('shows "Sign in with X" (not a profile link) when signed out', async () => {
    mockMe(null);
    render(<SiteHeader />);
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Sign in with X/i })).toHaveAttribute(
        'href',
        expect.stringContaining('/api/auth/login'),
      );
    });
    expect(screen.queryByRole('link', { name: /^Ada/ })).not.toBeInTheDocument();
  });

  it('shows the profile entry (display name, linking to /profile) when signed in', async () => {
    mockMe({
      id: 'u1',
      xUsername: 'ada',
      displayName: 'Ada Lovelace',
      avatarUrl: null,
      bio: null,
      role: 'user',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    render(<SiteHeader />);
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Ada Lovelace/ })).toHaveAttribute(
        'href',
        '/profile',
      );
    });
    expect(screen.queryByRole('link', { name: /Sign in with X/i })).not.toBeInTheDocument();
  });
});
