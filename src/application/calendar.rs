use std::time::{Duration, SystemTime};

use async_trait::async_trait;
use serde::Serialize;
use sqlx::Error;

#[async_trait]
pub trait CalendarService {
    async fn get_all_talks(&self) -> Result<Vec<Talk>, Error>;
    async fn get_own_talks(&self, user_id: i64) -> Result<Vec<Talk>, Error>;
}

#[derive(Debug, Serialize)]
pub struct Talk {
    pub id: i64,
    pub title: String,
    pub description: String,
    pub scheduled_at: Option<SystemTime>,
    pub duration: Duration,
    pub location: Option<String>,
    pub nerds: Vec<Member>,
    pub noobs: Vec<Member>,
}

#[derive(Debug, Serialize)]
pub struct Member {
    pub id: i64,
    pub name: String,
    pub team: String,
}
