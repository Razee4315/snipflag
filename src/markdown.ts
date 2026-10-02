/** A small Markdown reader for the report preview: the block and inline forms Linear renders in an issue. */
export type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; start: number; items: { text: string; checked?: boolean }[] }
  | { type: 'code'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'rule' };
export type Span = { type: 'text' | 'code' | 'bold' | 'italic' | 'strike' | 'link'; text: string } | { type: 'mention'; index: number };

/** Stands for prose segment `index` (an image mention) inside the text handed to the reader. */
export const mentionToken = (index: number) => `${index}`;

const HEADING = /^ {0,3}(#{1,6})[ \t]+(.*?)[ \t]*#*[ \t]*$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const QUOTE = /^ {0,3}>[ \t]?/;
const ITEM = /^[ \t]*(?:[-*+]|(\d{1,9})[.)])[ \t]+(.*)$/;
const TASK = /^\[([ xX])\][ \t]+(.*)$/;
const startsBlock = (line: string) => HEADING.test(line) || FENCE.test(line) || RULE.test(line) || QUOTE.test(line) || ITEM.test(line);

export function markdownBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n'); const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const fence = FENCE.exec(line);
    if (fence) {
      const body: string[] = []; i++;
      while (i < lines.length && !lines[i].trimStart().startsWith(fence[1])) body.push(lines[i++]);
      i++; blocks.push({ type: 'code', text: body.join('\n') }); continue;
    }
    const heading = HEADING.exec(line);
    if (heading) { blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] }); i++; continue; }
    // Before lists: "* * *" is a rule, not a bullet.
    if (RULE.test(line)) { blocks.push({ type: 'rule' }); i++; continue; }
    if (QUOTE.test(line)) {
      const body: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) body.push(lines[i++].replace(QUOTE, ''));
      blocks.push({ type: 'quote', text: body.join('\n') }); continue;
    }
    const first = ITEM.exec(line);
    if (first) {
      const ordered = first[1] !== undefined; const items: { text: string; checked?: boolean }[] = [];
      while (i < lines.length) {
        const item = ITEM.exec(lines[i]);
        if (!item || RULE.test(lines[i]) || (item[1] !== undefined) !== ordered) break;
        const task = TASK.exec(item[2]);
        items.push(task ? { text: task[2], checked: task[1] !== ' ' } : { text: item[2] }); i++;
      }
      blocks.push({ type: 'list', ordered, start: ordered ? Number(first[1]) : 1, items }); continue;
    }
    const body = [line]; i++;
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) body.push(lines[i++]);
    blocks.push({ type: 'paragraph', text: body.join('\n') });
  }
  return blocks;
}

// Order matters: mentions and code first (nothing inside them is formatted), then the longer markers.
const INLINE = new RegExp([
  '(\\d+)',                          // 1 mention
  '`([^`\\n]+)`',                                // 2 code
  '\\*\\*([^*\\n]+?)\\*\\*',                     // 3 bold
  '(?<![\\w\\\\])__([^_\\n]+?)__(?!\\w)',        // 4 bold
  '~~([^~\\n]+?)~~',                             // 5 strike
  '\\*([^*\\s][^*\\n]*?)\\*',                    // 6 italic
  '(?<![\\w\\\\])_([^_\\s][^_\\n]*?)_(?!\\w)',   // 7 italic
  '\\[([^\\]\\n]+)\\]\\([^)\\s]+\\)',            // 8 link text
  '\\\\([\\\\`*_{}\\[\\]<>#|!()+.~-])',          // 9 escaped punctuation
].join('|'), 'g');

/** Inline pieces of one line or paragraph. Bold, italic and strike text may hold further spans. */
export function markdownSpans(text: string): Span[] {
  const spans: Span[] = []; let cursor = 0;
  const plain = (value: string) => {
    if (!value) return;
    const last = spans[spans.length - 1];
    if (last && last.type === 'text') last.text += value; else spans.push({ type: 'text', text: value });
  };
  for (const m of text.matchAll(INLINE)) {
    plain(text.slice(cursor, m.index)); cursor = m.index + m[0].length;
    if (m[1] !== undefined) spans.push({ type: 'mention', index: Number(m[1]) });
    else if (m[2] !== undefined) spans.push({ type: 'code', text: m[2] });
    else if (m[3] !== undefined || m[4] !== undefined) spans.push({ type: 'bold', text: m[3] ?? m[4] });
    else if (m[5] !== undefined) spans.push({ type: 'strike', text: m[5] });
    else if (m[6] !== undefined || m[7] !== undefined) spans.push({ type: 'italic', text: m[6] ?? m[7] });
    else if (m[8] !== undefined) spans.push({ type: 'link', text: m[8] });
    else plain(m[9]);
  }
  plain(text.slice(cursor));
  return spans;
}
