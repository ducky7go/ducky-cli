import { describe, it, expect } from 'vitest';

describe('ducky-cli', () => {
  it('should have a working test setup', () => {
    expect(1 + 1).toBe(2);
  });

  it('should verify basic TypeScript configuration', () => {
    const message: string = 'Hello, ducky-cli!';
    expect(message).toBe('Hello, ducky-cli!');
  });
});
