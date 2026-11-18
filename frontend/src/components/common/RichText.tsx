import React from "react";

// Ported from EduRef AI's zero-dependency RichText Markdown renderer (safe React nodes only, no raw HTML).
function normalizeMarkdown(content: string): string {
  return String(content ?? "")
    .replace(/__(.+?)__/g, "**$1**")
    .replace(/\r\n?/g, "\n")
    .replace(/\\r\\n|\\n/g, "\n")
    .replace(/\]\s*\n\s*\(/g, "](")
    .replace(/\*\*\[([^\]]+)\]\*\*\s*\((https?:\/\/[^\s)]+)\)/g, "**[$1]($2)**")
    .replace(/([^\n])\s+(?=\d+[.)]\s+(?:\*\*|__))/g, "$1\n");
}

function safeLink(href: string): string | null {
  return /^(?:https?:\/\/|\/(?!\/)|#[\w-])/i.test(href) ? href : null;
}

function inline(
  text: string,
  isUser: boolean,
  depth = 0,
  insideLink = false
): React.ReactNode {
  if (depth > 12) return text.replace(/\*\*|__|~~|`/g, "");
  const nodes: React.ReactNode[] = [];
  let position = 0;
  const token =
    /(`+)([^`]*?)\1|\[([^\]]+)\]\(([^\s]+?)\)|\*\*([^\n]+?)\*\*|__([^\n]+?)__|~~([^\n]+?)~~|\*([^*\n]+?)\*|(?<!\w)_([^_\n]+?)_(?!\w)|https?:\/\/[^\s<>)]+/g;
  const clean = (value: string) =>
    value.replace(/\*\*|__|~~|`+/g, "").replace(/\\([*_~`[\]#])/g, "$1");

  for (const match of text.matchAll(token)) {
    const matchIndex = match.index ?? 0;
    if (matchIndex > position) {
      nodes.push(clean(text.slice(position, matchIndex)));
    }
    const [
      whole,
      codeMarker,
      code,
      label,
      href,
      bold,
      underscoreBold,
      strike,
      italic,
      underscoreItalic,
    ] = match;
    const key = matchIndex;

    if (codeMarker) {
      nodes.push(
        <code
          key={key}
          className={`rounded px-1.5 py-0.5 font-mono text-[12px] ${
            isUser
              ? "bg-blue-700/60 text-white"
              : "bg-slate-800/90 text-blue-300 border border-slate-700/60"
          }`}
        >
          {code}
        </code>
      );
    } else if (label !== undefined || whole.startsWith("http")) {
      const url = safeLink(href || whole.replace(/[.,;:!?]+$/, ""));
      const title = label ?? url ?? whole;
      nodes.push(
        url && !insideLink ? (
          <a
            key={key}
            href={url}
            target={url.startsWith("http") ? "_blank" : undefined}
            rel="noopener noreferrer"
            className={`underline break-words ${
              isUser ? "text-white" : "text-blue-400 hover:text-blue-300"
            }`}
          >
            {label === undefined ? title : inline(title, isUser, depth + 1, true)}
          </a>
        ) : (
          <span key={key}>{clean(title)}</span>
        )
      );
      if (!label && url && whole.length > url.length) {
        nodes.push(whole.slice(url.length));
      }
    } else if (bold !== undefined || underscoreBold !== undefined) {
      nodes.push(
        <strong
          key={key}
          className={`font-semibold ${isUser ? "text-white" : "text-white"}`}
        >
          {inline(bold ?? underscoreBold, isUser, depth + 1, insideLink)}
        </strong>
      );
    } else if (strike !== undefined) {
      nodes.push(
        <del key={key} className="opacity-75">
          {inline(strike, isUser, depth + 1, insideLink)}
        </del>
      );
    } else {
      nodes.push(
        <em key={key} className="italic">
          {inline(italic ?? underscoreItalic, isUser, depth + 1, insideLink)}
        </em>
      );
    }
    position = matchIndex + whole.length;
  }

  if (position < text.length) {
    nodes.push(clean(text.slice(position)));
  }
  return nodes;
}

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, "|"));

const tableSeparator = (line: string) =>
  /^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());

interface RichTextProps {
  content?: string;
  isUser?: boolean;
  compact?: boolean;
}

export const RichText: React.FC<RichTextProps> = ({
  content = "",
  isUser = false,
  compact = false,
}) => {
  if (!content) return null;
  const lines = normalizeMarkdown(content).split("\n");
  const blocks: React.ReactNode[] = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const text = line.trim();
    const key = index;

    if (!text) {
      blocks.push(<div key={key} className="h-1" />);
      continue;
    }

    if (/^\s*```|^\s*~~~/.test(line)) {
      const marker = text.slice(0, 3);
      const body: string[] = [];
      while (++index < lines.length && !lines[index].trim().startsWith(marker)) {
        body.push(lines[index]);
      }
      blocks.push(
        <pre
          key={key}
          className="max-w-full overflow-x-auto rounded-lg border border-slate-800 bg-[#131722] p-3 text-xs text-slate-200 font-mono"
        >
          <code>{body.join("\n")}</code>
        </pre>
      );
      continue;
    }

    if (
      index + 1 < lines.length &&
      line.includes("|") &&
      tableSeparator(lines[index + 1])
    ) {
      const headers = cells(line);
      const rows: string[][] = [];
      index++;
      while (
        index + 1 < lines.length &&
        lines[index + 1].includes("|") &&
        lines[index + 1].trim()
      ) {
        rows.push(cells(lines[++index]));
      }
      blocks.push(
        <div
          key={key}
          className="max-w-full overflow-x-auto rounded-lg border border-slate-800"
        >
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-[#131722] text-slate-200">
                {headers.map((cell, i) => (
                  <th
                    key={i}
                    className="border-b border-slate-800 px-2.5 py-2 font-semibold"
                  >
                    {inline(cell, isUser)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r} className="border-t border-slate-800/70">
                  {headers.map((_, c) => (
                    <td key={c} className="px-2.5 py-1.5 text-slate-300">
                      {inline(row[c] || "", isUser)}
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

    const heading = text.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      blocks.push(
        <h3 key={key} className="mt-1.5 font-semibold text-white">
          {inline(heading[1], isUser)}
        </h3>
      );
      continue;
    }

    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(text)) {
      blocks.push(<hr key={key} className="border-slate-800" />);
      continue;
    }

    const list = text.match(/^(?:(\d+)[.)]|[-*+])\s+(.+)$/);
    if (list) {
      const depth = Math.min(
        Math.floor((line.length - line.trimStart().length) / 2),
        4
      );
      blocks.push(
        <div
          key={key}
          className="flex items-start gap-2 pl-1"
          style={depth ? { marginLeft: `${depth}rem` } : undefined}
        >
          <span
            className={`shrink-0 tabular-nums ${
              isUser ? "text-blue-200" : "text-blue-400"
            }`}
          >
            {list[1] ? `${list[1]}.` : "•"}
          </span>
          <span className="min-w-0 flex-1">{inline(list[2], isUser)}</span>
        </div>
      );
      continue;
    }

    if (/^>\s?/.test(text)) {
      blocks.push(
        <blockquote
          key={key}
          className="border-l-2 border-blue-500/60 bg-blue-500/5 px-3 py-1.5 text-slate-300 rounded-r-lg"
        >
          {inline(text.replace(/^>\s?/, ""), isUser)}
        </blockquote>
      );
      continue;
    }

    blocks.push(<p key={key}>{inline(line, isUser)}</p>);
  }

  return (
    <div
      className={`${
        compact ? "space-y-1 text-xs" : "space-y-1.5 text-sm"
      } leading-relaxed break-words ${isUser ? "text-white" : "text-slate-200"}`}
    >
      {blocks}
    </div>
  );
};
