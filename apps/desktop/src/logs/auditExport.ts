import { type AuditRow, GENESIS, lineHash } from "./logDb";
import { verifySignature } from "./signer";

/** A job's audit chain with the public key that signed it, as a file an auditor can check without the app. */
export interface AuditExport {
  readonly version: 1;
  readonly project: string;
  readonly jobId: string;
  readonly publicKey: string;
  readonly keyId: string;
  readonly rows: readonly AuditRow[];
}

export type ExportVerdict =
  | { readonly ok: true; readonly entries: number }
  | { readonly ok: false; readonly reason: string };

/** Check an export on its own: the chain, and every signature against the key in the export. */
export const verifyAuditExport = (exp: AuditExport): ExportVerdict => {
  let prev = GENESIS;
  for (const [i, row] of exp.rows.entries()) {
    if (row.prev !== prev)
      return { ok: false, reason: `line ${i + 1} does not follow the line before it` };
    if (row.hash !== lineHash(prev, row)) return { ok: false, reason: `line ${i + 1} was changed` };
    if (row.sig === undefined || row.keyId !== exp.keyId)
      return { ok: false, reason: `line ${i + 1} is not signed by the exported key` };
    if (!verifySignature(exp.publicKey, row.hash, row.sig))
      return { ok: false, reason: `line ${i + 1} has a signature that does not verify` };
    prev = row.hash;
  }
  return { ok: true, entries: exp.rows.length };
};
