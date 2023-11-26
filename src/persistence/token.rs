use std::time::SystemTime;

use async_trait::async_trait;
use sqlx::Error;

#[async_trait]
pub trait TokenRepository {
    async fn insert_token_for_user(
        &self,
        user_id: i64,
        token: &str,
        expires_at: SystemTime,
    ) -> Result<(), Error>;
    // TODO: remove expired tokens
    async fn get_user_id(&self, token: &str) -> Result<Option<i64>, Error>;
}
