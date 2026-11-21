import { cleanup, render, screen } from "@testing-library/react";
import { type ReactNode, useCallback, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { ConversationsPrimaryView } from "../src/components/ConversationsPrimaryView";

// A regression throws from the callback once this guard trips, so a broken
// build fails fast instead of hanging the whole test run.
const LOOP_GUARD = 10;

describe("ConversationsPrimaryView sidebar handoff", () => {
  afterEach(() => {
    cleanup();
  });

  it("pushes sidebar content to the parent without re-rendering endlessly", () => {
    let sidebarPushes = 0;
    let actionPanelPushes = 0;

    // Mirrors AppShell: the parent stores pushed content in state, so an unstable
    // push effect would otherwise re-render the view forever.
    const ParentHarness = () => {
      const [sidebarContent, setSidebarContent] = useState<ReactNode>(null);
      const [actionPanel, setActionPanel] = useState<ReactNode>(null);

      const onSidebarContent = useCallback((content: ReactNode) => {
        sidebarPushes += 1;

        if (sidebarPushes > LOOP_GUARD) {
          throw new Error("sidebar content pushed repeatedly — render loop");
        }

        setSidebarContent(content);
      }, []);

      const onActionPanel = useCallback((content: ReactNode) => {
        actionPanelPushes += 1;

        if (actionPanelPushes > LOOP_GUARD) {
          throw new Error("action panel pushed repeatedly — render loop");
        }

        setActionPanel(content);
      }, []);

      return (
        <>
          <div data-testid="sidebar-slot">{sidebarContent}</div>
          <div data-testid="action-panel-slot">{actionPanel}</div>
          <ConversationsPrimaryView
            enabled={false}
            onSidebarContent={onSidebarContent}
            onActionPanel={onActionPanel}
          />
        </>
      );
    };

    render(<ParentHarness />);

    expect(screen.getByTestId("sidebar-slot")).not.toBeEmptyDOMElement();
    expect(sidebarPushes).toBeLessThan(LOOP_GUARD);
    expect(actionPanelPushes).toBeLessThan(LOOP_GUARD);
  });
});
