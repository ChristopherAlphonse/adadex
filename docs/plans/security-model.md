# Security model: roles, autonomy and integrity

This describes what the app enforces, where, and what it does not cover. Each control below is checked by a test or by a live run against real Claude Code. The gaps at the end matter as much as the controls.

## The rule

An agent has exactly the autonomy its **role** gives it. A person decides the role. The role is fixed for the run. No action, tool or file an agent can reach changes it.

## How a role works

- A **role** (`RoleDefinition`) lists the actions an agent may call, the stages it may move a job to, the tools it may use, the extra shell commands it may run, the documents it may write in the job's folder, whether it may edit code, and a budget (most calls, longest run).
- A **stage** of a workflow names its role. A stage with no role waits for a person.
- When a run starts, the app reads the role from the workflow a person wrote, binds it to the run (run id, role, job, stage, start time) and freezes it. The agent is never asked which role to use.
- Roles live in the machine's data folder, which no agent can write. A role file that does not validate is ignored, so a damaged or edited file grants nothing.

## Why an agent cannot switch roles or widen its own

| Attempt | What stops it | Checked by |
| --- | --- | --- |
| Ask the app to change its role | There is no such action. The registry has nothing named role, grant, permission or autonomy | Test, and a live run where the agent tried `role.set` and was refused |
| Move the job to a stage that has a stronger role | A role may only move a job to the stages in its own `advanceTo`. The next run's role comes from that stage's definition, which a person wrote | Test: a builder cannot move a job to review or ready |
| Run a human-only action (approve the spec, commit, unblock) | A role can never list one (`parseRole` refuses). The action host also refuses an agent for a human-class action. Only a native OS dialog, which the page and the agent cannot press, runs it | Tests, and a live run |
| Write a stronger role into the roles folder | The folder is outside every agent's writable places | Test |
| Write the workflow so a stage has a stronger role | Workflows are saved only through the UI request layer, which agents do not have | By design; the agent's only channel is the one MCP tool |
| Edit its own budget | The budget is part of the role | By design |

A role can only **narrow** what the registry would allow. It cannot relax a deny rule, a protected file, or the human-only class.

## Least privilege per role

- Read-only roles (reviewer, verifier, planner and others) cannot change code: writes are limited to the job's folder.
- Only builder and polisher edit code.
- Every role may write only its own documents in the job's folder. A builder cannot write the spec, the review verdicts or the UAT notes; a reviewer cannot rewrite the build notes.
- No role may write `job.json`, `audit.log` or any `checks.md`. `parseRole` refuses to grant them, and the policy denies them again at run time.
- No role has a network tool. Tools outside the list are refused when a role is saved.
- Extra shell commands can only be added to the allow list. Deny and ask rules always win, and a pattern that starts with a wildcard is refused.

## Separation of duties

The agent that builds cannot write the review verdicts, the gate result or the commit. The gate result is written by the app. The commit is made by a person's click, in the job's own worktree, of exactly the files the gate checked.

## Logs: one local SQLite database

Everything the app logs goes into one SQLite file on the machine: `<data folder>/logs/adadex.db`. It uses Node's built-in SQLite, so there is no extra dependency (Node 22.13 or newer; Electron 45 ships Node 24).

- **Two tables, two jobs.** `audit` is the per-job chain of what was done and by whom. `events` is the operational log: guard decisions, approvals asked and answered, processes started, stopped and killed, run start, end and limit stops, the loop's decisions, integrity failures, app start and stop. The UI reads events through `logs.query` (filter by job, run, role, source, level, time) and checks a job's chain through `audit.verify`.
- **Owner only.** The file is mode 0600 in a folder of mode 0700. It sits in the data folder, which no agent may write.
- **Durable.** Write-ahead logging with full sync, so a crash does not lose a line. Appends run in a transaction, so two writers cannot extend the same line.
- **Append-only audit.** The table has triggers that refuse any update or delete, and a unique rule that refuses a second line after the same line, so a chain cannot be forked.
- **Redacted before writing.** Keys, tokens, bearer headers, cloud access keys, private key blocks and `password=`-style values are replaced with `[redacted]` in messages, details and data.
- **Retention.** Events older than 90 days are deleted at start (configurable). The audit chain is never pruned.
- **Projects are kept apart** in one database by a hash of the project folder.
- **A logging failure never stops work.**

## Integrity

