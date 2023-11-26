pub mod sqlite;

use async_trait::async_trait;
use sqlx::{Error, FromRow};

#[async_trait]
pub trait TeamRepository {
    async fn get_all(&self) -> Result<Vec<Team>, Error>;
}

#[derive(Debug, FromRow)]
pub struct Team {
    pub id: i64,
    pub name: String,
}
