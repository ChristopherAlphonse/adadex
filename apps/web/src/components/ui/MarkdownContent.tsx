import { marked } from "marked";
import { useMemo } from "react";

marked.setOptions({
  breaks: true,
  gfm: true,
});

const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const highlightHtml = (html: string, term: string): string => {
  const escaped = escapeRegExp(term);
  const regex = new RegExp(`(${escaped})`, "gi");

  // Only highlight text nodes — skip anything inside HTML tags
  // Split on tags, highlight only the non-tag segments
  const parts = html.split(/(<[^>]*>)/);
  return parts
    .map((part) => {
      if (part.startsWith("<")) return part;
      return part.replace(regex, '<mark class="search-highlight">$1</mark>');
    })
    .join("");
};

type MarkdownContentProps = {
  content: string;
  className?: string;
  highlightTerm?: string;
};

export const MarkdownContent = ({ content, className, highlightTerm }: MarkdownContentProps) => {
  const html = useMemo(() => {
    const rendered = marked.parse(content, { async: false }) as string;
    if (highlightTerm && highlightTerm.length > 0) {
      return highlightHtml(rendered, highlightTerm);
    }
    return rendered;
  }, [content, highlightTerm]);

  // biome-ignore lint/security/noDangerouslySetInnerHtml: markdown is rendered only inside the local operator UI and highlight markup is controlled.
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
};
