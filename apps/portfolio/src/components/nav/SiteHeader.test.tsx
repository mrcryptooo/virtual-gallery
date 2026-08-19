import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SiteHeader } from './SiteHeader';

describe('SiteHeader', () => {
  it('renders the wordmark and the Museum / Competition / Submit Your Art nav', () => {
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
  });

  it('renders trailing content (the sound toggle) alongside the nav', () => {
    render(<SiteHeader trailing={<button type="button">Mute</button>} />);
    expect(screen.getAllByRole('button', { name: 'Mute' }).length).toBeGreaterThan(0);
  });
});
