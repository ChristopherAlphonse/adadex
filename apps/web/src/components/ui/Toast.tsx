import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "info" | "warning";

export type Toast = {
  id: string;
  message: string;
  type: ToastType;
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

const toastToneClasses: Record<ToastType, string> = {
  success: "border-running/40 bg-running/10 text-primary",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
  info: "border-info/40 bg-info/10 text-[var(--color-info)]",
  warning: "border-stale/40 bg-stale/10 text-foreground",
};

export const ToastContainer = () => {
  const [currentToasts, setCurrentToasts] = useState<Toast[]>([]);
  const listenerRef = useRef<(toasts: Toast[]) => void>(undefined);

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
    <div className="fixed right-4 bottom-4 z-[200] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
      {currentToasts.map((item) => (
        <ToastItem key={item.id} toast={item} />
      ))}
    </div>
  );
};

const ToastItem = ({ toast: toastItem }: { toast: Toast }) => {
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
      className={cn(
        "flex items-start gap-2 border px-3 py-2 shadow-lg transition-all duration-300",
        toastToneClasses[toastItem.type],
        exiting && "translate-x-2 opacity-0",
      )}
      role="alert"
    >
      <span className="font-mono text-sm leading-none">
        {toastItem.type === "success" && "✓"}
        {toastItem.type === "error" && "✕"}
        {toastItem.type === "info" && "ℹ"}
        {toastItem.type === "warning" && "⚠"}
      </span>
      <span className="min-w-0 flex-1 text-[0.8rem] leading-snug">{toastItem.message}</span>
      <button
        type="button"
        className="cursor-pointer border-0 bg-transparent p-0 font-mono text-base leading-none opacity-70 transition-opacity hover:opacity-100"
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

