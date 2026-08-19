import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CompetitionPage } from './CompetitionPage';

describe('CompetitionPage', () => {
  it('renders an honest coming-soon state with no invented dates/prizes/sponsors', () => {
    render(<CompetitionPage />);
    expect(screen.getByRole('heading', { name: 'Competitions' })).toBeInTheDocument();
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to the entrance/i })).toHaveAttribute(
      'href',
      '/',
    );
  });
});
