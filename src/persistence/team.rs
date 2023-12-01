use std::sync::Arc;

use async_trait::async_trait;
use sqlx::{query, query_as, Error, Pool, Sqlite};

#[async_trait]
pub trait TeamRepository {
    async fn provision(&self) -> Result<(), Error>;
    async fn get_name_by_id(&self, id: i64) -> Result<Option<String>, Error>;
    async fn get_id_by_name(&self, name: &str) -> Result<Option<i64>, Error>;
    async fn get_all(&self) -> Result<Vec<Team>, Error>;
    async fn clear(&self) -> Result<(), Error>;
    async fn import(&self, teams: Vec<Team>) -> Result<(), Error>;
}

pub struct Team {
    pub id: i64,
    pub name: String,
}

pub struct SqliteTeamRepository {
    pool: Arc<Pool<Sqlite>>,
}

impl SqliteTeamRepository {
    pub fn new(pool: Arc<Pool<Sqlite>>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl TeamRepository for SqliteTeamRepository {
    async fn provision(&self) -> Result<(), Error> {
        query("DROP TABLE IF EXISTS teams")
            .execute(self.pool.as_ref())
            .await?;
        query(
            "CREATE TABLE teams (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL
            )",
        )
        .execute(self.pool.as_ref())
        .await?;
        Ok(())
    }

    async fn get_name_by_id(&self, id: i64) -> Result<Option<String>, Error> {
        query_as("SELECT name FROM teams WHERE id = ?")
            .bind(id)
            .fetch_optional(self.pool.as_ref())
            .await
            .map(|name| name.map(|(name,)| name))
    }

    async fn get_id_by_name(&self, name: &str) -> Result<Option<i64>, Error> {
        query_as("SELECT id FROM teams WHERE name = ?")
            .bind(name)
            .fetch_optional(self.pool.as_ref())
            .await
            .map(|id| id.map(|(id,)| id))
    }

    async fn get_all(&self) -> Result<Vec<Team>, Error> {
        query_as("SELECT id, name FROM teams")
            .fetch_all(self.pool.as_ref())
            .await
            .map(|teams| {
                teams
                    .into_iter()
                    .map(|(id, name)| Team { id, name })
                    .collect()
            })
    }

    async fn clear(&self) -> Result<(), Error> {
        query("DELETE FROM teams")
            .execute(self.pool.as_ref())
            .await
            .map(|_| ())
    }

    async fn import(&self, teams: Vec<Team>) -> Result<(), Error> {
        for team in teams {
            query("INSERT INTO teams (id, name) VALUES (?, ?)")
                .bind(team.id)
                .bind(team.name)
                .execute(self.pool.as_ref())
                .await
                .map(|_| ())?;
        }

        Ok(())
    }
}
