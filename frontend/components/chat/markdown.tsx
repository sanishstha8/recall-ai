"use client";

import { Check, Copy } from "lucide-react";
import { memo, useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

const CITATION = /\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\]/g;

/**
 * Turn [1] / [1, 2] markers into "#cite-n" links (outside code fences) so they render as
 * clickable citation chips. Only numbers that exist as sources are converted.
 */
export function linkCitations(markdown: string, valid: Set<number>): string {
  return markdown
    .split(/(```[\s\S]*?(?:```|$))/g)
    .map((segment, i) =>
      i % 2 === 1
        ? segment
        : segment.replace(CITATION, (match, group: string) => {
            const numbers = group.split(",").map((n) => Number(n.trim()));
            if (!numbers.every((n) => valid.has(n))) return match;
            return numbers.map((n) => `[${n}](#cite-${n})`).join("");
          }),
    )
    .join("");
}

function CodeBlock({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group relative">
      <pre>{children}</pre>
      <button
        type="button"
        aria-label="Copy code"
        className="absolute top-2 right-2 rounded-md border bg-background/80 p-1.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
        onClick={(e) => {
          const text = (e.currentTarget.previousSibling as HTMLElement | null)?.innerText ?? "";
          navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}

export const Markdown = memo(function Markdown({
  content,
  renderCitation,
}: {
  content: string;
  renderCitation?: (index: number) => ReactNode;
}) {
  const components: Components = {
    pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
    a: ({ href, children }) => {
      const cite = href?.match(/^#cite-(\d+)$/);
      if (cite && renderCitation) return <>{renderCitation(Number(cite[1]))}</>;
      return (
        <a href={href} target="_blank" rel="noopener noreferrer nofollow">
          {children}
        </a>
      );
    },
  };
  // react-markdown never renders raw HTML, so model output cannot inject markup/scripts.
  return (
    <div className="prose-recall">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeHighlight, { detect: false, ignoreMissing: true }]]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
});
