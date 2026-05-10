import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
let toastListeners = [];
let toasts = [];
export const toast = {
    success: (message) => {
        const id = crypto.randomUUID();
        toasts = [...toasts, { id, message, type: "success" }];
        toastListeners.forEach((listener) => listener([...toasts]));
        setTimeout(() => {
            toasts = toasts.filter((t) => t.id !== id);
            toastListeners.forEach((listener) => listener([...toasts]));
        }, 4000);
    },
    error: (message) => {
        const id = crypto.randomUUID();
        toasts = [...toasts, { id, message, type: "error" }];
        toastListeners.forEach((listener) => listener([...toasts]));
        setTimeout(() => {
            toasts = toasts.filter((t) => t.id !== id);
            toastListeners.forEach((listener) => listener([...toasts]));
        }, 5000);
    },
    info: (message) => {
        const id = crypto.randomUUID();
        toasts = [...toasts, { id, message, type: "info" }];
        toastListeners.forEach((listener) => listener([...toasts]));
        setTimeout(() => {
            toasts = toasts.filter((t) => t.id !== id);
            toastListeners.forEach((listener) => listener([...toasts]));
        }, 4000);
    },
    warning: (message) => {
        const id = crypto.randomUUID();
        toasts = [...toasts, { id, message, type: "warning" }];
        toastListeners.forEach((listener) => listener([...toasts]));
        setTimeout(() => {
            toasts = toasts.filter((t) => t.id !== id);
            toastListeners.forEach((listener) => listener([...toasts]));
        }, 5000);
    },
};
export const ToastContainer = () => {
    const [currentToasts, setCurrentToasts] = useState([]);
    const listenerRef = useRef();
    listenerRef.current = (newToasts) => {
        setCurrentToasts(newToasts);
    };
    useEffect(() => {
        toastListeners.push(listenerRef.current);
        return () => {
            toastListeners = toastListeners.filter((l) => l !== listenerRef.current);
        };
    }, []);
    if (currentToasts.length === 0)
        return null;
    return (_jsx("div", { className: "toast-container", role: "region", "aria-label": "Notifications", children: currentToasts.map((t) => (_jsx(ToastItem, { toast: t }, t.id))) }));
};
const ToastItem = ({ toast }) => {
    const [visible, setVisible] = useState(true);
    const [exiting, setExiting] = useState(false);
    useEffect(() => {
        const timer = setTimeout(() => {
            setExiting(true);
            setTimeout(() => setVisible(false), 300);
        }, 3500);
        return () => clearTimeout(timer);
    }, []);
    if (!visible)
        return null;
    return (_jsxs("div", { className: `toast toast--${toast.type}${exiting ? " toast--exit" : ""}`, role: "alert", children: [_jsxs("span", { className: "toast-icon", children: [toast.type === "success" && "✓", toast.type === "error" && "✕", toast.type === "info" && "ℹ", toast.type === "warning" && "⚠"] }), _jsx("span", { className: "toast-message", children: toast.message }), _jsx("button", { type: "button", className: "toast-close", onClick: () => {
                    setExiting(true);
                    setTimeout(() => setVisible(false), 300);
                }, "aria-label": "Dismiss", children: "\u00D7" })] }));
};
