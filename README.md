# Moderated Organization PAD (powerful, agile, distributed)

Web application for managing talks (title, description, duration, scheduling).

## How to deploy

Example `docker-compose.yaml`:

```yaml
version: "3"
services:
  mopad:
    build: .
    restart: unless-stopped
    volumes:
      - ./talks.json:/mopad/talks.json
      - ./teams.json:/mopad/teams.json
      - ./tokens.json:/mopad/tokens.json
      - ./users.json:/mopad/users.json
    ports:
      - "1337:1337"
```

You may want to add a reverse proxy for TLS-termination.

Create empty data store with teams `Alpha` and `Bravo`:

```bash
echo '[]' > talks.json
echo '["Alpha", "Bravo"]' > teams.json
echo '{}' > tokens.json
echo '[]' > users.json
```

Then build with `docker compose build mopad` and start the container with `docker compose up -d`.

Navigate to `http://localhost:1337` to view the MOPAD.
The first step is to register yourself by clicking the "Register" link on the login page.
Once registered, you are logged in and can start to manage talks.

## Give Editor and Scheduler roles to users

In MOPAD, users can have roles: `Editor` and `Scheduler`.
They are disjoint which means, users can have multiple roles, one of them, or none.
Normal users do not have any roles.

The `Editor` role allows the user to edit talks created by other users.
Normally users can only edit their own talks.

The `Scheduler` role allows the user to set the scheduling time of talks.
Only schedulers can edit these times.

You can change the roles in the `users.json` file.
Each user has a `"roles"` array field where the roles can be added as string e.g. `"roles": ["Editor", "Scheduler"]`.
Changes made in all JSON files need to be announced to a running server instance by sending it a `SIGUSR1` signal e.g. with `docker compose kill -s SIGUSR1 mopad`.
You can also restart the server but this will disconnect all connected clients (but they should™ reconnect).
