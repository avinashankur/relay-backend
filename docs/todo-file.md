how to create the todo file and maintain it:

- keep it updated with the latest changes in the project
- whenever you do some changes in the codebase, update the todo file
- if a task is complete, mark it as done but do not remove it
- add new tasks to the todo file as needed
- any backlog items in the codebase should be noted down in here
- the todo can have three status: Not started, In progress, Done
- there can be three priorites: P0, P1, P2
- P0 is for the critical path items
- P1 is for the important items
- P2 is for the nice to have items
- each task should have a unique ID
- each task carries a stable `PREFIX-NN` identifier. IDs are **never reused or renumbered** — inserting or removing a task does not affect any other ID. New tasks always get the next unused number within their prefix.

| Prefix  | Workstream                    |
| ------- | ----------------------------- |
| `REPO`  | Product Naming & Repo Hygiene |
| `AUTH`  | Core Auth API Completion      |
| `SEC`   | Session & Security Hardening  |
| `EMAIL` | Email & Background Processing |
| `TEST`  | Testing & Quality Gates       |
| `DOCS`  | Documentation & Operations    |

For each task, include:

- `STATUS`: `Not started | In progress | Done`
- `PRIORITY`: `P0 | P1 | P2`
- `ID`: `PREFIX-NN` (never reuse or renumber IDs)
- A summary of the work

- the prefix should be the first 4 letters of the workstream (e.g. `REPO`, `AUTH`, `SEC`, `EMAIL`, `TEST`, `DOCS`)
- the number should be the next unused number within their prefix
- after a prefix is created, it should not be changed or deleted later. similar tasks should always be added under the same prefix. this is for the stability of the IDs.
- new prefix's can be created if needed, but it should not be changed or deleted later.

- after a certain time, all the tasks will be completed. at that time, we will keep adding new tasks to the todo file as needed.
- add new todos at the beginning of the todo file (top priority for you to work on). this way devs wont need to scroll all the way down. (implement a better way if you can think of one)
- the todo file should always be updated with the latest changes in the project, and it should be a single source of truth for the project.
- this todo file should be a living document that is constantly updated as the project evolves.
- the todo file should not contain any irrelevant information
- the todo file should not be too long, it should be concise and to the point.
