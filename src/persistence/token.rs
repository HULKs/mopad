use std::{
    sync::Arc,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use async_trait::async_trait;
use sqlx::{query, query_as, Error, Pool, Sqlite};

#[async_trait]
pub trait TokenRepository {
    async fn provision(&self) -> Result<(), Error>;
    async fn insert_or_update_token_for_user(
        &self,
        token: &str,
        user_id: i64,
        expires_at: SystemTime,
    ) -> Result<(), Error>;
    async fn delete_earlier_than(&self, deadline: SystemTime) -> Result<(), Error>;
    async fn get_user_id(&self, token: &str) -> Result<Option<i64>, Error>;
    async fn get_all(&self) -> Result<Vec<Token>, Error>;
    async fn clear(&self) -> Result<(), Error>;
    async fn import(&self, tokens: Vec<Token>) -> Result<(), Error>;
}

#[derive(Debug)]
pub struct Token {
    pub token: String,
    pub user_id: i64,
    pub expires_at: SystemTime,
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
    async fn provision(&self) -> Result<(), Error> {
        query("DROP TABLE IF EXISTS tokens")
            .execute(self.pool.as_ref())
            .await?;
        query(
            "CREATE TABLE tokens (
                token TEXT PRIMARY KEY,
                user INTEGER REFERENCES users(id) NOT NULL,
                expires_at INTEGER NOT NULL
            )",
        )
        .execute(self.pool.as_ref())
        .await?;
        Ok(())
    }

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

    async fn delete_earlier_than(&self, deadline: SystemTime) -> Result<(), Error> {
        query("DELETE FROM tokens WHERE expires_at < ?")
            .bind(deadline.duration_since(UNIX_EPOCH).unwrap().as_secs() as i64)
            .execute(self.pool.as_ref())
            .await
            .map(|_| ())
    }

    async fn get_user_id(&self, token: &str) -> Result<Option<i64>, Error> {
        query_as("SELECT user FROM tokens WHERE token = ?")
            .bind(token)
            .fetch_optional(self.pool.as_ref())
            .await
            .map(|user| user.map(|(user,)| user))
    }

    async fn get_all(&self) -> Result<Vec<Token>, Error> {
        query_as("SELECT token, user, expires_at FROM tokens")
            .fetch_all(self.pool.as_ref())
            .await
            .map(|tokens| {
                tokens
                    .into_iter()
                    .map(|(token, user, expires_at): (_, _, i64)| Token {
                        token,
                        user_id: user,
                        expires_at: UNIX_EPOCH + Duration::from_secs(expires_at as u64),
                    })
                    .collect()
            })
    }

    async fn clear(&self) -> Result<(), Error> {
        query("DELETE FROM tokens")
            .execute(self.pool.as_ref())
            .await
            .map(|_| ())
    }

    async fn import(&self, tokens: Vec<Token>) -> Result<(), Error> {
        for token in tokens {
            println!("Importing {token:?}...");
            query("INSERT INTO tokens (token, user, expires_at) VALUES (?, ?, ?)")
                .bind(token.token)
                .bind(token.user_id)
                .bind(
                    token
                        .expires_at
                        .duration_since(UNIX_EPOCH)
                        .unwrap()
                        .as_secs() as i64,
                )
                .execute(self.pool.as_ref())
                .await
                .map(|_| ())?;
        }

        Ok(())
    }
}
