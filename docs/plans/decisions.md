# Tech lead decisions

Made on 2026-11-19, when the user asked for tech lead decisions on the open questions. Each entry says what was decided, why, what it costs, and whether it is built.

| # | Question | Decision | Status |
| --- | --- | --- | --- |
| 1 | Audit log: sign it or send it elsewhere? | Sign every line, anchor each chain's newest line in a separate file, allow offline verification. Ship to a central log later. | Built, except shipping |
| 2 | Loop default | Off globally, and off per workflow until the workflow opts in | Built |
| 3 | User identity | Record the operating system user on human actions now. Single sign-on and per-person approval rules later | Partly built |
| 4 | Stack skills | Each workflow names its skills. No detection from file names | Decided, nothing to build |
| 5 | Unblock | Back to the stage the job was parked from, with a fresh round allowance | Built |
| 6 | Provider | Claude Code only for now. No OpenCode adapter | Decided |
| 7 | Keep the machine awake while agents run | Yes, with Electron's power save blocker | Built |
| 8 | Delete factory's Python | Freeze it now. Delete only after the exit criteria below and on the user's explicit say-so | Decided, nothing deleted |
| 9 | Sandboxing agent processes | Do it next, as the main remaining hardening | Built (macOS) |
| 10 | Commits | The agent never commits. The user decides when and what to commit | Decided |

## 1. Audit log: signed, anchored, verifiable offline

**Why.** The chain alone detects edits but not someone who rewrites the whole chain consistently. A signature needs the private key, so a rewrite without the key fails. Removing the newest lines of a chain defeats both the chain and the signatures, so the newest line of each chain is also written to a separate anchor file, and a missing anchored line is reported. An auditor can check an export with only the public key.

**How.** Ed25519 key made per machine, wrapped by the operating system keychain in Electron (checked: the file on disk holds no readable key), mode 0600 otherwise. Each line stores a signature of its hash. Verification checks the chain, then each signature against the machine key, then the anchor, then the job record.

**Cost and limits.** Someone who has both the database and the keychain access of the logged-in user can still forge. The anchor file is local, so it protects against partial tampering, not against someone who can delete both. Real protection needs the anchor sent off the machine. `AnchorSink` is the seam for that, and nothing ships yet.

## 2. Loop: per-workflow opt-in

**Why.** A machine-wide switch is too coarse. Which workflows may run without a person watching is a decision about each workflow's risk.

**How.** `unattended` on a workflow, false unless set. The planner skips jobs of any other workflow and says why. The two presets are not unattended, so a person forks one to enable it. Turning the loop on at all still needs the native dialog.

## 3. Identity

**Why.** The audit trail should say who, but there is one user today, and single sign-on or approval rules have no consumer.

**How.** The operating system user name is written on every human action. Revisit when a second person uses the same machine or a shared server appears.

## 4. Stack skills

**Why.** Picking skills from file names is guesswork, and user-built workflows make it unnecessary: the workflow author names the skills.

## 5. Unblock

**Why.** "Back to build" was specific to factory's pipeline. Returning to the stage the job was parked from works for any workflow. A job parked for running out of rounds would otherwise be parked again at once, so unblocking gives it a fresh allowance.

**How.** The stage is restored, the reason is cleared, the round limit becomes the current round plus the default allowance, and the polish flag is cleared when going back to build.

## 6. Provider

**Why.** Claude Code only on the enterprise machine. Every extra provider is another surface to test against the policy and the hook. The provider port stays, so one can be added later.

## 7. Keep awake

**Why.** An unattended run that is cut off by sleep wastes work and leaves a half-done job. The shell blocks suspension while any agent or check is running and releases it when the last one ends.

## 8. The Python in `calphonse-skills`

**Decision.** Freeze it: no new features. Delete it only when all of these hold and the user says so:

1. The web board drives every action through the request layer, not the old HTTP routes.
2. The loop is used on at least one real project for a period the user is comfortable with, with no integrity failure.
3. The parity map in `phase-6-cutover.md` has no "Not ported" rows that the user has not chosen to drop.
4. The two skill files have been rewritten as short pointers to the app.

**Why.** It is the only working reference for behavior until then, and deleting it spans two repositories.

## 9. Sandbox (built)

**Why.** The tool policy cannot see inside an allowed program. `npm test` can write files. Reading the logs is also not blocked. An operating system sandbox around each agent process (a profile that allows the worktree and the job folder and nothing else) closes both. Built on macOS with the system sandbox. The app refuses to start an agent where no sandbox exists, unless it is turned off for development. Linux and Windows need their own implementations (for example a container or a namespace sandbox).

## 10. Commits

The app never commits for the agent, and I have not committed anything in this work. Other tools have been committing the working tree, and `.kiro/hooks/adadex.json` is currently staged. Someone should decide whether that automation should continue.
