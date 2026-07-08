import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { Button } from './Button';

describe('Button', () => {
  it.each(['primary', 'ghost', 'quiet'] as const)('renders the %s variant', async (variant) => {
    const { container } = render(<Button variant={variant}>Enter walkthrough</Button>);
    expect(screen.getByRole('button', { name: 'Enter walkthrough' })).toBeEnabled();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('disables interaction and keeps its accessible name while loading', async () => {
    const onClick = vi.fn();
    const { container } = render(
      <Button loading onClick={onClick}>
        Share
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Share' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders the disabled state accessibly', async () => {
    const { container } = render(<Button disabled>Fullscreen</Button>);
    expect(screen.getByRole('button', { name: 'Fullscreen' })).toBeDisabled();
    expect(await axe(container)).toHaveNoViolations();
  });
});
