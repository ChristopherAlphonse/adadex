import type { TerminalSnapshot } from "../domain/terminal";
import type { TerminalSnapshotReader } from "../ports/TerminalSnapshotReader";

export class InMemoryTerminalSnapshotReader implements TerminalSnapshotReader {
  constructor(private readonly snapshots: TerminalSnapshot[]) {}

  async listTerminalSnapshots(): Promise<TerminalSnapshot[]> {
    return this.snapshots;
  }
}
