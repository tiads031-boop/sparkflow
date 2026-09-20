import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const markdownComponents: Components = {
  h1: ({ children }) => <h1 className="mb-2 mt-4 text-lg font-black first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-4 text-base font-black first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1.5 mt-3 text-sm font-black first:mt-0">{children}</h3>,
  p: ({ children }) => <p className="my-2 whitespace-pre-wrap first:mt-0 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-black">{children}</strong>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-[#8f7bd8] pl-3 text-[var(--sf-text-secondary)]">
      {children}
    </blockquote>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-bold text-[#6f63a8] underline decoration-[#8f7bd8]/40 underline-offset-2"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="break-words rounded bg-black/[0.07] px-1 py-0.5 font-mono text-[0.85em]">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-xl bg-[#242424] p-3 text-xs leading-5 text-white [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <table className="my-3 w-full border-collapse text-left text-xs">{children}</table>
  ),
  th: ({ children }) => <th className="border border-black/10 bg-black/[0.04] px-2 py-1.5 font-black">{children}</th>,
  td: ({ children }) => <td className="border border-black/10 px-2 py-1.5 align-top">{children}</td>,
  hr: () => <hr className="my-4 border-black/10" />,
};

export default function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="min-w-0 overflow-hidden">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
