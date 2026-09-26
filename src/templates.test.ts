import { describe, expect, it } from 'vitest';
import { defaults } from './model';
import { DEFAULT_TEMPLATES, detailsToFill, rememberDetails, templatesOf, tidyTemplates } from './templates';

const options = { projects: [{ id: 'p1', name: 'Web' }], members: [{ id: 'm1', name: 'Ada' }], labels: [{ id: 'l1', name: 'Bug' }, { id: 'l2', name: 'UI' }] };
const empty = { projectId: '', assigneeId: '', labelIds: [] as string[], priority: 0 };

describe('templates', () => {
  it('uses built-in templates until the user edits them', () => {
    expect(templatesOf(defaults)).toBe(DEFAULT_TEMPLATES);
    expect(DEFAULT_TEMPLATES.map(t => t.name)).toEqual(['Bug report', 'Visual defect', 'Regression', 'Design feedback']);
    expect(templatesOf({ templates: [] })).toEqual([]);
    expect(tidyTemplates([{ id: 'a', name: '  ', body: '' }, { id: 'b', name: ' QA ', body: 'x' }])).toEqual([{ id: 'a', name: 'Untitled template', body: '' }, { id: 'b', name: 'QA', body: 'x' }]);
    expect(tidyTemplates(null)).toBeNull();
  });
});

describe('team defaults', () => {
  it('fills only empty fields with IDs the team still offers', () => {
    const remembered = { projectId: 'p1', assigneeId: 'gone', labelIds: ['l2', 'removed'], priority: 2 };
    expect(detailsToFill(empty, remembered, options)).toEqual({ projectId: 'p1', labelIds: ['l2'], priority: 2 });
    expect(detailsToFill({ projectId: '', assigneeId: 'm1', labelIds: ['l1'], priority: 3 }, remembered, options)).toEqual({ projectId: 'p1' });
    expect(detailsToFill({ ...empty, projectId: 'p1', priority: 2 }, { ...remembered, labelIds: ['removed'] }, options)).toBeNull();
    expect(detailsToFill(empty, undefined, options)).toBeNull();
  });
  it('remembers what was sent per team and stays bounded', () => {
    const one = rememberDetails({}, { teamId: 't1', projectId: 'p1', assigneeId: '', labelIds: ['l1'], priority: 1 });
    expect(one).toEqual({ t1: { projectId: 'p1', assigneeId: '', labelIds: ['l1'], priority: 1 } });
    expect(rememberDetails(one, { teamId: '', ...empty })).toBe(one);
    let many = {};
    for (let i = 0; i < 120; i++) many = rememberDetails(many, { teamId: `t${i}`, ...empty });
    expect(Object.keys(many)).toHaveLength(100);
    expect(Object.keys(many).at(-1)).toBe('t119');
    expect(Object.keys(rememberDetails(many, { teamId: 't50', ...empty })).at(-1)).toBe('t50');
  });
});
