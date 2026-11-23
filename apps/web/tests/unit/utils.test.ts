import { describe, it, expect } from 'vitest';
import { cn } from '../../lib/utils';

describe('Web Utils (cn)', () => {
  it('should merge class names properly', () => {
    const result = cn('px-4 py-2', 'bg-indigo-600', { 'text-white': true, 'hidden': false });
    expect(result).toBe('px-4 py-2 bg-indigo-600 text-white');
  });

  it('should resolve tailwind class conflicts using tailwind-merge', () => {
    const result = cn('px-4 px-8', 'bg-red-500 bg-blue-500');
    expect(result).toBe('px-8 bg-blue-500');
  });
});
