import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export const StatusBadge = ({ tone, label, compactLabel, className }) => {
    const classes = ["status-badge", "pill", tone, className]
        .filter((value) => Boolean(value))
        .join(" ");
    const fullLabel = label ?? tone.toUpperCase();
    return (_jsxs("span", { className: classes, children: [_jsx("span", { className: "status-badge__full", children: fullLabel }), compactLabel && compactLabel !== fullLabel ? (_jsx("span", { className: "status-badge__compact", children: compactLabel })) : null] }));
};
