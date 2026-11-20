import type { FactoryApproval } from "../../runtime/factoryHost";

type ApprovalCardsProps = {
  approvals: readonly FactoryApproval[];
  pendingKey: string | null;
  onRespond: (key: string, approval: FactoryApproval, approved: boolean) => void;
};

const approvalKey = (approval: FactoryApproval, approved: boolean): string =>
  `${approval.approvalId}:${approved}`;

export const ApprovalCards = ({ approvals, pendingKey, onRespond }: ApprovalCardsProps) => {
  return (
    <section aria-label="Approvals" className="rounded-lg border border-border bg-surface p-3">
      <h2 className="mb-2 text-[14px] font-semibold text-foreground">
        Approvals
        <span className="ml-2 font-mono text-[11px] font-normal text-muted-foreground">
          {approvals.length}
        </span>
      </h2>
      {approvals.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">Nothing waiting for approval.</p>
      ) : (
        <ul className="space-y-2">
          {approvals.map((approval) => (
            <li key={approval.approvalId} className="rounded border border-border bg-surface-2 p-2">
              <p className="text-[13px] text-foreground">{approval.reason}</p>
              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                {approval.actionId}
              </p>
              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  disabled={pendingKey === approvalKey(approval, true)}
                  aria-label={`Approve ${approval.actionId}`}
                  onClick={() => onRespond(approvalKey(approval, true), approval, true)}
                  className="rounded border border-primary/60 bg-primary/10 px-2 py-1 text-[12px] font-medium text-foreground hover:bg-primary/20 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={pendingKey === approvalKey(approval, false)}
                  aria-label={`Decline ${approval.actionId}`}
                  onClick={() => onRespond(approvalKey(approval, false), approval, false)}
                  className="rounded border border-border bg-background px-2 py-1 text-[12px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
