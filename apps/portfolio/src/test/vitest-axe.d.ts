import type { AxeMatchers } from 'vitest-axe/matchers';

declare module 'vitest' {
  // Module augmentation: empty extends-interfaces are the sanctioned way to
  // merge matcher types into vitest's own generics.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-object-type -- T mirrors vitest's Assertion arity; the empty body IS the augmentation
  interface Assertion<T> extends AxeMatchers {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- same augmentation pattern
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
