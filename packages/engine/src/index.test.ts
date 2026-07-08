import { describe, expect, it } from 'vitest';
import { ENGINE_NAME, ENGINE_VERSION } from './index.ts';

describe('engine package (M0.0 tooling smoke)', () => {
  it('exposes its identity constants', () => {
    expect(ENGINE_NAME).toBe('@virtual-gallery/engine');
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
