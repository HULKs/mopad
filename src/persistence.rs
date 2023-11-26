pub mod role;
pub mod sqlite;
pub mod team;
pub mod token;
pub mod user;

use async_trait::async_trait;
use sqlx::{Error, FromRow};

#[deprecated]
#[async_trait]
pub trait TeamRepository {
    async fn get_all(&self) -> Result<Vec<Team>, Error>;
    async fn get_by_id(&self, id: i64) -> Result<Option<Team>, Error>;
}

#[derive(Debug, FromRow)]
pub struct Team {
    pub id: i64,
    pub name: String,
}
