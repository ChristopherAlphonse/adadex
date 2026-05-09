import type { TerminalSnapshotReader } from "../ports/TerminalSnapshotReader";

const byCreatedAtAscending = (a: string, b: string): number =>
  new Date(a).getTime() - new Date(b).getTime();

export const buildTerminalList = async (
  reader: TerminalSnapshotReader,
): Promise<Awaited<ReturnType<typeof reader.listTerminalSnapshots>>> => {
  const snapshots = await reader.listTerminalSnapshots();
  return [...snapshots].sort((left, right) =>
    byCreatedAtAscending(left.createdAt, right.createdAt),
  );
};
