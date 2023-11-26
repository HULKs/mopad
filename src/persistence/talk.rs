use std::time::{Duration, SystemTime};

use async_trait::async_trait;
use sqlx::Error;

#[async_trait]
pub trait TalkRepository {
    async fn insert(
        &self,
        creator_id: i64,
        title: &str,
        description: &str,
        scheduled_at: Option<SystemTime>,
        duration: Duration,
        location: Option<&str>,
    ) -> Result<i64, Error>;
    async fn delete(&self, id: i64) -> Result<(), Error>;
    async fn get_creator_id_by_id(&self, id: i64) -> Result<i64, Error>;
    async fn update_title(&self, id: i64, title: &str) -> Result<(), Error>;
    async fn update_description(&self, id: i64, description: &str) -> Result<(), Error>;
    async fn update_scheduled_at(
        &self,
        id: i64,
        scheduled_at: Option<SystemTime>,
    ) -> Result<(), Error>;
    async fn update_duration(&self, id: i64, duration: Duration) -> Result<(), Error>;
    async fn update_location(&self, id: i64, location: Option<&str>) -> Result<(), Error>;
}
