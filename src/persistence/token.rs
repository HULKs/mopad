use std::{
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};

use async_trait::async_trait;
use sqlx::{query, query_as, Error, Pool, Sqlite};

#[async_trait]
pub trait TokenRepository {
    async fn insert_or_update_token_for_user(
        &self,
        token: &str,
        user_id: i64,
        expires_at: SystemTime,
    ) -> Result<(), Error>;
    // TODO: remove expired tokens
    async fn get_user_id(&self, token: &str) -> Result<Option<i64>, Error>;
}

pub struct SqliteTokenRepository {
    pool: Arc<Pool<Sqlite>>,
}

impl SqliteTokenRepository {
    pub fn new(pool: Arc<Pool<Sqlite>>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl TokenRepository for SqliteTokenRepository {
    async fn insert_or_update_token_for_user(
        &self,
        token: &str,
        user_id: i64,
        expires_at: SystemTime,
    ) -> Result<(), Error> {
        query("INSERT INTO tokens (token, user, expires_at) VALUES (?, ?, ?)")
            .bind(token)
            .bind(user_id)
            .bind(expires_at.duration_since(UNIX_EPOCH).unwrap().as_secs() as i64)
            .execute(self.pool.as_ref())
            .await
            .map(|_| ())
    }

    // TODO: remove expired tokens

    async fn get_user_id(&self, token: &str) -> Result<Option<i64>, Error> {
        query_as("SELECT user FROM tokens WHERE token = ?")
            .bind(token)
            .fetch_optional(self.pool.as_ref())
            .await
            .map(|user| user.map(|(user,)| user))
    }
}
