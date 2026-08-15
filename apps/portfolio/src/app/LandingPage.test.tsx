import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LandingPage } from './LandingPage';

describe('LandingPage (production landing route)', () => {
  it('renders the background field, identity block, stone hero, tagline, and CTA', () => {
    const { container } = render(<LandingPage />);

    expect(container.querySelector('[class*="background"]')).toBeTruthy();

    expect(screen.getByText('Seismic Museum')).toBeInTheDocument();
    expect(screen.getByText(/Stone \/ #51343B/i)).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Enter the Seismic Museum' })).toBeInTheDocument();

    expect(screen.getByText('The Community Is the Legacy')).toBeInTheDocument();

    const cta = screen.getByRole('link', { name: /Enter the Museum/i });
    expect(cta).toHaveAttribute('href', '/p/modern-museum');
  });

  it('renders the reference video as a silent, non-autoplaying, controls-free scrub target', () => {
    const { container } = render(<LandingPage />);
    const video = container.querySelector('video');
    expect(video).toBeTruthy();
    expect(video).toHaveAttribute('src', '/hero/seismic-stone.mp4');
    expect(video).toHaveProperty('muted', true);
    expect(video).toHaveAttribute('playsinline');
    expect(video).not.toHaveAttribute('controls');
    expect(video).not.toHaveAttribute('autoplay');
    expect(video).not.toHaveAttribute('loop');
  });
});
