import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { Scrim } from './Scrim';

describe('Scrim', () => {
  it('is hidden from assistive tech and dismisses on click', async () => {
    const onDismiss = vi.fn();
    const { container } = render(<Scrim onDismiss={onDismiss} />);
    const scrim = container.firstElementChild as HTMLElement;
    expect(scrim.getAttribute('aria-hidden')).toBe('true');
    scrim.click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(await axe(container)).toHaveNoViolations();
  });
});
