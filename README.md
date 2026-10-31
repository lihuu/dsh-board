# dsh-board

A kanban board for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): **cards are tasks, columns are task states, and every task runs in a long-lived native Session.**


## Why

DeepSeek Harness is session-centric: one session is one page, and there is no global view of what is running, what is waiting for you, or what is already done. dsh-board adds a task layer on top:

- one **board per workspace**, with **待办 / 进行中 / 完成** columns (renameable, extensible)
- a card is what you wrote; the Session behind it is just the execution end
- the card's small badge is the Session's live state (`Running`, `Waiting for you`), while the column is the **task** state
- clicking a card opens that Session's **real conversation** inside the board — not a re-implemented chat


## Features

- **Workspace = board.** A tab strip of workspaces; each board shows its own tasks.
- **Configurable columns.** Built-in `待办 / 进行中 / 完成` can be renamed; add your own columns, drag tasks between any of them, delete custom columns (tasks fall back to `待办`). Columns persist.
- **Tasks bound to Sessions.** Create a task and either pick an existing Session or create a new one. By default a new task reuses the Session this board ran last, so related tasks share one long conversation instead of opening a session per task.
- **Live status.** `Idle / Running / Waiting for you / Done` come from the Session list and status sources (the same ones the sidebar uses); updates are pushed by the host.
- **Automatic task flow.** Press *Start* → the task moves to `进行中`; only the run that this card started completes it (Session idle and stable for 2.5 s) and records the duration. Runs started elsewhere never move task state.
- **Native conversation in place.** The detail pane renders the shipped `conversation.content` factory bound to the Session reference, so the whole conversation (transcript, composer, model/permission controls, question cards) is real and interactive.
- **Quick overlay.** The sidebar-foot board button opens the same tasks as a floating overlay over any page (badge = active task count).
- **Keyboard.** `↑`/`↓` in the board to move, `Enter` to open, `N` for a new task, `Esc` to close; in a conversation `↑`/`↓` switches to the previous/next task, `Esc` returns to the board.
- **Persistence.** Tasks, columns and selection are stored by the Host (see [Data](#data)) and survive an app restart, not just a page refresh.

## Install

### From the plugin manager (recommended)

```sh
dsh plugin add @lihuu/dsh-board
```

or, in the GUI: **Settings → Plugins → install bundle** and enter `@lihuu/dsh-board`.
The package ships a `cordis.patch.yml` bundle layer, so the Host row is written for you.
Restart the app once after installing (the Host half loads at boot).

### From source (development)

```sh
git clone https://github.com/lihuu/dsh-board.git
cd dsh-board
# point your profile at this checkout, e.g. with the dsh-plugins installer:
#   link the package into ~/.dsh/plugins and add the row below
```

Patch row used by the bundle:

```yaml
- insert:
    - id: dsh-board
      name: '@lihuu/dsh-board'
```

## How the native conversation is embedded

`conversation.content` is a `session-maybe` factory: calling it from a root-scope
slot renders the blank/hero branch. dsh-board therefore:

1. registers its `main` panel with a private child slot
   `children: { 'board.detail': { kind: 'single', scope: 'session' } }`, which makes
   the renderer hand it `SessionProvider` and `renderSlot`;
2. retains the Session (`ctx.sessions.retain(id, { source: 'boardPanel' })`) and
   wraps the child slot in `<SessionProvider session={reference}>`;
3. the child entry calls
   `renderFactorySlot('conversation.content', { variant: 'embedded', phase, hero })`.

The overlay entry uses the same pattern with its own `board.chat` child slot.

## Data

| Layer | Location | Role |
| --- | --- | --- |
| Authoritative | `~/.dsh/dsh-board/state.json` | tasks, columns, view selection, deletion tombstones |
| Backup | `~/.dsh/dsh-board/state.json.bak` | previous good generation, read when the main file is torn |
| Cache | browser `localStorage` | same-run cache only — the Desktop app binds a new random port on every launch, so it is not a cross-restart backup |
| Conversations | DeepSeek Harness session storage | transcript and run state; a task only stores `sessionId` |

Writes are atomic (`tmp` + `rename`), serialized inside the Host, and merged by task id
(newer `updatedAt` wins) with tombstone union, so a stale window cannot drop another
window's tasks or resurrect a deleted one. Clients poll every 2.5 s and reconcile
before each debounced write (400 ms).

**Risk:** one file plus one backup, no version history. Keep `state.json` in your backup
routine. A corrupt or missing file falls back to `.bak`, but deleting `~/.dsh` loses the
board (conversations are unaffected).

## Requirements

- DeepSeek Harness ≥ 0.2.2 (Web UI with `main`, `sidebar.panellist`, `shell.overlay`,
  `conversation.session.header.utilities` slots).
- No build step: the client half is plain JavaScript served as-is.

## Development

```
src/index.js    Host half: authenticated GET/POST /dsh-board/state, atomic storage
lib/client.js   Browser half: slots, board UI, native conversation embedding
cordis.patch.yml  bundle row
```

The browser half is loaded through the client module system and can be reloaded with a
page refresh; Host-half changes need an app restart.

## License

MIT © lihuu
