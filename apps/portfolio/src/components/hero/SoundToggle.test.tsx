import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SoundToggle } from './SoundToggle';

describe('SoundToggle', () => {
  it('labels itself by the action it performs, not the current state', () => {
    const { rerender } = render(<SoundToggle enabled={true} onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Mute sound' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    rerender(<SoundToggle enabled={false} onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Unmute sound' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('calls onToggle with the flipped value on click', () => {
    const onToggle = vi.fn();
    render(<SoundToggle enabled={true} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mute sound' }));
    expect(onToggle).toHaveBeenCalledWith(false);
  });
});
