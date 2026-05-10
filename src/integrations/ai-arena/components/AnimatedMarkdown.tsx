import {
  Children,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode
} from "react";
import { Check, Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

interface AnimatedMarkdownProps {
  content: string;
  animate?: boolean;
}

function useCopyState() {
  const [copied, setCopied] = useState(false);

  const triggerCopied = () => {
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return { copied, triggerCopied };
}

const copyTextSafely = async (text: string, onSuccess: () => void) => {
  try {
    await navigator.clipboard.writeText(text);
    onSuccess();
  } catch {
    return;
  }
};

function CopyButton({
  copied,
  onClick,
  label = "Sao chép"
}: {
  copied: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      className={`markdown-copy ${copied ? "copied" : ""}`}
      onClick={onClick}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? "Đã chép" : label}
    </button>
  );
}

function extractText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(extractText).join("");
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return extractText(node.props.children);
  }

  return "";
}

function MarkdownPre({ children }: ComponentPropsWithoutRef<"pre">) {
  const { copied, triggerCopied } = useCopyState();
  const codeElement = Children.toArray(children)[0];

  if (!isValidElement<{ children?: ReactNode; className?: string }>(codeElement)) {
    return <pre>{children}</pre>;
  }

  const className = codeElement.props.className ?? "";
  const match = /language-([\w-]+)/.exec(className);
  const language = match?.[1] ?? "text";
  const codeText = extractText(codeElement.props.children).replace(/\n$/, "");

  return (
    <div className="markdown-asset">
      <div className="markdown-asset__toolbar">
        <span>{language}</span>
        <CopyButton
          copied={copied}
          onClick={() => {
            void copyTextSafely(codeText, triggerCopied);
          }}
        />
      </div>
      <pre>{children}</pre>
    </div>
  );
}

function MarkdownInlineCode(props: ComponentPropsWithoutRef<"code">) {
  return <code {...props} />;
}

function MarkdownTable(props: ComponentPropsWithoutRef<"table">) {
  const { copied, triggerCopied } = useCopyState();
  const tableRef = useRef<HTMLTableElement | null>(null);

  return (
    <div className="markdown-asset markdown-asset--table">
      <div className="markdown-asset__toolbar">
        <span>Bảng dữ liệu</span>
        <CopyButton
          copied={copied}
          onClick={() => {
            const text = tableRef.current?.innerText ?? "";
            void copyTextSafely(text, triggerCopied);
          }}
        />
      </div>
      <div className="markdown-table-wrap">
        <table ref={tableRef} {...props} />
      </div>
    </div>
  );
}

function MarkdownTaskCheckbox() {
  return null;
}

export function AnimatedMarkdown({
  content,
  animate = true
}: AnimatedMarkdownProps) {
  const hasMath = useMemo(
    () =>
      /(\$\$[\s\S]+?\$\$)|(\$[^$\n]+\$)|(\\\([\s\S]+?\\\))|(\\\[[\s\S]+?\\\])/.test(
        content
      ),
    [content]
  );
  const tokens = useMemo(() => content.split(/(\s+)/), [content]);
  const [visibleCount, setVisibleCount] = useState(0);
  const shouldAnimate = animate && !hasMath;

  useEffect(() => {
    if (!shouldAnimate) {
      setVisibleCount(tokens.length);
      return;
    }

    setVisibleCount(0);

    const step = Math.max(1, Math.ceil(tokens.length / 80));
    const timer = window.setInterval(() => {
      setVisibleCount((current) => {
        if (current >= tokens.length) {
          window.clearInterval(timer);
          return current;
        }

        return Math.min(tokens.length, current + step);
      });
    }, 26);

    return () => {
      window.clearInterval(timer);
    };
  }, [shouldAnimate, tokens]);

  const markdownProps = {
    remarkPlugins: [remarkGfm, remarkMath],
    rehypePlugins: [rehypeKatex],
    components: {
      pre: MarkdownPre,
      code: MarkdownInlineCode,
      table: MarkdownTable,
      input: MarkdownTaskCheckbox
    }
  } satisfies ComponentPropsWithoutRef<typeof ReactMarkdown>;

  if (!shouldAnimate) {
    return (
      <ReactMarkdown {...markdownProps}>
        {content}
      </ReactMarkdown>
    );
  }

  return (
    <ReactMarkdown {...markdownProps}>
      {tokens.slice(0, visibleCount).join("")}
    </ReactMarkdown>
  );
}
