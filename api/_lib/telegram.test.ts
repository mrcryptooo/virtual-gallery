import { afterEach, describe, expect, it, vi } from 'vitest';
import { notifyAdmin } from './telegram.js';

const originalFetch = global.fetch;

afterEach(() => {
  vi.unstubAllEnvs();
  global.fetch = originalFetch;
});

describe('notifyAdmin', () => {
  it('is a silent no-op with no token/chat id configured', () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '');
    vi.stubEnv('TELEGRAM_ADMIN_CHAT_ID', '');
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    notifyAdmin({ type: 'new-submission', artistName: 'Ada', artworkTitle: 'Fault Line', id: 'x' });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('is a silent no-op with only one of the two env vars set', () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'token');
    vi.stubEnv('TELEGRAM_ADMIN_CHAT_ID', '');
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    notifyAdmin({
      type: 'new-screenshot',
      projectId: 'modern-museum',
      panoramaId: '0-01',
      id: 'x',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts to the Telegram sendMessage API when both env vars are set', () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-token');
    vi.stubEnv('TELEGRAM_ADMIN_CHAT_ID', '12345');
    const fetchSpy = vi.fn(() => Promise.resolve({ ok: true }));
    global.fetch = fetchSpy as unknown as typeof fetch;

    notifyAdmin({ type: 'new-submission', artistName: 'Ada', artworkTitle: 'Fault Line', id: 'x' });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.telegram.org/bottest-token/sendMessage');
    const body = JSON.parse(init.body as string) as { chat_id: string; text: string };
    expect(body.chat_id).toBe('12345');
    expect(body.text).toContain('Ada');
    expect(body.text).toContain('Fault Line');
  });

  it('never throws when the Telegram request itself fails', () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-token');
    vi.stubEnv('TELEGRAM_ADMIN_CHAT_ID', '12345');
    global.fetch = vi.fn(() =>
      Promise.reject(new Error('network down')),
    ) as unknown as typeof fetch;

    expect(() => {
      notifyAdmin({ type: 'system-error', context: 'test', message: 'boom' });
    }).not.toThrow();
  });
});
