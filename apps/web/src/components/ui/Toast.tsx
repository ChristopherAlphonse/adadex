import { useEffect, useRef, useState } from "react";

// ─── Toast notifications ───────────────────────────────────────────────────────

export type ToastType = "success" | "error" | "info" | "warning";

export type Toast = {
  id: string;
  message: string;
  type: ToastType;
};

type ToastContextValue = {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
};

let toastListeners: Array<(toasts: Toast[]) => void> = [];
let toasts: Toast[] = [];

export const toast = {
  success: (message: string) => {
    const id = crypto.randomUUID();
    toasts = [...toasts, { id, message, type: "success" }];
    toastListeners.forEach((listener) => listener([...toasts]));
    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
      toastListeners.forEach((listener) => listener([...toasts]));
    }, 4000);
  },
  error: (message: string) => {
    const id = crypto.randomUUID();
    toasts = [...toasts, { id, message, type: "error" }];
    toastListeners.forEach((listener) => listener([...toasts]));
    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
      toastListeners.forEach((listener) => listener([...toasts]));
    }, 5000);
  },
  info: (message: string) => {
    const id = crypto.randomUUID();
    toasts = [...toasts, { id, message, type: "info" }];
    toastListeners.forEach((listener) => listener([...toasts]));
    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
      toastListeners.forEach((listener) => listener([...toasts]));
    }, 4000);
  },
  warning: (message: string) => {
    const id = crypto.randomUUID();
    toasts = [...toasts, { id, message, type: "warning" }];
    toastListeners.forEach((listener) => listener([...toasts]));
    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
      toastListeners.forEach((listener) => listener([...toasts]));
    }, 5000);
  },
};

// ─── ToastContainer ──────────────────────────────────────────────────────────

export const ToastContainer = () => {
  const [currentToasts, setCurrentToasts] = useState<Toast[]>([]);
  const listenerRef = useRef<(toasts: Toast[]) => void>();

  listenerRef.current = (newToasts: Toast[]) => {
    setCurrentToasts(newToasts);
  };

  useEffect(() => {
    toastListeners.push(listenerRef.current!);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== listenerRef.current);
    };
  }, []);

  if (currentToasts.length === 0) return null;

  return (
    <div className="toast-container" role="region" aria-label="Notifications">
      {currentToasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
};

// ─── ToastItem ───────────────────────────────────────────────────────────────

const ToastItem = ({ toast }: { toast: Toast }) => {
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => setVisible(false), 300);
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      className={	oast toast--}
      role="alert"
    >
      <span className="toast-icon">
        {toast.type === "success" && "✓"}
        {toast.type === "error" && "✕"}
        {toast.type === "info" && "ℹ"}
        {toast.type === "warning" && "⚠"}
      </span>
      <span className="toast-message">{toast.message}</span>
      <button
        type="button"
        className="toast-close"
        onClick={() => {
          setExiting(true);
          setTimeout(() => setVisible(false), 300);
        }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
};