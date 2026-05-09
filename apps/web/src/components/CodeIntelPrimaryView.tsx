import { FileCode2, GitFork, PenLine, Terminal } from "lucide-react";

import { useCodeIntelRuntime } from "../app/hooks/useCodeIntelRuntime";
import { CodeIntelArcDiagram } from "./CodeIntelArcDiagram";
import { CodeIntelTreemap } from "./CodeIntelTreemap";
import { ActionButton } from "./ui/ActionButton";

type CodeIntelPrimaryViewProps = {
  enabled: boolean;
};

export const CodeIntelPrimaryView = ({ enabled }: CodeIntelPrimaryViewProps) => {
  const { events, treemapRoot, couplingData, isLoading, error, refresh } =
    useCodeIntelRuntime(enabled);

  if (isLoading && events.length === 0) {
    return (
      <section className="code-intel-view" aria-label="Code Intel primary view">
        <section className="code-intel-panel">
          <header className="code-intel-panel-header">
            <h2>Code Intel</h2>
            <p>Loading edit events...</p>
          </header>
        </section>
      </section>
    );
  }

  if (error) {
    return (
      <section className="code-intel-view" aria-label="Code Intel primary view">
        <section className="code-intel-panel">
          <header className="code-intel-panel-header">
            <h2>Code Intel</h2>
            <p className="code-intel-error">{error}</p>
          </header>
        </section>
      </section>
    );
  }

  if (events.length === 0) {
    return (
      <section className="code-intel-view" aria-label="Code Intel primary view">
        <section className="code-intel-panel">
          <header className="code-intel-panel-header">
            <h2>Code Intel</h2>
            <p>No edit events recorded yet. Events are tracked as agents edit files.</p>
          </header>
        </section>
      </section>
    );
  }

  return (
    <section className="code-intel-view" aria-label="Code Intel primary view">
      <header className="code-intel-view-header">
        <span className="code-intel-stat">
          <PenLine size={13} className="code-intel-stat-icon code-intel-stat-icon--edits" />
          <span className="code-intel-stat-value">{events.length}</span>
          <span className="code-intel-stat-label">edits</span>
        </span>
        <span className="code-intel-stat">
          <FileCode2 size={13} className="code-intel-stat-icon code-intel-stat-icon--files" />
          <span className="code-intel-stat-value">{couplingData?.files.length ?? 0}</span>
          <span className="code-intel-stat-label">files</span>
        </span>
        <span className="code-intel-stat">
          <Terminal size={13} className="code-intel-stat-icon code-intel-stat-icon--sessions" />
          <span className="code-intel-stat-value">
            {new Set(events.map((e) => e.sessionId)).size}
          </span>
          <span className="code-intel-stat-label">sessions</span>
        </span>
        <span className="code-intel-stat">
          <GitFork size={13} className="code-intel-stat-icon code-intel-stat-icon--pairs" />
          <span className="code-intel-stat-value">{couplingData?.pairs.length ?? 0}</span>
          <span className="code-intel-stat-label">pairs</span>
        </span>
        <ActionButton size="dense" variant="accent" onClick={refresh}>
          Refresh
        </ActionButton>
      </header>

      <div className="code-intel-panels">
        <section className="code-intel-panel code-intel-panel--treemap">
          <header className="code-intel-panel-header">
            <h2>Edit Frequency</h2>
            <p>File size = number of edits.</p>
          </header>
          {treemapRoot && <CodeIntelTreemap root={treemapRoot} />}
        </section>

        <section className="code-intel-panel code-intel-panel--coupling">
          <header className="code-intel-panel-header">
            <h2>Change Coupling</h2>
            <p>Files that change together in the same session.</p>
          </header>
          {couplingData && <CodeIntelArcDiagram data={couplingData} />}
        </section>
      </div>
    </section>
  );
};
