use std::sync::Arc;

use async_trait::async_trait;
use sqlx::{query_as, Error, Pool, Sqlite};

use super::{Team, TeamRepository};

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
    async fn get_all(&self) -> Result<Vec<Team>, Error> {
        query_as("SELECT * FROM teams")
            .fetch_all(self.pool.as_ref())
            .await
    }

    async fn get_by_id(&self, id: i64) -> Result<Option<Team>, Error> {
        query_as("SELECT * FROM teams WHERE id = ?")
            .bind(id)
            .fetch_optional(self.pool.as_ref())
            .await
    }
}
