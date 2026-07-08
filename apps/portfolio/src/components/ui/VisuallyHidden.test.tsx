import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { VisuallyHidden } from './VisuallyHidden';

describe('VisuallyHidden', () => {
  it('keeps content in the accessibility tree', async () => {
    const { container } = render(
      <button type="button">
        <VisuallyHidden>Close panel</VisuallyHidden>
      </button>,
    );
    expect(screen.getByRole('button', { name: 'Close panel' })).toBeEnabled();
    expect(await axe(container)).toHaveNoViolations();
  });
});
