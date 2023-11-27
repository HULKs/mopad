use std::sync::Arc;

use async_trait::async_trait;
use sqlx::{query_as, Error, Pool, Sqlite};

#[async_trait]
pub trait TeamRepository {
    async fn get_all(&self) -> Result<Vec<String>, Error>;
    async fn get_name_by_id(&self, id: i64) -> Result<Option<String>, Error>;
    async fn get_id_by_name(&self, name: &str) -> Result<Option<i64>, Error>;
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
    async fn get_all(&self) -> Result<Vec<String>, Error> {
        query_as("SELECT name FROM teams")
            .fetch_all(self.pool.as_ref())
            .await
            .map(|teams| teams.into_iter().map(|(team,)| team).collect())
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
}
