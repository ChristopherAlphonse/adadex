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
    const rendered =
      /* SAFETY: preceding checks establish the invariant this assertion encodes. */ marked.parse(
        content,
        { async: false },
      ) as string;

    if (highlightTerm && highlightTerm.length > 0) {
      return highlightHtml(rendered, highlightTerm);
    }

    return rendered;
  }, [content, highlightTerm]);

  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
};
