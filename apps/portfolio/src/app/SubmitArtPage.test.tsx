import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

  it('caps attachments at 3 files, even if more are selected at once', () => {
    // jsdom has no createObjectURL/revokeObjectURL implementation.
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();

    render(<SubmitArtPage />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const files = [1, 2, 3, 4].map(
      (n) => new File(['x'], `art-${String(n)}.png`, { type: 'image/png' }),
    );
    fireEvent.change(input, { target: { files } });

    expect(screen.getByText('3/3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose files' })).toBeDisabled();
  });

  it('flags an unsupported file type with a visible per-file error', () => {
    render(<SubmitArtPage />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const badFile = new File(['x'], 'notes.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [badFile] } });

    expect(screen.getByText(/unsupported file type/i)).toBeInTheDocument();
  });
});
