use async_trait::async_trait;
use sqlx::Error;

#[async_trait]
pub trait UserRepository {
    async fn exists(&self, id: i64) -> Result<bool, Error>;
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
    ) -> Result<i64, Error>;
}
