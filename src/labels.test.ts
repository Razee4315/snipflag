import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import LabelPicker, { labelMatches } from './components/LabelPicker';

const labels = [{ id: 'a', name: 'Backend', color: '#f00' }, { id: 'b', name: 'Bug' }, { id: 'c', name: 'Debug tools' }, { id: 'd', name: 'Design' }];

describe('label picker', () => {
  it('offers unselected labels that contain the text, names starting with it first', () => {
    expect(labelMatches(labels, [], '').map(l => l.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(labelMatches(labels, ['b'], ' BU ').map(l => l.id)).toEqual(['c']);
    expect(labelMatches(labels, [], 'bug').map(l => l.id)).toEqual(['b', 'c']);
    expect(labelMatches(labels, [], 'de').map(l => l.id)).toEqual(['c', 'd']);
    expect(labelMatches(labels, ['a', 'b', 'c', 'd'], '')).toEqual([]);
  });
  it('shows chosen labels as removable chips and says why none can be chosen yet', () => {
    const chosen = renderToStaticMarkup(createElement(LabelPicker, { labels, selected: ['a', 'd'], disabled: false, hint: '', onChange: () => {} }));
    expect(chosen).toContain('Labels (2)');
    expect(chosen).toMatch(/aria-label="Remove label Backend"/);
    expect(chosen).toMatch(/aria-label="Remove label Design"/);
    expect(chosen).not.toMatch(/Remove label Bug/);
    expect(chosen).toMatch(/placeholder="Add another"/);
    const waiting = renderToStaticMarkup(createElement(LabelPicker, { labels: null, selected: [], disabled: true, hint: 'Choose a team first.', onChange: () => {} }));
    expect(waiting).toContain('Choose a team first.');
    expect(waiting).not.toContain('role="combobox"');
    expect(renderToStaticMarkup(createElement(LabelPicker, { labels: [], selected: [], disabled: false, hint: '', onChange: () => {} }))).toContain('No labels in this team.');
  });
});
