import { describe, expect, it } from 'vitest';
import { assertInside, redact } from '../src/utils.js';

describe('security utilities', () => {
  it('rejects path traversal', () => { expect(() => assertInside('C:/safe', 'C:/unsafe/file')).toThrow(); });
  it('redacts secrets', () => { expect(redact('api_key=secret-value')).not.toContain('secret-value'); });
});

