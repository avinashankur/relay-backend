---
trigger: always_on
description: >
---

## 1. Purpose

This skill governs two tightly coupled responsibilities:

1. **TODO.md** — the canonical engineering backlog. Every planned or in-flight
   unit of work that matters to the project must have a corresponding entry here.
2. **In-code `// TODO(Px):` comments** — short-lived, inline reminders for
   intentionally deferred logic. Every meaningful inline TODO must cross-reference
   TODO.md by stable task ID so it cannot be silently abandoned.

The agent must keep these two artefacts consistent at all times.

## 2. TODO.md Schema

### 2.1 Priority Levels

| Tag  | Meaning                                                       |
| ---- | ------------------------------------------------------------- |
| `P0` | Critical path — blocks a usable, shippable, or testable state |
| `P1` | Important hardening, delivery, or maintainability work        |
| `P2` | Follow-on expansion, polish, or documentation                 |

Never introduce a `P0` without a clear explanation of what it blocks.

### 2.2 Status Markers

| Marker        | Meaning                                                          |
| ------------- | ---------------------------------------------------------------- |
| `Not started` | No work has begun                                                |
| `In progress` | Active work underway in this or a recent session                 |
| `Blocked`     | Work cannot proceed — blocker must be named inline               |
| `Done`        | Acceptance criteria met; verified by typecheck, tests, or review |

A task may never jump from `Not started` directly to `Done` in a single agent
turn without evidence (test output, typecheck result, or explicit user confirmation).

### 2.3 Task ID Scheme

Each task carries a **stable `PREFIX-NN` identifier**. IDs are never reused or
renumbered — inserting or removing a task does not affect any other ID. New
tasks always get the next unused number within their prefix.

| Prefix  | Workstream                    |
| ------- | ----------------------------- |
| `REPO`  | Product Naming & Repo Hygiene |
| `AUTH`  | Core Auth API Completion      |
| `SEC`   | Session & Security Hardening  |
| `EMAIL` | Email & Background Processing |
| `TEST`  | Testing & Quality Gates       |
| `DOCS`  | Documentation & Operations    |

When adding a new workstream, choose a short ALL-CAPS prefix (≤6 chars) and
add it to both this table and the table in `TODO.md`.

Cross-reference format in code comments: `See TODO.md [PREFIX-NN]`

### 2.4 Line Format

```
- [<checkbox>] `<id>` `<priority>` `<status>` <imperative-sentence description>.
```

- Checkbox is `[x]` when `Done`, `[ ]` otherwise.
- ID comes first (after the checkbox) so it is visible without reading the full line.
- Description must be an **imperative sentence** (starts with a verb: "Add",
  "Finish", "Decide", "Remove").
- If a task is `Blocked`, append: ` Blocked on: <reason or linked task ID>.`

### 2.5 Section Structure

Sections are numbered workstreams (`### 1. …`, `### 2. …`). Each has:

- A one-line `Goal:` statement.
- Ordered list of tasks (P0 first, then P1, then P2 within each workstream).

Do not reorder tasks arbitrarily — insert new items at the correct priority
position within the existing workstream. IDs are assigned sequentially in the
order tasks are _created_, not in priority order, so IDs within a section may
not be numerically sorted by priority.

### 2.6 Milestones and Definition of Done

The `## Near-Term Milestones` and `## Definition Of Done` sections describe
cross-cutting acceptance criteria for phases. Update them when:

- A phase completes (all P0s in that phase are `Done`).
- Scope changes significantly.

---

## 3. In-Code Comment Taxonomy

### 3.1 Marker Reference

| Marker           | When to use                                                   |
| ---------------- | ------------------------------------------------------------- |
| `// TODO(P0):`   | Deferred logic that blocks correctness or safety              |
| `// TODO(P1):`   | Deferred hardening, validation, or observability              |
| `// TODO(P2):`   | Deferred polish, documentation, or nice-to-have improvements  |
| `// FIXME:`      | Known bug or broken behaviour — always P0-level urgency       |
| `// HACK:`       | Intentional shortcut — must describe what the correct fix is  |
| `// SECURITY:`   | Security-sensitive code requiring explicit review before ship |
| `// DEPRECATED:` | API or function that should not be called in new code         |
| `// BREAKING:`   | Change that breaks existing callers — document migration path |

### 3.2 Required TODO Comment Format

```ts
// TODO(P<n>): <imperative description of what needs to happen>.
// <Optional: condition that must be true before this is safe to enable.>
// See TODO.md [PREFIX-NN].
// <commented-out deferred code below, if any>
```

**Mandatory fields:**

- Priority tag `(P0)` / `(P1)` / `(P2)`.
- One-line imperative description.
- `See TODO.md [PREFIX-NN]` — the stable ID ensures the link survives any
  backlog reordering or renaming of the task description.

**Optional but strongly recommended:**

- A precondition line ("once X is validated / policy is decided / feature flag enabled").
- A link to a GitHub issue or PR if one exists.

### 3.3 FIXME / HACK / SECURITY Format

```ts
// FIXME: <description of the broken behaviour and repro if known>.
// HACK: <why this shortcut was taken and what the correct approach looks like>.
// SECURITY: <what the risk is and what review/change is required before ship>.
```

These markers do **not** require a `TODO.md` cross-reference, but the agent
should evaluate whether the issue warrants a backlog entry with a new ID.

### 3.4 Stale Comment Policy

A `// TODO(Px):` comment becomes stale when its corresponding `TODO.md` entry
is marked `Done`. When the agent marks a task Done, it must:

1. Run `grep -rn "\[PREFIX-NN\]" src/` to find every comment referencing that ID.
2. Either remove them (if the deferred code was implemented) or update the
   comment to reflect the new state.
