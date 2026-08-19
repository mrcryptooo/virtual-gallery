import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SubmitArtPage } from './SubmitArtPage';

describe('SubmitArtPage', () => {
  it('renders the required fields, the 3-file cap, and the consent checkbox', () => {
    render(<SubmitArtPage />);
    expect(screen.getByLabelText(/Artist \/ Display Name/)).toBeRequired();
    expect(screen.getByLabelText(/^Email/)).toBeRequired();
    expect(screen.getByLabelText(/Artwork Title/)).toBeRequired();
    expect(screen.getByLabelText(/Short Description/)).toBeRequired();
    expect(screen.getByText('0/3')).toBeInTheDocument();
    expect(screen.getByText(/does not guarantee display in the museum/i)).toBeInTheDocument();
  });

  it('blocks submission without a file or without consent', async () => {
    render(<SubmitArtPage />);
    fireEvent.change(screen.getByLabelText(/Artist \/ Display Name/), {
      target: { value: 'Ada' },
    });
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'ada@example.com' } });
    fireEvent.change(screen.getByLabelText(/Artwork Title/), { target: { value: 'Fault Line' } });
    fireEvent.change(screen.getByLabelText(/Short Description/), {
      target: { value: 'A study in tension.' },
    });

    // jsdom doesn't cascade a submit-button click into the form's submit
    // event on its own -- fire the submit directly, same effective path.
    fireEvent.submit(screen.getByRole('button', { name: 'Submit Your Art' }).closest('form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent(/attach at least one/i);
  });
});
