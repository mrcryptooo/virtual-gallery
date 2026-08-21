import { afterEach, describe, expect, it, vi } from 'vitest';
import { notifyAdmin, sendTelegramMessage } from './_telegram.js';

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
      panoramaTitle: '01',
      template: 'template-3',
      id: 'x',
      createdAt: '2026-08-21T00:00:00.000Z',
      mediaUrl: 'https://blob.example/screenshots/media/x.png',
      displayName: 'Ada',
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

  it('sends a new-screenshot event as a photo with the mediaUrl and a formatted caption', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-token');
    vi.stubEnv('TELEGRAM_ADMIN_CHAT_ID', '12345');
    const fetchSpy = vi.fn(() => Promise.resolve({ ok: true }));
    global.fetch = fetchSpy as unknown as typeof fetch;

    notifyAdmin({
      type: 'new-screenshot',
      projectId: 'modern-museum',
      panoramaId: '5-06',
      panoramaTitle: '5.06',
      template: 'template-2',
      id: 'shot-1',
      createdAt: '2026-08-21T00:00:00.000Z',
      mediaUrl: 'https://blob.example/screenshots/media/shot-1.png',
      displayName: 'Ada Lovelace',
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.telegram.org/bottest-token/sendPhoto');
    const body = JSON.parse(init.body as string) as {
      chat_id: string;
      photo: string;
      caption: string;
    };
    expect(body.chat_id).toBe('12345');
    expect(body.photo).toBe('https://blob.example/screenshots/media/shot-1.png');
    expect(body.caption).toContain('Ada Lovelace');
    expect(body.caption).toContain('5.06');
    expect(body.caption).toContain('template-2');
  });

  it('falls back to a plain text message when sendPhoto fails', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-token');
    vi.stubEnv('TELEGRAM_ADMIN_CHAT_ID', '12345');
    const fetchSpy = vi.fn((url: string) => {
      if (url.endsWith('/sendPhoto')) {
        return Promise.resolve({ ok: false, status: 400 });
      }
      return Promise.resolve({ ok: true });
    });
    global.fetch = fetchSpy as unknown as typeof fetch;

    notifyAdmin({
      type: 'new-screenshot',
      projectId: 'modern-museum',
      panoramaId: '5-06',
      panoramaTitle: '5.06',
      template: null,
      id: 'shot-2',
      createdAt: '2026-08-21T00:00:00.000Z',
      mediaUrl: 'https://blob.example/screenshots/media/shot-2.png',
      displayName: null,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const secondCall = fetchSpy.mock.calls[1] as unknown as [string, RequestInit];
    expect(secondCall[0]).toBe('https://api.telegram.org/bottest-token/sendMessage');
    const body = JSON.parse(secondCall[1].body as string) as { text: string };
    expect(body.text).toContain('Anonymous');
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

describe('sendTelegramMessage', () => {
  it('returns false without calling fetch when not configured', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '');
    vi.stubEnv('TELEGRAM_ADMIN_CHAT_ID', '');
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    await expect(sendTelegramMessage('hello')).resolves.toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns true on a successful send', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-token');
    vi.stubEnv('TELEGRAM_ADMIN_CHAT_ID', '12345');
    global.fetch = vi.fn(() => Promise.resolve({ ok: true })) as unknown as typeof fetch;

    await expect(sendTelegramMessage('hello')).resolves.toBe(true);
  });

  it('throws when Telegram responds with a non-2xx status', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-token');
    vi.stubEnv('TELEGRAM_ADMIN_CHAT_ID', '12345');
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, status: 401 }),
    ) as unknown as typeof fetch;

    await expect(sendTelegramMessage('hello')).rejects.toThrow('401');
  });
});
