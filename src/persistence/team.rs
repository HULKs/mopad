use async_trait::async_trait;
use sqlx::Error;

#[async_trait]
pub trait TeamRepository {
    async fn get_name_by_id(&self, id: i64) -> Result<Option<String>, Error>;
    async fn get_id_by_name(&self, name: &str) -> Result<Option<i64>, Error>;
}
