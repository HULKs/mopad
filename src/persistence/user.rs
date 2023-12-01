use std::sync::Arc;

use async_trait::async_trait;
use sqlx::{error::ErrorKind, query, query_as, Error, Pool, Sqlite};

#[async_trait]
pub trait UserRepository {
    async fn provision(&self) -> Result<(), Error>;
    async fn exists(&self, id: i64) -> Result<bool, Error>;
    async fn get_name_and_team_id_by_id(&self, id: i64) -> Result<Option<(String, i64)>, Error>;
    async fn get_id_by_name_and_team(&self, name: &str, team_id: i64)
        -> Result<Option<i64>, Error>;
    async fn get_id_and_hash_by_name_and_team(
        &self,
        name: &str,
        team_id: i64,
    ) -> Result<Option<(i64, String)>, Error>;
    async fn insert_name_and_team_and_hash(
        &self,
        name: &str,
        team_id: i64,
        hash: &str,
    ) -> Result<Option<i64>, Error>;
    async fn update_hash(&self, id: i64, hash: &str) -> Result<(), Error>;
    async fn get_all(&self) -> Result<Vec<User>, Error>;
    async fn clear(&self) -> Result<(), Error>;
    async fn import(&self, users: Vec<User>) -> Result<(), Error>;
}

pub struct User {
    pub id: i64,
    pub name: String,
    pub team_id: i64,
    pub hash: String,
}

pub struct SqliteUserRepository {
    pool: Arc<Pool<Sqlite>>,
}

impl SqliteUserRepository {
    pub fn new(pool: Arc<Pool<Sqlite>>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl UserRepository for SqliteUserRepository {
    async fn provision(&self) -> Result<(), Error> {
        query("DROP TABLE IF EXISTS users")
            .execute(self.pool.as_ref())
            .await?;
        query(
            "CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                team INTEGER REFERENCES teams(id) NOT NULL,
                hash TEXT NOT NULL,
                CONSTRAINT name_and_team UNIQUE (name, team)
            )",
        )
        .execute(self.pool.as_ref())
        .await?;
        Ok(())
    }

    async fn exists(&self, id: i64) -> Result<bool, Error> {
        query_as("SELECT id FROM users WHERE id = ?")
            .bind(id)
            .fetch_optional(self.pool.as_ref())
            .await
            .map(|row: Option<(i64,)>| row.is_some())
    }

    async fn get_name_and_team_id_by_id(&self, id: i64) -> Result<Option<(String, i64)>, Error> {
        query_as("SELECT name, team FROM users WHERE id = ?")
            .bind(id)
            .fetch_optional(self.pool.as_ref())
            .await
    }

    async fn get_id_by_name_and_team(
        &self,
        name: &str,
        team_id: i64,
    ) -> Result<Option<i64>, Error> {
        query_as("SELECT id FROM users WHERE name = ? AND team = ?")
            .bind(name)
            .bind(team_id)
            .fetch_optional(self.pool.as_ref())
            .await
            .map(|id| id.map(|(id,)| id))
    }

    async fn get_id_and_hash_by_name_and_team(
        &self,
        name: &str,
        team_id: i64,
    ) -> Result<Option<(i64, String)>, Error> {
        query_as("SELECT id, hash FROM users WHERE name = ? AND team = ?")
            .bind(name)
            .bind(team_id)
            .fetch_optional(self.pool.as_ref())
            .await
    }

    async fn insert_name_and_team_and_hash(
        &self,
        name: &str,
        team_id: i64,
        hash: &str,
    ) -> Result<Option<i64>, Error> {
        match query("INSERT INTO users (name, team, hash) VALUES (?, ?, ?)")
            .bind(name)
            .bind(team_id)
            .bind(hash)
            .execute(self.pool.as_ref())
            .await
        {
            Ok(result) => Ok(Some(result.last_insert_rowid())),
            Err(Error::Database(error)) if error.kind() == ErrorKind::UniqueViolation => Ok(None),
            Err(error) => Err(error),
        }
    }

    async fn update_hash(&self, id: i64, hash: &str) -> Result<(), Error> {
        query("UPDATE users SET hash = ? WHERE id = ?")
            .bind(hash)
            .bind(id)
            .execute(self.pool.as_ref())
            .await
            .map(|_| ())
    }

    async fn get_all(&self) -> Result<Vec<User>, Error> {
        query_as("SELECT id, name, team, hash FROM users")
            .fetch_all(self.pool.as_ref())
            .await
            .map(|users| {
                users
                    .into_iter()
                    .map(|(id, name, team, hash)| User {
                        id,
                        name,
                        team_id: team,
                        hash,
                    })
                    .collect()
            })
    }

    async fn clear(&self) -> Result<(), Error> {
        query("DELETE FROM users")
            .execute(self.pool.as_ref())
            .await
            .map(|_| ())
    }

    async fn import(&self, users: Vec<User>) -> Result<(), Error> {
        for user in users {
            query("INSERT INTO users (id, name, team, hash) VALUES (?, ?, ?, ?)")
                .bind(user.id)
                .bind(user.name)
                .bind(user.team_id)
                .bind(user.hash)
                .execute(self.pool.as_ref())
                .await
                .map(|_| ())?;
        }

        Ok(())
    }
}
