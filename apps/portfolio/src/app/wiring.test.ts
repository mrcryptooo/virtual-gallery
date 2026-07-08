import { describe, expect, it } from 'vitest';
import { ENGINE_NAME } from '@virtual-gallery/engine';

describe('workspace wiring (M0.0 tooling smoke)', () => {
  it('consumes the engine package through its public API', () => {
    expect(ENGINE_NAME).toBe('@virtual-gallery/engine');
  });
});
