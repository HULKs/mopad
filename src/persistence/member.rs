use std::sync::Arc;

use async_trait::async_trait;
use futures_util::TryStreamExt;
use sqlx::{query, query_as, Error, Pool, Sqlite};

#[async_trait]
pub trait MemberRepository {
    async fn get_state_by_user_and_talk(&self, user_id: i64, talk_id: i64) -> Result<State, Error>;
    async fn set_state_by_user_and_talk(
        &self,
        user_id: i64,
        talk_id: i64,
        state: State,
    ) -> Result<(), Error>;
    async fn get_nerds_and_noobs_by_id(&self, id: i64) -> Result<(Vec<i64>, Vec<i64>), Error>;
    async fn delete_by_id(&self, id: i64) -> Result<(), Error>;
}

pub enum State {
    None,
    Nerd,
    Noob,
}

pub struct SqliteMemberRepository {
    pool: Arc<Pool<Sqlite>>,
}

impl SqliteMemberRepository {
    pub fn new(pool: Arc<Pool<Sqlite>>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl MemberRepository for SqliteMemberRepository {
    async fn get_state_by_user_and_talk(&self, user_id: i64, talk_id: i64) -> Result<State, Error> {
        match query_as("SELECT is_nerd FROM members WHERE user = ? AND talk = ?")
            .bind(user_id)
            .bind(talk_id)
            .fetch_optional(self.pool.as_ref())
            .await?
        {
            Some((true,)) => Ok(State::Nerd),
            Some((false,)) => Ok(State::Noob),
            None => Ok(State::None),
        }
    }

    async fn set_state_by_user_and_talk(
        &self,
        user_id: i64,
        talk_id: i64,
        state: State,
    ) -> Result<(), Error> {
        let statement = match state {
            State::None => "DELETE FROM members WHERE user = ? AND talk = ?",
            State::Nerd => "INSERT INTO members (user, talk, is_nerd) VALUES ($1, $2, 1) ON CONFLICT (user, talk) DO UPDATE SET is_nerd = 1 WHERE user = $1 AND talk = $2",
            State::Noob => "INSERT INTO members (user, talk, is_nerd) VALUES ($1, $2, 0) ON CONFLICT (user, talk) DO UPDATE SET is_nerd = 0 WHERE user = $1 AND talk = $2",
        };
        query(statement)
            .bind(user_id)
            .bind(talk_id)
            .execute(self.pool.as_ref())
            .await
            .map(|_| ())
    }

    async fn get_nerds_and_noobs_by_id(&self, id: i64) -> Result<(Vec<i64>, Vec<i64>), Error> {
        let mut nerds = Vec::new();
        let mut nerds_fetcher = query_as("SELECT user FROM members WHERE talk = ? AND is_nerd = 1")
            .bind(id)
            .fetch(self.pool.as_ref());
        while let Some((nerd,)) = nerds_fetcher.try_next().await? {
            nerds.push(nerd);
        }

        let mut noobs = Vec::new();
        let mut noobs_fetcher = query_as("SELECT user FROM members WHERE talk = ? AND is_nerd = 0")
            .bind(id)
            .fetch(self.pool.as_ref());
        while let Some((noob,)) = noobs_fetcher.try_next().await? {
            noobs.push(noob);
        }

        Ok((nerds, noobs))
    }

    async fn delete_by_id(&self, id: i64) -> Result<(), Error> {
        query("DELETE FROM members WHERE talk = ?")
            .bind(id)
            .execute(self.pool.as_ref())
            .await
            .map(|_| ())
    }
}
