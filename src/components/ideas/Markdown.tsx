import { Fragment, type ReactNode } from 'react';

// Just enough Markdown for AI replies (headings, lists, bold, italics, code), rendered as
// React elements so nothing the model writes can inject HTML
function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g);
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i} className="font-bold text-foreground">{part.slice(2, -2)}</strong>;
    if (/^`[^`]+`$/.test(part)) return <code key={i} className="px-1 py-0.5 rounded bg-white/[0.08] text-[0.9em]">{part.slice(1, -1)}</code>;
    if (/^(\*[^*]+\*|_[^_]+_)$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

type Block =
  | { kind: 'h'; level: number; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'p'; text: string }
  | { kind: 'hr' };

function parse(source: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: 'p', text: para.join(' ') });
    para = [];
  };
  for (const raw of source.replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd();
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const last = blocks.at(-1);
    if (!line.trim()) flush();
    else if (/^(-{3,}|\*{3,})$/.test(line.trim())) { flush(); blocks.push({ kind: 'hr' }); }
    else if (heading) { flush(); blocks.push({ kind: 'h', level: heading[1].length, text: heading[2] }); }
    else if (bullet || numbered) {
      flush();
      const kind: 'ul' | 'ol' = bullet ? 'ul' : 'ol';
      const text = (bullet ?? numbered)![1];
      if (last && last.kind === kind) last.items.push(text);
      else blocks.push({ kind, items: [text] });
    } else if (/^\s{2,}\S/.test(raw) && last && (last.kind === 'ul' || last.kind === 'ol') && !para.length) {
      last.items[last.items.length - 1] += ` ${line.trim()}`;
    } else para.push(line.trim());
  }
  flush();
  return blocks;
}

export function Markdown({ text }: { text: string }) {
  return (
    <div className="space-y-2.5 text-[14px] leading-relaxed">
      {parse(text).map((b, i) => {
        if (b.kind === 'h') {
          return <p key={i} className={b.level <= 2 ? 'font-display font-extrabold text-[17px] pt-1' : 'font-bold text-[15px] pt-1'}>{inline(b.text)}</p>;
        }
        if (b.kind === 'hr') return <hr key={i} className="border-white/[0.08]" />;
        if (b.kind === 'ul') return <ul key={i} className="list-disc pl-5 space-y-1 marker:text-muted-foreground">{b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ul>;
        if (b.kind === 'ol') return <ol key={i} className="list-decimal pl-5 space-y-1 marker:text-muted-foreground marker:font-bold">{b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ol>;
        return <p key={i}>{inline(b.text)}</p>;
      })}
    </div>
  );
}
