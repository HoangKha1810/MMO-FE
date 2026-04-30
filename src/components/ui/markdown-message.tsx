import * as React from 'react';
import { cn } from '@/lib/utils';

interface MarkdownMessageProps {
  content: string;
  className?: string;
}

type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'ordered-list'; items: string[] }
  | { type: 'unordered-list'; items: string[] };

function parseBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r/g, '').split('\n');
  const blocks: MarkdownBlock[] = [];
  let paragraphBuffer: string[] = [];
  let orderedItems: string[] = [];
  let unorderedItems: string[] = [];

  function flushParagraph() {
    if (paragraphBuffer.length === 0) {
      return;
    }
    blocks.push({
      type: 'paragraph',
      text: paragraphBuffer.join(' ').trim(),
    });
    paragraphBuffer = [];
  }

  function flushOrderedList() {
    if (orderedItems.length === 0) {
      return;
    }
    blocks.push({
      type: 'ordered-list',
      items: [...orderedItems],
    });
    orderedItems = [];
  }

  function flushUnorderedList() {
    if (unorderedItems.length === 0) {
      return;
    }
    blocks.push({
      type: 'unordered-list',
      items: [...unorderedItems],
    });
    unorderedItems = [];
  }

  function flushAll() {
    flushParagraph();
    flushOrderedList();
    flushUnorderedList();
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushAll();
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushAll();
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length as 1 | 2 | 3,
        text: headingMatch[2].trim(),
      });
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      flushUnorderedList();
      orderedItems.push(orderedMatch[1].trim());
      continue;
    }

    const unorderedMatch = line.match(/^[-*]\s+(.+)$/);
    if (unorderedMatch) {
      flushParagraph();
      flushOrderedList();
      unorderedItems.push(unorderedMatch[1].trim());
      continue;
    }

    flushOrderedList();
    flushUnorderedList();
    paragraphBuffer.push(line);
  }

  flushAll();
  return blocks;
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*([^*]+)\*)/;
  const nodes: React.ReactNode[] = [];
  let remaining = text;
  let index = 0;

  while (remaining.length > 0) {
    const match = remaining.match(pattern);
    if (!match || typeof match.index !== 'number') {
      nodes.push(remaining);
      break;
    }

    if (match.index > 0) {
      nodes.push(remaining.slice(0, match.index));
    }

    const key = `${keyPrefix}-${index}`;
    if (match[2]) {
      nodes.push(
        <strong key={key} className="font-semibold text-current">
          {renderInline(match[2], `${key}-bold`)}
        </strong>
      );
    } else if (match[3]) {
      nodes.push(
        <code
          key={key}
          className="rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[0.92em] text-current dark:border-white/10 dark:bg-black/20"
        >
          {match[3]}
        </code>
      );
    } else if (match[4] && match[5]) {
      nodes.push(
        <a
          key={key}
          href={match[5]}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-brand-blue underline underline-offset-4 dark:text-sky-200"
        >
          {renderInline(match[4], `${key}-link`)}
        </a>
      );
    } else if (match[6]) {
      nodes.push(
        <em key={key} className="italic text-current">
          {renderInline(match[6], `${key}-italic`)}
        </em>
      );
    }

    remaining = remaining.slice(match.index + match[0].length);
    index += 1;
  }

  return nodes;
}

export function MarkdownMessage({ content, className }: MarkdownMessageProps) {
  const blocks = parseBlocks(content);

  return (
    <div className={cn('space-y-4 text-sm leading-7 text-current', className)}>
      {blocks.map((block, blockIndex) => {
        if (block.type === 'heading') {
          const headingClassName =
            block.level === 1
              ? 'text-lg font-semibold tracking-[-0.02em]'
              : block.level === 2
                ? 'text-base font-semibold tracking-[-0.015em]'
                : 'text-sm font-semibold uppercase tracking-[0.08em] text-current/85';

          return (
            <div key={`heading-${blockIndex}`} className={headingClassName}>
              {renderInline(block.text, `heading-${blockIndex}`)}
            </div>
          );
        }

        if (block.type === 'ordered-list') {
          return (
            <ol key={`ordered-${blockIndex}`} className="ml-5 list-decimal space-y-2 marker:font-semibold">
              {block.items.map((item, itemIndex) => (
                <li key={`ordered-${blockIndex}-${itemIndex}`} className="pl-1">
                  {renderInline(item, `ordered-${blockIndex}-${itemIndex}`)}
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === 'unordered-list') {
          return (
            <ul key={`unordered-${blockIndex}`} className="ml-5 list-disc space-y-2 marker:font-semibold">
              {block.items.map((item, itemIndex) => (
                <li key={`unordered-${blockIndex}-${itemIndex}`} className="pl-1">
                  {renderInline(item, `unordered-${blockIndex}-${itemIndex}`)}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={`paragraph-${blockIndex}`} className="whitespace-pre-wrap break-words">
            {renderInline(block.text, `paragraph-${blockIndex}`)}
          </p>
        );
      })}
    </div>
  );
}
