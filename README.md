# Moderated Organization PAD (powerful, agile, distributed)

Web application for managing talks, with a Rust backend and a Svelte 5 frontend.

## Local development

Enter `nix-shell`. It provides Rust,
Cargo, Clippy, rustfmt, Bun, and Node.js.

Copy `config.toml.example` to `config.toml` and edit it for your event. All
launch options are in this file; the only application argument is its path.
There are no launch-option flags or environment overrides. For localhost-only
development, set `address = "127.0.0.1"`.

```toml
address = "127.0.0.1"
port = 9559
storage = "storage"
frontend = "frontend/dist"

[event]
start = "2026-11-20T08:00:00Z"
end = "2026-11-22T18:00:00Z"
```

Start the server with `mopad path/to/config.toml`. Relative storage/frontend
paths resolve from the config file's directory. Restart after changing
the configuration. Missing/invalid settings cause a clear startup error.

Event dates must be explicit UTC timestamps ending in `Z`, with start before
end. Optional `[[event.opening_hours]]` intervals contain `start` and `end`;
`[[event.breaks]]` intervals also contain a `label` (see the example file).
All intervals must be inside the event range. With no opening hours configured,
the whole event is open. Closed periods and breaks only shade the scheduler:
they never prohibit scheduling a talk there.

Only public event settings are served at `/config.json` (the API stays JSON).
Bind options and filesystem paths remain private. Talk timestamps remain UTC
epoch values. The English-only frontend displays and edits browser-local times,
including daylight-saving transitions.

Start the backend from the repository root:

```sh
cargo run -- config.toml
```

For a new store, initialize teams and locations as shown in the deployment
section below. Start the frontend in a second terminal, also inside the Nix shell:

```sh
cd frontend
bun install --frozen-lockfile
bun run dev --host 127.0.0.1
```

Open http://127.0.0.1:5173. Vite proxies the API, event configuration, teams,
locations, and calendar to the Rust server on port 9559.

For a local demo, see `demo/README.md` if present. The demo folder is gitignored.

## Types and checks

The Rust wire types in `src/wire.rs` are the source of truth. ts-rs generates checked-in TypeScript
bindings under `frontend/src/generated/`; do not edit them by hand. Stored users
and password hashes are not exported. Frontend-only state remains TypeScript.

`cargo build`, `cargo check`, `cargo run`, and `cargo test` automatically regenerate
bindings when the wire types or time bindings change, or generated files are
changed/deleted. Cached builds leave unchanged files untouched. Build the backend
before building the frontend after changing Rust types:

```sh
cargo build --locked
```

Run checks from the repository root:

```sh
cargo fmt --check
cargo test --locked
cargo clippy --locked --all-targets -- -D warnings
```

Then in `frontend/`:

```sh
bun run test
bun run build
```

The frontend tests run in a fixed timezone and check UTC/local conversions,
daylight-saving boundaries, message handling, overlap layouts, opening-hours
backgrounds, countdowns, scheduler drafts, and save/reconnect handling. CI also checks generated bindings
for drift. `bun run build` checks Svelte/TypeScript
and writes the static frontend to `frontend/dist`.

To serve that build directly without Vite, use `frontend = "frontend/dist"`
in `config.toml` and run `cargo run -- config.toml` from the repository root.

## How to deploy

Use the example `docker-compose.yaml` of this repository.
You may want to add a reverse proxy for TLS-termination.

Create `config.toml` as above, using `address = "0.0.0.0"`, `port = 9559`,
`storage = "storage"`, and `frontend = "frontend/dist"` for the container.
Then initialize teams `Alpha` and `Bravo` for a new installation:

```bash
mkdir -p storage
echo '["Alpha", "Bravo"]' > storage/teams.json
```

Do not overwrite existing storage files. The server creates missing talks,
users, tokens, and locations files with empty defaults. Add rooms to
`storage/locations.json` as an ID-keyed object, for example:

```json
{
  "1": { "id": 1, "name": "Main Hall", "live_stream": null }
}
```

`next_talk_id.json` is created automatically and prevents deleted talk IDs from
being reused. Back it up with the other storage files. Inconsistent IDs, unknown
teams, and missing talk creators/participants stop startup/reload with an error;
repair or restore the files instead of silently discarding data.

Then build with `docker compose build mopad` and start with
`docker compose up -d`. The compose file mounts the whole storage directory
(needed for atomic file replacement) and the read-only event configuration.

Existing deployments using individual JSON files should move them into
`storage/` before switching to this compose file, preserving their contents.
Convert the old event JSON configuration and launch flags into `config.toml`;
`config.json` and CLI options are no longer read. Stored talk/user JSON remains
compatible and is not replaced by TOML.

Navigate to `http://localhost:9559` to view the MOPAD.
The first step is to register yourself by clicking the "Register" link on the login page.
Once registered, you are logged in and can start to manage talks.

## Give Editor and Scheduler roles to users

In MOPAD, users can have roles: `Editor` and `Scheduler`.
Users can have either role, both, or neither.
Normal users do not have any roles.

The `Editor` role allows the user to edit talks created by other users.
Normally users can only edit their own talks.

The `Scheduler` role allows the user to set the scheduling time of talks.
Only schedulers can edit these times.

You can change the roles in the `storage/users.json` file.
Each user has a `"roles"` array field where the roles can be added as string e.g. `"roles": ["Editor", "Scheduler"]`.
Changes made in all JSON files need to be announced to a running server instance by sending it a `SIGUSR1` signal e.g. with `docker compose kill -s SIGUSR1 mopad`.
Reload updates connected clients, including rooms and roles. Invalid storage leaves
the running state unchanged. You can also restart; clients reconnect automatically.
Logging out revokes the current token. Sessions expire after seven days; open
connections check expiration/revocation every 30 seconds and before commands.

## Talk durations and scheduling

Creating a talk is available to all users. The creation dialog sends nothing
until submission. A talk stores its current scheduled duration and the latest
duration set by its creator (`creator_duration`). Creator edits update both,
even if that user also has the Scheduler role. Other schedulers change only
the current duration. The scheduler shows differences; the overview shows only
the current duration, with a countdown before or during the talk.

Legacy talks without `creator_duration` use their existing duration as the
baseline, saved on the next talk-storage commit. Earlier overwritten creator
durations cannot be recovered. Scheduler edits stay in a draft until saved;
overlaps share room-column width, empty rooms stay narrow, and edge handles or
the details form can change duration. Saving also applies pending form edits and
waits for server confirmation. Each talk's schedule is saved together and stale
edits are rejected. Different talks still save separately, not as one atomic batch.
Drafts survive a lost connection, but not a page reload or logout. If confirmation
is lost, check current data before retrying; the server may already have saved it.
Durations must be at least one minute and no longer than the event. Scheduled talks
must fit entirely inside the event, whether edited inline or in the scheduler.

Room columns always fill the available timeline width; empty rooms share it
equally when none are occupied. Ctrl+wheel over the timeline zooms time between
one visible hour and the selected day's range. Zoom buttons also work by keyboard
and touch. With a timeline talk focused, Ctrl++/Ctrl+- zoom and Ctrl+0 fits the day;
elsewhere these remain browser shortcuts. Normal wheel scrolling is unchanged. Break captions appear
once in the sticky left time rail and stay visible while scrolling through
their interval. Shading spans all rooms and remains advisory.
