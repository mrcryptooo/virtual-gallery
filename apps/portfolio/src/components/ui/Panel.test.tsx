import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { Panel } from './Panel';

describe('Panel', () => {
  it('renders children on a surface', async () => {
    const { container } = render(<Panel>Scene details</Panel>);
    expect(screen.getByText('Scene details')).toBeVisible();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('supports the raised overlay variant', async () => {
    const { container } = render(<Panel raised>Dialog content</Panel>);
    expect(screen.getByText('Dialog content')).toBeVisible();
    expect(await axe(container)).toHaveNoViolations();
  });
});
