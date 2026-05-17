import { useEffect, useMemo, useState } from "react";

import { AdadexConsoleCanvas } from "./AdadexConsoleCanvas";
import { AdadexConsoleFooter } from "./AdadexConsoleFooter";
import { AdadexConsoleHeader } from "./AdadexConsoleHeader";
import { AdadexConsoleInspector } from "./AdadexConsoleInspector";
import { AdadexConsoleToolbar } from "./AdadexConsoleToolbar";
import { DEMO_AGENTS } from "./data";

export const AdadexConsole = (): React.ReactElement => {
  const [selectedId, setSelectedId] = useState("deck-lead");
  const [hideIdle, setHideIdle] = useState(false);

  const lead = DEMO_AGENTS[0]!;
  const visible = useMemo(
    () => (hideIdle ? DEMO_AGENTS.filter((a) => a.status !== "idle") : DEMO_AGENTS),
    [hideIdle],
  );
  const agent = visible.find((a) => a.id === selectedId) ?? visible[0] ?? lead;

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Adadex — Agent Orchestration Console";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <div className="design-console flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      <AdadexConsoleHeader />
      <AdadexConsoleToolbar hideIdle={hideIdle} onToggleHideIdle={() => setHideIdle((v) => !v)} />

      <div className="flex min-h-0 flex-1">
        <AdadexConsoleCanvas
          agents={visible}
          lead={lead}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <AdadexConsoleInspector agent={agent} />
      </div>

      <AdadexConsoleFooter visibleCount={visible.length} totalCount={DEMO_AGENTS.length} />
    </div>
  );
};
