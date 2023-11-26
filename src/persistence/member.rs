use async_trait::async_trait;
use sqlx::Error;

#[async_trait]
pub trait MemberRepository {
    async fn get_state_by_user_and_talk(&self, user_id: i64, talk_id: i64) -> Result<State, Error>;
    async fn set_state_by_user_and_talk(
        &self,
        user_id: i64,
        talk_id: i64,
        state: State,
    ) -> Result<(), Error>;
    async fn get_nerds_and_noobs_by_talk(&self, id: i64) -> Result<(Vec<i64>, Vec<i64>), Error>;
    async fn delete_by_talk(&self, id: i64) -> Result<(), Error>;
}

pub enum State {
    None,
    Nerd,
    Noob,
}
