import { Fragment, type ReactNode } from 'react';
import { markdownBlocks, markdownSpans } from '../markdown';

/** Inline text with formatting. Links are shown, not followed: this is a preview of what will be sent. */
function Inline({ text, mention }: { text: string; mention: (index: number) => ReactNode }) {
  return <>{markdownSpans(text).map((span, i) => {
    if (span.type === 'mention') return <Fragment key={i}>{mention(span.index)}</Fragment>;
    if (span.type === 'code') return <code key={i}>{span.text}</code>;
    if (span.type === 'bold') return <strong key={i}><Inline text={span.text} mention={mention} /></strong>;
    if (span.type === 'italic') return <em key={i}><Inline text={span.text} mention={mention} /></em>;
    if (span.type === 'strike') return <s key={i}><Inline text={span.text} mention={mention} /></s>;
    if (span.type === 'link') return <span key={i} className="md-link"><Inline text={span.text} mention={mention} /></span>;
    return <Fragment key={i}>{span.text}</Fragment>;
  })}</>;
}

/**
 * The description as Linear will display it: headings, lists, quotes, code and emphasis. `mention(index)` renders
 * the image mention that `mentionToken(index)` stands for in `source`.
 */
export default function Markdown({ source, mention }: { source: string; mention: (index: number) => ReactNode }) {
  return (
    <div className="md">
      {markdownBlocks(source).map((block, i) => {
        if (block.type === 'heading') {
          // Not real h1–h6: the report's own title and image headings own those levels in the dialog.
          return <div key={i} role="heading" aria-level={5} className={`md-h md-h${block.level}`}><Inline text={block.text} mention={mention} /></div>;
        }
        if (block.type === 'code') return <pre key={i}><code>{block.text}</code></pre>;
        if (block.type === 'quote') return <blockquote key={i}><Inline text={block.text} mention={mention} /></blockquote>;
        if (block.type === 'rule') return <hr key={i} />;
        if (block.type === 'list') {
          const items = block.items.map((item, n) => (
            <li key={n} className={item.checked === undefined ? undefined : 'md-task'}>
              {item.checked !== undefined && <span className={item.checked ? 'md-box checked' : 'md-box'} aria-label={item.checked ? 'Done' : 'To do'} role="img" />}
              <Inline text={item.text} mention={mention} />
            </li>
          ));
          return block.ordered ? <ol key={i} start={block.start}>{items}</ol> : <ul key={i}>{items}</ul>;
        }
        return <p key={i}><Inline text={block.text} mention={mention} /></p>;
      })}
    </div>
  );
}
