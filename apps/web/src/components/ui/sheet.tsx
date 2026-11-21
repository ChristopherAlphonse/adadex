import { X } from "lucide-react";
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "../../lib/utils";

/**
 * shadcn-style Sheet (same API as `ui.shadcn.com/docs/components/sheet`), without the Radix
 * dependency. Closes on Escape or overlay click, moves focus into the panel and restores it on
 * close. Swap for the Radix-backed version if `@radix-ui/react-dialog` is ever added.
 */
type SheetContextValue = { open: boolean; onOpenChange: (open: boolean) => void };

const SheetContext = createContext<SheetContextValue | null>(null);

const useSheetContext = (): SheetContextValue => {
  const context = useContext(SheetContext);

  if (!context) {
    throw new Error("Sheet components must be rendered inside <Sheet>.");
  }

  return context;
};

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

export const Sheet = ({ open, onOpenChange, children }: SheetProps) => (
  <SheetContext.Provider value={{ open, onOpenChange }}>{children}</SheetContext.Provider>
);

const getPortalTarget = (): HTMLElement =>
  // Portal inside the console shell so the theme variables still apply.
  document.querySelector<HTMLElement>(".design-console") ?? document.body;

export const SheetContent = ({
  className,
  children,
  ...props
}: ComponentProps<"div"> & { children: ReactNode }) => {
  const { open, onOpenChange } = useSheetContext();
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    panelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open, onOpenChange]);

  if (!open) {
    return null;
  }

  return createPortal(
    <>
      <div
        aria-hidden="true"
        className="animate-in fade-in-0 fixed inset-0 z-[200] bg-black/40 duration-200"
        onClick={() => {
          onOpenChange(false);
        }}
      />
      <div
        aria-modal="true"
        className={cn(
          "animate-in slide-in-from-right fixed inset-y-0 right-0 z-[210] flex h-full w-[min(760px,94vw)] flex-col border-l border-border bg-background text-foreground shadow-2xl outline-none duration-200",
          className,
        )}
        ref={panelRef}
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- native dialog changes deck sheet layout/focus behavior
        role="dialog"
        tabIndex={-1}
        {...props}
      >
        {children}
        <button
          aria-label="Close"
          className="absolute top-4 right-4 grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          onClick={() => {
            onOpenChange(false);
          }}
          type="button"
        >
          <X size={16} />
        </button>
      </div>
    </>,
    getPortalTarget(),
  );
};

export const SheetHeader = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    className={cn("flex flex-col gap-1.5 border-b border-border p-6 pr-14", className)}
    {...props}
  />
);

export const SheetTitle = ({ className, children, ...props }: ComponentProps<"h2">) => (
  <h2 className={cn("text-lg font-semibold text-foreground", className)} {...props}>
    {children}
  </h2>
);

export const SheetDescription = ({ className, ...props }: ComponentProps<"p">) => (
  <p className={cn("text-sm text-muted-foreground", className)} {...props} />
);

export const SheetBody = ({ className, ...props }: ComponentProps<"div">) => (
  <div className={cn("flex flex-1 flex-col gap-6 overflow-y-auto p-6", className)} {...props} />
);

export const SheetFooter = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    className={cn("flex items-center justify-end gap-2 border-t border-border p-4", className)}
    {...props}
  />
);
