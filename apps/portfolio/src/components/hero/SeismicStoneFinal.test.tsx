import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { SeismicStoneFinal } from './SeismicStoneFinal';

// jsdom has no matchMedia, no real WebGL context, and no real navigation --
// all three are stubbed here, scoped to this file only.
function mockMatchMedia(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduced && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function mockLocationAssign(): ReturnType<typeof vi.fn> {
  const assignSpy = vi.fn();
  // Only `assign` is exercised by the component; a minimal stub avoids
  // spreading the Location class instance (which loses its prototype).
  vi.stubGlobal('location', { assign: assignSpy } as unknown as Location);
  return assignSpy;
}

describe('SeismicStoneFinal', () => {
  beforeEach(() => {
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders an accessible, keyboard-activatable entrance control even without WebGL', async () => {
    const { container } = render(<SeismicStoneFinal />);
    const button = screen.getByRole('button', { name: 'Enter the Seismic Museum' });
    expect(button).toBeVisible();
    expect(button.dataset['webgl']).toBe('unavailable');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders all 13 primary pieces plus 14 debris pieces', () => {
    render(<SeismicStoneFinal />);
    const button = screen.getByRole('button', { name: 'Enter the Seismic Museum' });
    expect(button.dataset['pieceCount']).toBe('27');
  });

  it('accepts a custom accessible label', () => {
    render(<SeismicStoneFinal label="Custom label" />);
    expect(screen.getByRole('button', { name: 'Custom label' })).toBeVisible();
  });

  it('opens on pointer enter and closes on pointer leave', () => {
    render(<SeismicStoneFinal />);
    const button = screen.getByRole('button', { name: 'Enter the Seismic Museum' });
    expect(button.dataset['state']).toBe('idle');
    fireEvent.pointerEnter(button);
    expect(button.dataset['state']).toBe('open');
    fireEvent.pointerLeave(button);
    expect(button.dataset['state']).toBe('idle');
  });

  it('plays the entering preview on click and navigates to the museum route', () => {
    vi.useFakeTimers();
    const assignSpy = mockLocationAssign();
    render(<SeismicStoneFinal />);
    const button = screen.getByRole('button', { name: 'Enter the Seismic Museum' });

    fireEvent.click(button);
    expect(button.dataset['state']).toBe('entering');
    expect(assignSpy).not.toHaveBeenCalled();

    act(() => {
      vi.runAllTimers();
    });
    expect(assignSpy).toHaveBeenCalledWith('/p/modern-museum');
    vi.useRealTimers();
  });

  it('navigates to a custom href when provided', () => {
    vi.useFakeTimers();
    const assignSpy = mockLocationAssign();
    render(<SeismicStoneFinal href="/custom-route" />);
    fireEvent.click(screen.getByRole('button', { name: 'Enter the Seismic Museum' }));
    act(() => {
      vi.runAllTimers();
    });
    expect(assignSpy).toHaveBeenCalledWith('/custom-route');
    vi.useRealTimers();
  });

  it('activates on Enter and Space from the keyboard', () => {
    vi.useFakeTimers();
    const assignSpy = mockLocationAssign();
    render(<SeismicStoneFinal />);
    const button = screen.getByRole('button', { name: 'Enter the Seismic Museum' });

    fireEvent.keyDown(button, { key: 'Enter' });
    expect(button.dataset['state']).toBe('entering');
    act(() => {
      vi.runAllTimers();
    });
    expect(assignSpy).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('does not error when prefers-reduced-motion is set, and still activates', () => {
    mockMatchMedia(true);
    vi.useFakeTimers();
    const assignSpy = mockLocationAssign();
    render(<SeismicStoneFinal />);
    const button = screen.getByRole('button', { name: 'Enter the Seismic Museum' });

    fireEvent.pointerEnter(button);
    fireEvent.click(button);
    act(() => {
      vi.runAllTimers();
    });
    expect(assignSpy).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('unmounts cleanly without throwing (disposes the render loop)', () => {
    const { unmount } = render(<SeismicStoneFinal />);
    expect(() => {
      unmount();
    }).not.toThrow();
  });
});
