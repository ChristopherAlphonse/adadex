import { jsx as _jsx } from "react/jsx-runtime";
import { marked } from "marked";
import { useMemo } from "react";
marked.setOptions({
    breaks: true,
    gfm: true,
});
const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const highlightHtml = (html, term) => {
    const escaped = escapeRegExp(term);
    const regex = new RegExp(`(${escaped})`, "gi");
    // Only highlight text nodes — skip anything inside HTML tags
    // Split on tags, highlight only the non-tag segments
    const parts = html.split(/(<[^>]*>)/);
    return parts
        .map((part) => {
        if (part.startsWith("<"))
            return part;
        return part.replace(regex, '<mark class="search-highlight">$1</mark>');
    })
        .join("");
};
export const MarkdownContent = ({ content, className, highlightTerm }) => {
    const html = useMemo(() => {
        const rendered = marked.parse(content, { async: false });
        if (highlightTerm && highlightTerm.length > 0) {
            return highlightHtml(rendered, highlightTerm);
        }
        return rendered;
    }, [content, highlightTerm]);
    // biome-ignore lint/security/noDangerouslySetInnerHtml: markdown is rendered only inside the local operator UI and highlight markup is controlled.
    return _jsx("div", { className: className, dangerouslySetInnerHTML: { __html: html } });
};
