import { describe, expect, it } from 'vitest';
import { parseTaskUrl } from '../src/task-url.js';

describe('parseTaskUrl', () => {
  it('reads an Odoo project task fragment', () => {
    const result = parseTaskUrl('https://erp.19t.vn/web#id=5089&model=project.task&view_type=form');
    expect(result.taskId).toBe('5089'); expect(result.model).toBe('project.task');
  });
  it('rejects other hosts and models', () => {
    expect(() => parseTaskUrl('https://example.com/web#id=1&model=project.task')).toThrow();
    expect(() => parseTaskUrl('https://erp.19t.vn/web#id=1&model=res.user')).toThrow();
  });
});

