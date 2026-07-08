import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { Toast } from './Toast';

describe('Toast', () => {
  it('announces politely via role=status', async () => {
    const { container } = render(<Toast>Link copied</Toast>);
    expect(screen.getByRole('status')).toHaveTextContent('Link copied');
    expect(await axe(container)).toHaveNoViolations();
  });
});
