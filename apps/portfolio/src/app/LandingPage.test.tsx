import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LandingPage } from './LandingPage';

describe('LandingPage (production landing route)', () => {
  it('renders the fallback field, identity block, stone hero, and CTA', () => {
    const { container } = render(<LandingPage />);

    expect(container.querySelector('[class*="field"]')).toBeTruthy();

    // "Seismic Museum" appears twice: the SiteHeader wordmark (a link) and
    // the PressureTitle hero title (a heading whose accessible name comes
    // from aria-label, since its visible text is split into per-letter
    // spans for the mouse-interaction effect) -- assert each distinctly.
    expect(screen.getByRole('link', { name: 'Seismic Museum' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Seismic Museum' })).toBeInTheDocument();
    expect(screen.queryByText(/#[0-9a-f]{6}/i)).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Enter the Seismic Museum' })).toBeInTheDocument();

    expect(screen.getByText('Private Patronage. Public Art.')).toBeInTheDocument();
    expect(screen.getByText(/confidential art patronage/i)).toBeInTheDocument();

    const cta = screen.getByRole('link', { name: /Enter the Museum/i });
    expect(cta).toHaveAttribute('href', '/p/modern-museum');
  });

  it('renders the reference video as a silent, non-autoplaying, controls-free full-bleed layer', () => {
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
