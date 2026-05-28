import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type MarkdownContentProps = {
  value: string;
  className?: string;
};

function inlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)|`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const key = `${keyPrefix}-${match.index}`;
    if (match[2] && match[3]) {
      nodes.push(
        <a key={key} href={match[3]} target={match[3].startsWith("http") ? "_blank" : undefined} rel="noreferrer">
          {match[2]}
        </a>
      );
    } else if (match[4]) {
      nodes.push(<code key={key}>{match[4]}</code>);
    } else if (match[5] || match[6]) {
      nodes.push(<strong key={key}>{match[5] || match[6]}</strong>);
    } else if (match[7] || match[8]) {
      nodes.push(<em key={key}>{match[7] || match[8]}</em>);
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function isBlockStart(line: string) {
  return /^(#{1,4})\s+/.test(line) || /^>\s?/.test(line) || /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line);
}

export function MarkdownContent({ value, className }: MarkdownContentProps) {
  const lines = (value || "").replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      i += 1;
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const children = inlineMarkdown(heading[2], `h-${i}`);
      if (level === 1) blocks.push(<h2 key={i}>{children}</h2>);
      else if (level === 2) blocks.push(<h3 key={i}>{children}</h3>);
      else blocks.push(<h4 key={i}>{children}</h4>);
      i += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push(<blockquote key={i}>{inlineMarkdown(items.join(" "), `quote-${i}`)}</blockquote>);
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ul key={i}>
          {items.map((item, idx) => (
            <li key={idx}>{inlineMarkdown(item, `ul-${i}-${idx}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ol key={i}>
          {items.map((item, idx) => (
            <li key={idx}>{inlineMarkdown(item, `ol-${i}-${idx}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i].trim())) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    blocks.push(<p key={i}>{inlineMarkdown(paragraph.join(" "), `p-${i}`)}</p>);
  }

  return (
    <div
      className={cn(
        "prose prose-slate max-w-none dark:prose-invert prose-headings:font-extrabold prose-a:font-bold prose-a:text-mgmp-primary prose-strong:text-slate-900 dark:prose-strong:text-white prose-blockquote:border-mgmp-primary prose-blockquote:bg-slate-100/80 prose-blockquote:px-4 prose-blockquote:py-2 prose-blockquote:rounded-xl dark:prose-blockquote:bg-white/5 prose-code:rounded prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-slate-800 dark:prose-code:bg-white/10 dark:prose-code:text-slate-100",
        className
      )}
    >
      {blocks}
    </div>
  );
}
