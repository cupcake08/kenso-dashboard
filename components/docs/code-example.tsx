"use client";

import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CodeExampleProps {
  code: string;
  language?: string;
  title?: string;
  className?: string;
  maxHeight?: string;
  wrapLongLines?: boolean;
  showHeader?: boolean;
  showLineNumbers?: boolean;
}

const supportedLanguages: Record<string, string> = {
  bash: "bash",
  shell: "bash",
  sh: "bash",
  ts: "typescript",
  typescript: "typescript",
  js: "javascript",
  javascript: "javascript",
  json: "json",
  python: "python",
  py: "python",
  text: "text",
};

export function CodeExample({
  code,
  language = "text",
  title,
  className,
  maxHeight = "22rem",
  wrapLongLines = true,
  showHeader = true,
  showLineNumbers = false,
}: CodeExampleProps) {
  const [copied, setCopied] = useState(false);

  const normalizedLanguage = useMemo(() => {
    return supportedLanguages[language.toLowerCase()] ?? "text";
  }, [language]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Snippet copied");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Failed to copy snippet");
    }
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[1.15rem] border border-slate-800/80 bg-[#0b1120] shadow-[0_18px_48px_-34px_rgba(2,6,23,0.9)]",
        className,
      )}
    >
      {showHeader ? (
        <div className="flex items-center justify-between border-b border-slate-800/70 bg-slate-950/40 px-4 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-50">{title || "Code sample"}</p>
            <p className="mt-0.5 text-[0.66rem] uppercase tracking-[0.18em] text-slate-500">{normalizedLanguage}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={copy}
            className="h-8 rounded-full px-3 text-xs text-slate-400 hover:bg-white/5 hover:text-slate-50"
            aria-label="Copy code sample"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-status-online" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </Button>
        </div>
      ) : null}

      <div className="overflow-auto" style={{ maxHeight }}>
        <SyntaxHighlighter
          language={normalizedLanguage}
          style={oneDark}
          wrapLongLines={wrapLongLines}
          showLineNumbers={showLineNumbers}
          lineNumberStyle={{
            minWidth: "2.5rem",
            paddingRight: "1rem",
            marginRight: "1rem",
            color: "rgba(148, 163, 184, 0.55)",
            borderRight: "1px solid rgba(255,255,255,0.06)",
            userSelect: "none",
          }}
          customStyle={{
            margin: 0,
            background: "transparent",
            padding: "0.95rem 1.1rem",
            fontSize: "0.8rem",
            lineHeight: "1.6",
            minWidth: "100%",
          }}
          codeTagProps={{
            style: {
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            },
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
