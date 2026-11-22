import React from 'react';
import katex from 'katex';
import type { BlockType, NoteBlock } from '../types/miu';
import { parseLinkUrl } from './linkHelper';

/**
 * Remove <think>...</think> blocks produced by reasoning models (e.g. Qwen / DeepSeek)
 */
export function cleanThinkingTags(raw: string): string {
  if (!raw) return '';
  // Remove completed <think>...</think> blocks
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '');
  // If still streaming an unclosed <think>, strip the opening tag and show content cleanly
  cleaned = cleaned.replace(/<\/?think>/gi, '');
  return cleaned.trim();
}

/**
 * Renders inline Markdown tokens (**bold**, *italic*, `code`, $math$, [link](url)) into React nodes
 */
export function renderInlineMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];

  const tokenRegex =
    /(`[^`]+`|\$\$[^$]+\$\$|\$[^$\n]+\$|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|==[^=]+==|<u>[\s\S]+?<\/u>|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s<>]+|\*[^*\n]+\*|_[^_\n]+_)/g;

  const parts = text.split(tokenRegex);

  return parts.map((part, idx) => {
    if (!part) return null;

    // Inline code `...`
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 mx-0.5 rounded-md bg-subtle border border-border-subtle font-mono text-[0.88em] text-accent-strong"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Inline or display math $...$ / $$...$$
    if (
      (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) ||
      (part.startsWith('$') && part.endsWith('$') && part.length > 2)
    ) {
      const isDisplay = part.startsWith('$$');
      const tex = isDisplay ? part.slice(2, -2) : part.slice(1, -1);
      try {
        const html = katex.renderToString(tex, {
          throwOnError: false,
          displayMode: isDisplay
        });
        return (
          <span
            key={idx}
            dangerouslySetInnerHTML={{ __html: html }}
            className={isDisplay ? 'block my-1.5 overflow-x-auto' : 'inline-block mx-0.5'}
          />
        );
      } catch {
        return <code key={idx}>{tex}</code>;
      }
    }

    // Bold **...** or __...__
    if (
      (part.startsWith('**') && part.endsWith('**') && part.length > 4) ||
      (part.startsWith('__') && part.endsWith('__') && part.length > 4)
    ) {
      return (
        <strong key={idx} className="font-bold text-text-primary">
          {renderInlineMarkdown(part.slice(2, -2))}
        </strong>
      );
    }

    // Strikethrough ~~...~~
    if (part.startsWith('~~') && part.endsWith('~~') && part.length > 4) {
      return (
        <del key={idx} className="line-through text-text-secondary/80">
          {renderInlineMarkdown(part.slice(2, -2))}
        </del>
      );
    }

    // Highlight ==...==
    if (part.startsWith('==') && part.endsWith('==') && part.length > 4) {
      return (
        <mark
          key={idx}
          className="px-1 py-0.5 rounded bg-amber-300/45 dark:bg-amber-400/25 text-inherit"
        >
          {renderInlineMarkdown(part.slice(2, -2))}
        </mark>
      );
    }

    // Underline <u>...</u>
    if (part.startsWith('<u>') && part.endsWith('</u>') && part.length > 7) {
      return (
        <span key={idx} className="underline underline-offset-2 decoration-current">
          {renderInlineMarkdown(part.slice(3, -4))}
        </span>
      );
    }

    // Markdown link [label](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const rawHref = linkMatch[2].trim();
      const isAllowedHref = /^(https?:\/\/|mailto:|\/)/i.test(rawHref);
      if (!isAllowedHref) {
        return <React.Fragment key={idx}>{part}</React.Fragment>;
      }
      return (
        <a
          key={idx}
          href={rawHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-accent-strong underline underline-offset-2 hover:opacity-80"
        >
          {linkMatch[1]}
        </a>
      );
    }

    // Bare external URL (https://... or http://...)
    if (/^https?:\/\//i.test(part)) {
      let cleanUrl = part;
      let trailing = '';
      while (cleanUrl.length > 8) {
        const last = cleanUrl[cleanUrl.length - 1];
        if (/[.,;:!?]/.test(last)) {
          trailing = last + trailing;
          cleanUrl = cleanUrl.slice(0, -1);
          continue;
        }
        if (
          last === ')' &&
          (cleanUrl.match(/\(/g)?.length || 0) < (cleanUrl.match(/\)/g)?.length || 0)
        ) {
          trailing = last + trailing;
          cleanUrl = cleanUrl.slice(0, -1);
          continue;
        }
        if (
          last === ']' &&
          (cleanUrl.match(/\[/g)?.length || 0) < (cleanUrl.match(/\]/g)?.length || 0)
        ) {
          trailing = last + trailing;
          cleanUrl = cleanUrl.slice(0, -1);
          continue;
        }
        break;
      }

      const parsed = parseLinkUrl(cleanUrl);
      if (parsed.isValid) {
        return (
          <React.Fragment key={idx}>
            <a
              href={parsed.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-accent-strong underline underline-offset-2 hover:opacity-80 break-all"
            >
              {cleanUrl}
            </a>
            {trailing}
          </React.Fragment>
        );
      }
    }

    // Italic *...* or _..._
    if (
      (part.startsWith('*') && part.endsWith('*') && part.length > 2) ||
      (part.startsWith('_') && part.endsWith('_') && part.length > 2)
    ) {
      return (
        <em key={idx} className="italic">
          {renderInlineMarkdown(part.slice(1, -1))}
        </em>
      );
    }

    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

/**
 * Strips raw inline markdown syntax (**bold**, *italic*, `code`) for plain text inputs (e.g. Todo titles / Headings)
 */
export function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/==([^=]+)==/g, '$1')
    .replace(/<\/?u>/gi, '')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/_([^_\n]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

function isMarkdownTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return false;
  const cells = trimmed
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));
}

function splitMarkdownTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

/**
 * Full Markdown Renderer Component for AI Streaming Responses
 */
export const MarkdownView: React.FC<{ content: string }> = ({ content }) => {
  const cleaned = cleanThinkingTags(content);
  if (!cleaned) return null;

  const lines = cleaned.replace(/\r\n/g, '\n').split('\n');
  const elements: React.ReactNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Skip empty lines
    if (!trimmed) {
      i++;
      continue;
    }

    // 1. Fenced Code Block ```lang ... ```
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim() || 'code';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <div
          key={`code-${i}`}
          className="my-2.5 rounded-xl overflow-hidden border border-border-subtle bg-slate-950 text-slate-100"
        >
          <div className="px-3 py-1.5 bg-slate-900 border-b border-white/10 text-[10px] font-mono text-sky-300 uppercase">
            {lang}
          </div>
          <pre className="p-3 text-xs font-mono leading-relaxed overflow-x-auto">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      );
      continue;
    }

    // 2. Display Math Block $$ ... $$
    if (trimmed.startsWith('$$')) {
      if (trimmed.endsWith('$$') && trimmed.length > 4) {
        const tex = trimmed.slice(2, -2).trim();
        let html = tex;
        try {
          html = katex.renderToString(tex, { throwOnError: false, displayMode: true });
        } catch {
          // ignore
        }
        elements.push(
          <div
            key={`math-single-${i}`}
            className="my-2.5 p-2.5 rounded-xl bg-subtle/60 border border-border-subtle overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
        i++;
        continue;
      }

      const mathLines: string[] = [];
      if (trimmed.slice(2).trim()) {
        mathLines.push(trimmed.slice(2).trim());
      }
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('$$')) {
        mathLines.push(lines[i]);
        i++;
      }
      i++;
      const tex = mathLines.join('\n');
      let html = tex;
      try {
        html = katex.renderToString(tex, { throwOnError: false, displayMode: true });
      } catch {
        // ignore
      }
      elements.push(
        <div
          key={`math-${i}`}
          className="my-2.5 p-2.5 rounded-xl bg-subtle/60 border border-border-subtle overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
      continue;
    }

    // 3. Markdown Table (| Col 1 | Col 2 |)
    if (
      trimmed.startsWith('|') &&
      i + 1 < lines.length &&
      isMarkdownTableSeparator(lines[i + 1])
    ) {
      const headers = splitMarkdownTableRow(trimmed);
      i += 2; // skip header + separator line
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        if (!isMarkdownTableSeparator(lines[i])) {
          rows.push(splitMarkdownTableRow(lines[i]));
        }
        i++;
      }
      elements.push(
        <div
          key={`tbl-${i}`}
          className="my-2.5 overflow-x-auto rounded-xl border border-border-subtle bg-surface"
        >
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-subtle/80 border-b border-border-subtle">
                {headers.map((h, hIdx) => (
                  <th key={hIdx} className="px-3 py-2 font-bold text-text-primary">
                    {renderInlineMarkdown(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/60">
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-subtle/30">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 text-text-primary align-top">
                      {renderInlineMarkdown(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // 4. Horizontal Divider
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      elements.push(<hr key={`hr-${i}`} className="my-3 border-border-subtle" />);
      i++;
      continue;
    }

    // 5. Headings (# to ######)
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = stripInlineMarkdown(headingMatch[2]);
      const sizeClass =
        level === 1
          ? 'text-base font-extrabold text-text-primary mt-4 mb-1.5 pb-1 border-b border-border-subtle/60'
          : level === 2
            ? 'text-[14px] font-bold text-text-primary mt-3.5 mb-1'
            : 'text-[13px] font-bold text-text-primary mt-2.5 mb-0.5';
      elements.push(
        <div key={`h-${i}`} className={sizeClass}>
          {renderInlineMarkdown(text)}
        </div>
      );
      i++;
      continue;
    }

    // 6. Blockquote (> ...)
    if (trimmed.startsWith('>')) {
      const quoteText = trimmed.replace(/^>\s*/, '');
      elements.push(
        <blockquote
          key={`q-${i}`}
          className="my-2 pl-3 py-1 border-l-2 border-accent-strong bg-subtle/40 rounded-r-lg italic text-[13px] text-text-secondary"
        >
          {renderInlineMarkdown(quoteText)}
        </blockquote>
      );
      i++;
      continue;
    }

    // 7. Unordered List or Checklist (- ..., * ..., + ..., • ...)
    if (/^([-*+•])\s+/.test(trimmed)) {
      const listItems: Array<{ text: string; checked?: boolean }> = [];
      while (i < lines.length && /^([-*+•])\s+/.test(lines[i].trim())) {
        const itemLine = lines[i].trim().replace(/^([-*+•])\s+/, '');
        const todoMatch = itemLine.match(/^\[([ xX])\]\s+(.*)$/);
        if (todoMatch) {
          listItems.push({
            checked: todoMatch[1].toLowerCase() === 'x',
            text: todoMatch[2]
          });
        } else {
          listItems.push({ text: itemLine });
        }
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="my-1.5 space-y-1.5 pl-1">
          {listItems.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-[13px] leading-[1.65]">
              {typeof item.checked === 'boolean' ? (
                <span
                  className={`mt-1 w-3.5 h-3.5 rounded-[4px] border flex items-center justify-center shrink-0 text-[9px] ${
                    item.checked
                      ? 'bg-accent-strong border-accent-strong text-white dark:text-slate-950'
                      : 'border-text-secondary/50'
                  }`}
                >
                  {item.checked ? '✓' : ''}
                </span>
              ) : (
                <span className="text-accent-strong font-bold select-none mt-0.5">•</span>
              )}
              <span className="flex-1 min-w-0 text-text-primary">
                {renderInlineMarkdown(item.text)}
              </span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 8. Ordered List (1. ..., 2. ...)
    if (/^\d+[.)]\s+/.test(trimmed)) {
      const listItems: Array<{ num: string; text: string }> = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        const match = lines[i].trim().match(/^(\d+)[.)]\s+(.*)$/);
        if (match) {
          listItems.push({ num: match[1], text: match[2] });
        }
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="my-1.5 space-y-1.5 pl-1">
          {listItems.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-[13px] leading-[1.65]">
              <span className="font-mono text-xs font-bold text-accent-strong shrink-0 mt-0.5">
                {item.num}.
              </span>
              <span className="flex-1 min-w-0 text-text-primary">
                {renderInlineMarkdown(item.text)}
              </span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // 9. Normal Paragraph
    elements.push(
      <p key={`p-${i}`} className="text-[13px] leading-[1.7] text-text-primary my-1.5">
        {renderInlineMarkdown(trimmed)}
      </p>
    );
    i++;
  }

  return <div className="space-y-1">{elements}</div>;
};

/**
 * Converts a Markdown AI response into structured Notion blocks with rich inline formatting preserved
 */
export function parseMarkdownToNotionBlocks(markdown: string): Array<Omit<NoteBlock, 'id'>> {
  const cleaned = cleanThinkingTags(markdown);
  const lines = cleaned.replace(/\r\n/g, '\n').split('\n');
  const blocks: Array<Omit<NoteBlock, 'id'>> = [];

  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      i++;
      continue;
    }

    // 1. Fenced Code block (or Mermaid diagram)
    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim().toLowerCase() || 'javascript';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      if (language === 'mermaid') {
        blocks.push({
          type: 'mermaid',
          caption: 'Diagram Mermaid',
          content: codeLines.join('\n')
        });
      } else {
        blocks.push({
          type: 'code',
          language,
          content: codeLines.join('\n')
        });
      }
      continue;
    }

    // 2. Display Math block $$ ... $$
    if (trimmed.startsWith('$$')) {
      if (trimmed.endsWith('$$') && trimmed.length > 4) {
        blocks.push({
          type: 'math',
          content: trimmed.slice(2, -2).trim()
        });
        i++;
        continue;
      }
      const mathLines: string[] = [];
      if (trimmed.slice(2).trim()) {
        mathLines.push(trimmed.slice(2).trim());
      }
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('$$')) {
        mathLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({
        type: 'math',
        content: mathLines.join('\n').trim()
      });
      continue;
    }

    // 3. Markdown Table -> Native Simple Table block
    if (
      trimmed.startsWith('|') &&
      i + 1 < lines.length &&
      isMarkdownTableSeparator(lines[i + 1])
    ) {
      const headers = splitMarkdownTableRow(trimmed).map((h) => h.trim());
      const bodyRows: string[][] = [];
      i += 2; // skip header & separator
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        if (!isMarkdownTableSeparator(lines[i])) {
          bodyRows.push(splitMarkdownTableRow(lines[i]).map((c) => c.trim()));
        }
        i++;
      }
      const rawRows = [headers, ...bodyRows].filter((r) => r.length > 0);
      const colCount = Math.max(2, ...rawRows.map((r) => r.length));
      const normalizedRows = rawRows.map((r) =>
        Array.from({ length: colCount }, (_, idx) => r[idx] || '')
      );
      if (normalizedRows.length > 0) {
        blocks.push({
          type: 'table',
          content: headers.map((h) => stripInlineMarkdown(h)).filter(Boolean).join(' | '),
          tableData: {
            hasHeaderRow: true,
            rows: normalizedRows
          }
        });
      }
      continue;
    }

    // 4. Divider
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: 'divider', content: '' });
      i++;
      continue;
    }

    // 5. Heading (# to ######)
    const hMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (hMatch) {
      const level = hMatch[1].length;
      const type: BlockType = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3';
      blocks.push({
        type,
        content: stripInlineMarkdown(hMatch[2])
      });
      i++;
      continue;
    }

    // 6. Standalone bold line acting as sub-heading (e.g. "**1. Pendahuluan**" or "**Kesimpulan:**")
    const boldHeadingMatch = trimmed.match(/^\*\*([^*]{3,80})\*\*:?$/);
    if (boldHeadingMatch) {
      blocks.push({
        type: 'h3',
        content: stripInlineMarkdown(boldHeadingMatch[1])
      });
      i++;
      continue;
    }

    // 7. Todo / Bullet list (- ..., * ..., + ..., • ...)
    if (/^([-*+•])\s+/.test(trimmed)) {
      const itemText = trimmed.replace(/^([-*+•])\s+/, '');
      const todoMatch = itemText.match(/^\[([ xX])\]\s+(.*)$/);
      if (todoMatch) {
        blocks.push({
          type: 'todo',
          checked: todoMatch[1].toLowerCase() === 'x',
          content: todoMatch[2].trim()
        });
      } else {
        blocks.push({
          type: 'bullet',
          content: itemText.trim()
        });
      }
      i++;
      continue;
    }

    // 8. Numbered list (1. ..., 2) ...)
    const numMatch = trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (numMatch) {
      blocks.push({
        type: 'numbered',
        content: numMatch[1].trim()
      });
      i++;
      continue;
    }

    // 9. Quote / Callout (> ...)
    if (trimmed.startsWith('>')) {
      const quoteBody = trimmed.replace(/^>\s*/, '').trim();
      if (/^(💡|📌|⚠️|🔥|✅|\*\*Catatan|\*\*Penting|\*\*Tips)/i.test(quoteBody)) {
        blocks.push({
          type: 'callout',
          calloutIcon: '💡',
          content: quoteBody.replace(/^(💡|📌|⚠️|🔥|✅)\s*/, '')
        });
      } else {
        blocks.push({
          type: 'quote',
          content: quoteBody
        });
      }
      i++;
      continue;
    }

    // 10. Default paragraph (keeps **bold**, *italic*, `code`, $math$ for inline rendering)
    blocks.push({
      type: 'text',
      content: trimmed
    });
    i++;
  }

  return blocks;
}
