DROP TABLE IF EXISTS teams;
CREATE TABLE teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);

DROP TABLE IF EXISTS users;
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  team INTEGER REFERENCES teams(id) NOT NULL,
  hash TEXT NOT NULL,
  CONSTRAINT name_and_team UNIQUE (name, team)
);

DROP TABLE IF EXISTS roles;
CREATE TABLE roles (
  user INTEGER REFERENCES users(id) NOT NULL,
  role INTEGER NOT NULL
);

DROP TABLE IF EXISTS tokens;
CREATE TABLE tokens (
  token TEXT PRIMARY KEY,
  user INTEGER REFERENCES users(id) NOT NULL,
  expires_at INTEGER NOT NULL
);

DROP TABLE IF EXISTS talks;
CREATE TABLE talks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creator INTEGER REFERENCES users(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  scheduled_at INTEGER,
  duration INTEGER NOT NULL,
  location TEXT
);

DROP TABLE IF EXISTS members;
CREATE TABLE members (
  user INTEGER REFERENCES users(id) NOT NULL,
  talk INTEGER REFERENCES talks(id) NOT NULL,
  is_nerd INTEGER NOT NULL,
  CONSTRAINT user_and_talk UNIQUE (user, talk)
);
