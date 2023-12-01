use std::sync::Arc;

use async_trait::async_trait;
use sqlx::{error::ErrorKind, query, query_as, Error, Pool, Sqlite};

#[async_trait]
pub trait UserRepository {
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
}
