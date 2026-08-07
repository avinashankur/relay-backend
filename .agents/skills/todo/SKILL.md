---
name: todo
description: >
  Maintain a living TODO.md file that tracks all project tasks. Use this skill
  whenever you: create or update a TODO file, complete a task and need to mark it
  done, add new tasks discovered during development, encounter backlog items or
  TODOs in code, or need to update task status. Trigger this skill any time you
  touch the codebase and a task state changes — do not skip the TODO update step.
  The TODO.md is the single source of truth for the project; always keep it
  current.
---

# TODO Manager Skill

## Purpose

Maintain `TODO.md` as a **living, append-only document** — the single source
of truth for what is happening in this project. Every code change must be
accompanied by a TODO update.

---

## Core Rules

### IDs are permanent

- Each task carries a stable `PREFIX-NN` identifier.
- IDs are **never reused or renumbered** — inserting or removing a task does
  not affect any other ID.
- New tasks always get the **next unused number** within their prefix.
- Cross-reference format in code comments: `// See TODO.md [PREFIX-NN]`

### Prefixes are permanent

- Once a prefix is introduced it is **never renamed or deleted**.
- Similar tasks are always grouped under the same prefix.
- New prefixes may be created when a genuinely new workstream begins; add them
  to the prefix table in both `TODO.md` and this skill file.

### Standard prefixes

| Prefix  | Workstream                    |
| ------- | ----------------------------- |
| `REPO`  | Product Naming & Repo Hygiene |
| `AUTH`  | Core Auth API Completion      |
| `SEC`   | Session & Security Hardening  |
| `EMAIL` | Email & Background Processing |
| `TEST`  | Testing & Quality Gates       |
| `DOCS`  | Documentation & Operations    |

> Add new rows here when a new prefix is introduced. Never remove rows.

### Statuses

`Not started` | `In progress` | `Done`

### Priorities

| Level | Meaning       |
| ----- | ------------- |
| `P0`  | Critical path |
| `P1`  | Important     |
| `P2`  | Nice to have  |

---

## File Structure

`TODO.md` has two top-level sections in this fixed order:

```
TODO.md
├── ## Tasks         ← One flat table per prefix, in canonical prefix order.
│   ├── #### REPO      All statuses live in the same table — no Active/Backlog/Done split.
│   ├── #### AUTH      Newest task at the top of each prefix table.
│   └── #### …
│
└── ## Milestones    ← Named delivery phases with bullet summaries and a progress emoji.
                       Updated when phase scope or completion status changes.
```

**Prefix ordering** always follows the canonical prefix table top-to-bottom.
Prefixes with no tasks yet are omitted until their first task is added.

**Ordering within a prefix table:** newest task at the top. Because all
statuses share one table, a reader can scan the full history of a workstream
in one glance — open items at the top, done items below.

**Why this layout?**
Every write touches exactly **one row** in exactly **one prefix table**.
No rows move between sections when status changes — only the STATUS cell
is updated in place. Git diffs are always a single-line change.

All meta-information (Definition of Done, prefix registry, editing rules)
lives in this skill file, not in `TODO.md`.

---

## Task Row Format

```markdown
| ID        | PRIORITY | STATUS      | Summary                                      |
| --------- | -------- | ----------- | -------------------------------------------- |
| PREFIX-NN | P0/P1/P2 | Not started | One-line description of the work to be done. |
```

- **Summary**: one line, imperative mood ("Add rate limiting to login endpoint").
- No inline sub-tasks or long descriptions — link to a doc, PR, or issue instead.

---

## How to Edit TODO.md

### Adding a new task

1. Determine the correct prefix for the workstream.
2. Scan the prefix table for the highest existing `NN` → use `NN+1`.
3. **Prepend** the new row immediately below the table header — top of the prefix table.
   - If the prefix table doesn't exist yet, create it in canonical prefix-table
     order with a `#### PREFIX` heading and a table header row.
4. Touch nothing else.

### Updating task status

- Find the row by ID and update only the STATUS cell in place.
- **Do not move the row.** Rows never migrate between tables or sections.
- Status transitions: `Not started` → `In progress` → `Done`

### Discovering a code TODO / backlog item

- Add it immediately as a new row at the top of the correct prefix table.
- Assign the next unused ID for that prefix.

### Updating Milestones

- Update the progress emoji (✅ / 🔄 In progress / no emoji = not started)
  when a phase completes or begins.
- Add bullet points for new phases as scope expands.
- Never remove a completed phase.

---

## When to Update TODO.md

| Trigger                                    | Action                                       |
| ------------------------------------------ | -------------------------------------------- |
| Starting a new task                        | Update STATUS to `In progress` in place      |
| Finishing a task                           | Update STATUS to `Done` in place             |
| Discovering a `// TODO` or `FIXME` in code | Prepend new row to correct prefix table      |
| Scope change / new feature request         | Prepend new row with appropriate prefix      |
| Phase completes or begins                  | Update Milestones progress emoji and bullets |

---

## What NOT to Do

- ❌ Never delete a task row.
- ❌ Never reuse or renumber IDs.
- ❌ Never rename or remove a prefix.
- ❌ Never move a row when its status changes — update the cell in place.
- ❌ Never add Active / Backlog / Done section headers to TODO.md.
- ❌ Never add long descriptions inline — link out instead.
- ❌ Never leave TODO.md stale after a code change.

---

## Definition of Done

- Every item maps either to observed repo state or to a clearly labeled capability gap.
- No task implies that unimplemented capabilities already exist.
- `P0` items focus on correctness, security-critical behavior, and test coverage.
- Another engineer can use this file as the repo's execution backlog without reinterpreting vague goals.
- Every task has a stable `PREFIX-NN` ID referenceable from code as `// See TODO.md [PREFIX-NN]`.

---

## Example TODO.md

See `references/TODO.example.md` for a fully populated example file.