3. If a comment's deferred code was promoted to real code, delete the comment
   entirely — do not leave a `// Previously a TODO` note.

---

## 4. Sync Protocol — Code ↔ TODO.md

The agent must apply the following rules every time it touches either artefact.

### 4.1 When completing a task

1. Mark the `TODO.md` entry: `[x]`, status → `Done`.
2. Run `grep -rn "\[PREFIX-NN\]" src/` to find inline comments referencing it.
3. Remove or update those comments as appropriate (§3.4).

### 4.2 When discovering new deferred work

1. Determine the next unused ID in the relevant prefix.
2. Add a `// TODO(Px):` comment at the deferral site with the full required
   format (§3.2), including the new `[PREFIX-NN]` ID.
3. Add a corresponding entry to `TODO.md` in the correct workstream and
   priority position, status `Not started`.
4. If the work is a direct consequence of an in-progress task, mark the
   parent task `In progress` if it is not already.

### 4.3 When starting work on a task

Update the `TODO.md` entry status to `In progress` at the beginning of the
session. Do not leave it as `Not started` while actively making changes.

### 4.4 When a task becomes blocked

1. Update status → `Blocked`.
2. Append `Blocked on: <reason or linked task ID>` to the task description.
3. Do not silently leave a task as `In progress` if it cannot proceed.

### 4.5 Cross-session continuity

At the start of any session where TODO.md is in scope, the agent should:

- Read the current state of TODO.md.
- Note all `In progress` items and verify they are still accurate.
- Identify `Blocked` items and check if the blocker has been resolved.

---

## 5. Audit Procedure

When the user asks for a backlog audit, a codebase review, or when the agent
detects significant drift, run the following checks in order:

### 5.1 Code → Backlog scan

```bash
# Find all structured TODO/FIXME/HACK/SECURITY markers
grep -rn "// TODO\|// FIXME\|// HACK\|// SECURITY\|// DEPRECATED\|// BREAKING" src/
```

For each result:

- Verify a `TODO.md` entry exists for the referenced `[PREFIX-NN]` ID.
- Flag any `// TODO` comment that lacks a priority tag — these are legacy
  comments that must be upgraded or removed.
- Flag any comment whose linked `TODO.md` entry is already `Done` (stale).

### 5.2 Backlog → Code scan

For every `In progress` task in `TODO.md`:

- Run `grep -rn "\[PREFIX-NN\]" src/` to verify at least one reference exists,
  OR confirm that a file in `src/` was recently modified for this task.
- If no evidence of activity exists, revert status to `Not started`.

### 5.3 Priority drift check

Scan for `P0` tasks that have been `Not started` or `Blocked` across more than
one milestone phase. Surface these to the user with a recommendation to either
descope (move to P1/P2) or prioritise immediately.

### 5.4 Orphaned comments

Flag any `// TODO` comment that does not follow the `// TODO(P<n>):` format
and/or lacks a `See TODO.md [PREFIX-NN]` cross-reference. These are legacy
comments that must be upgraded or removed.

### 5.5 ID integrity check

Verify no two tasks in `TODO.md` share the same `PREFIX-NN` ID. If a task was
deleted, confirm its ID is not reused by any subsequent entry.

---

## 6. Agent Behaviour Rules

These are hard constraints the agent must follow at all times.

1. **Never silently skip a status update.** If the agent completes a task, it
   must update `TODO.md` in the same turn.

2. **Never mark `Done` without evidence.** Accepted evidence: typecheck exits 0,
   test suite passes, user explicitly confirms, or the route/handler is
   demonstrably wired end-to-end.

3. **Never create a `TODO(P0)` without a `TODO.md` entry.** P0-level inline
   comments with no backlog counterpart will be missed by milestone planning.

4. **Always assign a stable ID before writing a new task.** Determine the next
   unused `PREFIX-NN` ID, use it in the code comment and the `TODO.md` entry
   simultaneously. Never write a `TODO.md` entry without an ID.

5. **Keep descriptions imperative.** Task titles always start with a verb.
   Avoid noun phrases like "Email verification" — use "Add email verification
   callback endpoint".

6. **Preserve existing history.** Do not delete or rewrite `Done` entries.
   The completed items are a project changelog. Only edit their description if
   it contains a factual error.

7. **One entry per concern.** Do not bundle unrelated changes into a single
   task. If a task is discovered to contain two independent concerns, split it
   and assign each part its own new ID.

8. **Escalate scope creep.** If completing a task reveals significant unplanned
   work (more than ~1 hour of effort), surface it as a new `TODO.md` entry
   (with a new ID) before proceeding, and ask the user whether to continue or
   defer.

9. **Never reuse or renumber IDs.** If a task is deleted, its ID is retired.
   The next task in that prefix always increments from the highest existing ID,
   even if there are gaps.

## 8. Quick-Reference Cheat Sheet

```
# Updating a task to Done
- [x] `AUTH-03` `P0` `Done` <original description>.

# Adding a new task (next unused ID in prefix)
- [ ] `SEC-07` `P1` `Not started` <imperative description>.

# Marking blocked
- [ ] `AUTH-08` `P1` `Blocked` <description>. Blocked on: <reason or SEC-02>.

# Inline TODO (required format)
// TODO(P1): <what needs to happen>.
// <Optional precondition line.>
// See TODO.md [AUTH-08].
// <commented-out code, if any>

# Inline FIXME (no cross-ref required, but consider a backlog entry)
// FIXME: <broken behaviour description>.

# Inline SECURITY (always flag for review, always consider a backlog entry)
// SECURITY: <risk description and required remediation>.

# Grep for all references to a specific task
grep -rn "\[SEC-01\]" src/
```
