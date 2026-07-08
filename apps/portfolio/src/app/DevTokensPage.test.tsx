import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { DevTokensPage } from './DevTokensPage';

describe('DevTokensPage (M0.3 showcase)', () => {
  it('renders every token section and passes axe', async () => {
    const { container } = render(<DevTokensPage />);
    for (const section of ['Color', 'Typography', 'Motion']) {
      expect(screen.getByRole('heading', { name: new RegExp(section) })).toBeVisible();
    }
    expect(screen.getByRole('heading', { name: /interaction states/i })).toBeVisible();
    expect(await axe(container)).toHaveNoViolations();
  });
});
