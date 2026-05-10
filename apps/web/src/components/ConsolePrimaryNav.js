import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { PRIMARY_NAV_ITEMS, PRIMARY_NAV_KEY_HINT } from "../app/constants";
export const ConsolePrimaryNav = ({ activePrimaryNav, onPrimaryNavChange, }) => (_jsxs("nav", { className: "console-primary-nav", "aria-label": "Primary navigation", children: [_jsx("div", { className: "console-primary-nav-tabs", children: PRIMARY_NAV_ITEMS.map((item) => (_jsxs("button", { "aria-current": item.index === activePrimaryNav ? "page" : undefined, className: "console-primary-nav-tab", "data-active": item.index === activePrimaryNav ? "true" : "false", onClick: () => {
                    onPrimaryNavChange(item.index);
                }, type: "button", children: ["[", item.index, "] ", item.label] }, item.index))) }), _jsxs("p", { className: "console-primary-nav-hint", children: ["Press ", PRIMARY_NAV_KEY_HINT, " to navigate"] })] }));
