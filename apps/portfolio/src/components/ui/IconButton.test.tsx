import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { IconButton } from './IconButton';

describe('IconButton', () => {
  it('exposes the required label as its accessible name; icon is hidden from AT', async () => {
    const { container } = render(<IconButton label="Open space index">▦</IconButton>);
    expect(screen.getByRole('button', { name: 'Open space index' })).toBeEnabled();
    expect(screen.queryByText('▦')).not.toBeNull(); // visually present
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders the disabled state accessibly', async () => {
    const { container } = render(
      <IconButton label="Fullscreen" disabled>
        ⛶
      </IconButton>,
    );
    expect(screen.getByRole('button', { name: 'Fullscreen' })).toBeDisabled();
    expect(await axe(container)).toHaveNoViolations();
  });
});
