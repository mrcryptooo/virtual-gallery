import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LandingPage } from './LandingPage';

describe('LandingPage (production landing route)', () => {
  it('renders a background layer and reserves the stone hero footprint while it lazy-loads', () => {
    const { container } = render(<LandingPage />);
    expect(container.querySelector('[class*="background"]')).toBeTruthy();
    // The Hero chunk resolves asynchronously; before it does, the Suspense
    // fallback must already occupy the exact footprint SeismicStoneFinal's
    // own .stage box uses, so there is no layout shift once it mounts.
    const placeholder = container.querySelector('[class*="stonePlaceholder"]');
    expect(placeholder).toBeTruthy();
  });
});