- **Tamper-evident audit log.** Every line carries the hash of the line before it and the hash of the job record at that moment. An edited, deleted, reordered or forged line breaks the chain, even if someone with the database file removes the triggers first. A job record changed outside the app is detected too.
- **A gate result counts only if the audit log vouches for it.** `checks.md` is believed only when the app's own audit line for the same round says the same verdict and tree. A file an agent wrote, or a verdict edited from FAIL to PASS, counts as "gate not run".
- **Check before every run.** The role runner verifies the chain before it starts an agent. A broken chain stops the run and parks the job on a person with the reason.
- **Signed lines and offline verification.** Each line carries an Ed25519 signature. A line that is unsigned, signed by another key, or whose signature fails is reported. An export of a chain with its public key can be verified by an auditor without the app.
- **Anchors.** The newest line of each chain is also written to a separate file. If lines are removed, the anchor names a line the database no longer has.
- **Every call is attributed.** Each agent call, run start, run end and limit stop is logged with the role and run id.

## Autonomy and limits

- The unattended loop is **off until a person turns it on**. It starts an agent only at a stage with a role, one run per job, up to a concurrency limit, and never for a job that is held for a person.
- A run is stopped when it uses its role's call budget or time budget.
- A job whose runs keep ending where they began is parked on a person after a set number of runs.
- A refused or failed run counts as a run that moved nothing, so a broken job cannot loop.
- Quitting the app stops every running agent and declines every waiting approval.

## The operating system sandbox

Each agent process runs inside a macOS sandbox profile built for its run, behind the tool policy:

- It may write its job folder, scratch space, its own settings, and package caches. A role that edits code may also write its worktree and that worktree's git folder. Every other place on disk is read-only.
- It may never write the job record, any `checks.md`, the worktree's `.git` entry, or the git `config` and `config.worktree` files. Those are what hold the commit lock, so an allowed program cannot repoint git at different hooks.
- It may not read the app's data folder or common credential folders.
- Checked with the real sandbox, and live with Claude Code: an allowed `npm test` whose script wrote outside the project was refused, the app's database and keys could not be read, and a legitimate write still worked.

## Tool and file policy

- Every tool call an agent makes passes through a hook that asks the app first, and blocks on any doubt (app not reachable, unreadable call, no answer in time).
- Paths are compared as real paths, with symlinks resolved. A bug of exactly this kind was found while testing: rules written with an unresolved folder never matched a resolved write, so a role's folder scope silently did nothing. Rule folders are now resolved too, and a test covers it.
- Pushing and opening a PR are impossible: the git layer has no push or remote operation, and the registry refuses to register one. In a job's worktree, `git commit`, `git push` and moving the job's branch also fail unless the human key is present, which lives only in app memory.

## Not covered. Read this before an enterprise review.

1. **The audit log is signed and anchored, but both stay on the machine.** Every line is signed with a per-machine key (wrapped by the OS keychain in Electron), and each chain's newest line is copied to a separate anchor file. Rewriting a chain now needs the key, and removing newest lines is caught by the anchor. Someone who has the key and can delete both files can still forge. Sending the anchor off the machine (`AnchorSink`) is the next step, and nothing ships yet.
1a. ~~An agent can read the database.~~ Closed on macOS: the sandbox denies reads of the app's data folder (logs, keys, roles) and of common credential folders (`.ssh`, `.aws`, `.gnupg`, `.kube`, `gcloud`, `gh`, `.netrc`, Docker config). Checked live: an allowed `cat` of the database failed.
2. **Identity is the operating system user.** Human actions record the OS user name. There is no sign-in, single sign-on or per-person approval rule. Needed for any multi-person use.
3. **An allowed program can do what an allowed command cannot, inside the places it may write.** `npm test` or a build tool runs project code. The operating system sandbox now limits it to the job folder and (for roles that edit code) the worktree, so it cannot write elsewhere. Inside the worktree it can still write anything the role may edit. The sandbox is macOS only; on another system the app refuses to start an agent unless the sandbox is turned off for development.
4. **Sub-agents.** Whether Claude Code's tool hook also runs for a sub-agent's tool calls was not tested.
5. **The loop has no UI or request yet.** The scheduler exists and is tested, but nothing in the request layer turns it on, and turning it on should itself need a native confirmation. The roles and workflow editors are not built either.
6. **Budgets are per run.** There is no organization-wide or per-day budget.
7. **Roles are tested against Claude Code only.** OpenCode and Kiro were not tested.
8. **A person with a shell on the machine** can edit the roles folder, the workflow files and the audit log. The app protects against agents, not against its own operator.
9. **Reviewers share one verdict pattern.** A reviewer can write any `round-N/review-*.md`, so one reviewer could overwrite another's verdict. Giving each reviewer its own role would close it.
