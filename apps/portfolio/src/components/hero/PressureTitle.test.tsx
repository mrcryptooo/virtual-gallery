import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PressureTitle } from './PressureTitle';

function mockReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? matches : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe('PressureTitle', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes "Seismic Museum" as an accessible heading name', () => {
    mockReducedMotion(false);
    render(<PressureTitle />);
    expect(screen.getByRole('heading', { name: 'Seismic Museum' })).toBeInTheDocument();
  });

  it('renders one decorative span per character, all hidden from assistive tech', () => {
    mockReducedMotion(false);
    const { container } = render(<PressureTitle />);
    const chars = container.querySelectorAll('[data-char]');
    expect(chars).toHaveLength('Seismic Museum'.length);
    chars.forEach((el) => {
      expect(el).toHaveAttribute('aria-hidden', 'true');
    });
  });

  it('does not attach a pointermove listener under prefers-reduced-motion', () => {
    mockReducedMotion(true);
    const addSpy = vi.spyOn(window, 'addEventListener');
    render(<PressureTitle />);
    const pointerMoveCalls = addSpy.mock.calls.filter(([type]) => type === 'pointermove');
    expect(pointerMoveCalls).toHaveLength(0);
  });

  it('applies the revealed class only when the revealed prop is true', () => {
    mockReducedMotion(false);
    const { rerender, container } = render(<PressureTitle revealed={false} />);
    const heading = container.querySelector('h1');
    expect(heading?.className).not.toMatch(/revealed/);

    rerender(<PressureTitle revealed />);
    expect(heading?.className).toMatch(/revealed/);
  });
});
