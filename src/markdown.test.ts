import { describe, expect, it } from 'vitest';
import { markdownBlocks, markdownSpans, mentionToken } from './markdown';

describe('report preview markdown', () => {
  it('reads headings, paragraphs with line breaks, lists, tasks, quotes, code and rules', () => {
    expect(markdownBlocks('## Steps to reproduce\n1. Open the cart\n2. \n\n## Expected result ##\nTotal updates\nat once\n\n- [x] done\n- [ ] todo\n* * *\n> quoted\n> text\n```\n## not a heading\n```\n#hashtag'))
      .toEqual([
        { type: 'heading', level: 2, text: 'Steps to reproduce' },
        { type: 'list', ordered: true, start: 1, items: [{ text: 'Open the cart' }, { text: '' }] },
        { type: 'heading', level: 2, text: 'Expected result' },
        { type: 'paragraph', text: 'Total updates\nat once' },
        { type: 'list', ordered: false, start: 1, items: [{ text: 'done', checked: true }, { text: 'todo', checked: false }] },
        { type: 'rule' },
        { type: 'quote', text: 'quoted\ntext' },
        { type: 'code', text: '## not a heading' },
        { type: 'paragraph', text: '#hashtag' },
      ]);
    expect(markdownBlocks('')).toEqual([]);
    expect(markdownBlocks('3) third\n4) fourth')).toEqual([{ type: 'list', ordered: true, start: 3, items: [{ text: 'third' }, { text: 'fourth' }] }]);
  });
  it('reads inline code, emphasis, links, escapes and image mentions without touching snake_case or code', () => {
    expect(markdownSpans(`Compare ${mentionToken(1)} with \`@image1\` and **bold** _it_ ~~old~~ [docs](https://x.y) snake_case_name \\*kept\\*`)).toEqual([
      { type: 'text', text: 'Compare ' }, { type: 'mention', index: 1 }, { type: 'text', text: ' with ' }, { type: 'code', text: '@image1' },
      { type: 'text', text: ' and ' }, { type: 'bold', text: 'bold' }, { type: 'text', text: ' ' }, { type: 'italic', text: 'it' }, { type: 'text', text: ' ' },
      { type: 'strike', text: 'old' }, { type: 'text', text: ' ' }, { type: 'link', text: 'docs' }, { type: 'text', text: ' snake_case_name *kept*' },
    ]);
    expect(markdownSpans('`**not bold**`')).toEqual([{ type: 'code', text: '**not bold**' }]);
    expect(markdownSpans('plain')).toEqual([{ type: 'text', text: 'plain' }]);
  });
});
