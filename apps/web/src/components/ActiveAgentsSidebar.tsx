import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from "react";
import { useRef } from "react";

import { clampSidebarWidth } from "../app/uiStateNormalizers";

type ActiveAgentsSidebarProps = {
  sidebarWidth: number;
  onSidebarWidthChange: (width: number) => void;
  actionPanel?: ReactNode;
  bodyContent?: ReactNode;
  threadTree?: ReactNode;
};

export const ActiveAgentsSidebar = ({
  sidebarWidth,
  onSidebarWidthChange,
  actionPanel = null,
  bodyContent,
  threadTree = null,
}: ActiveAgentsSidebarProps) => {
  const sidebarRef = useRef<HTMLElement | null>(null);

  const handleResizeMouseDown = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;

    const handleMouseMove = (event: MouseEvent) => {
      onSidebarWidthChange(clampSidebarWidth(event.clientX - sidebarLeft));
    };

    const stopResize = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopResize);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopResize);
  };

  const handleResizeKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const step = event.shiftKey ? 48 : 16;

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onSidebarWidthChange(clampSidebarWidth(sidebarWidth - step));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      onSidebarWidthChange(clampSidebarWidth(sidebarWidth + step));
    }
  };

  return (
    <div className="dashboard-deck-shell">
      <aside
        aria-label="Active Agents sidebar"
        className="active-agents-sidebar"
        ref={sidebarRef}
        style={{ width: `${sidebarWidth}px` }}
      >
        {actionPanel ? (
          <div className="active-agents-action-panel">{actionPanel}</div>
        ) : (
          <div className="active-agents-body">
            {threadTree}
            {bodyContent}
          </div>
        )}
        <button
          aria-label="Resize Active Agents sidebar"
          className="active-agents-border-resizer"
          data-testid="active-agents-border-resizer"
          onKeyDown={handleResizeKeyDown}
          onMouseDown={handleResizeMouseDown}
          type="button"
        />
      </aside>
    </div>
  );
};
