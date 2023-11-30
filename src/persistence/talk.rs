use std::{
    sync::Arc,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use async_trait::async_trait;
use sqlx::{query, query_as, Error, Pool, Sqlite};

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
    async fn get_creator_id_by_id(&self, id: i64) -> Result<Option<i64>, Error>;
    async fn update_title(&self, id: i64, title: &str) -> Result<(), Error>;
    async fn update_description(&self, id: i64, description: &str) -> Result<(), Error>;
    async fn update_scheduled_at(
        &self,
        id: i64,
        scheduled_at: Option<SystemTime>,
    ) -> Result<(), Error>;
    async fn update_duration(&self, id: i64, duration: Duration) -> Result<(), Error>;
    async fn update_location(&self, id: i64, location: Option<&str>) -> Result<(), Error>;
    async fn get_all(&self) -> Result<Vec<Talk>, Error>;
}

pub struct Talk {
    pub id: i64,
    pub creator: i64,
    pub title: String,
    pub description: String,
    pub scheduled_at: Option<SystemTime>,
    pub duration: Duration,
    pub location: Option<String>,
}

pub struct SqliteTalkRepository {
    pool: Arc<Pool<Sqlite>>,
}

impl SqliteTalkRepository {
    pub fn new(pool: Arc<Pool<Sqlite>>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl TalkRepository for SqliteTalkRepository {
    async fn insert(
        &self,
        creator_id: i64,
        title: &str,
        description: &str,
        scheduled_at: Option<SystemTime>,
        duration: Duration,
        location: Option<&str>,
    ) -> Result<i64, Error> {
        query("INSERT INTO talks (creator, title, description, scheduled_at, duration, location) VALUES (?, ?, ?, ?, ?, ?)")
            .bind(creator_id)
            .bind(title)
            .bind(description)
            .bind(scheduled_at.map(|scheduled_at| scheduled_at.duration_since(UNIX_EPOCH).unwrap().as_secs() as i64 ))
            .bind(duration.as_secs() as i64)
            .bind(location)
            .execute(self.pool.as_ref())
            .await
            .map(|result| result.last_insert_rowid())
    }

    async fn delete(&self, id: i64) -> Result<(), Error> {
        query("DELETE FROM talks WHERE id = ?")
            .bind(id)
            .execute(self.pool.as_ref())
            .await
            .map(|_| ())
    }

    async fn get_creator_id_by_id(&self, id: i64) -> Result<Option<i64>, Error> {
        query_as("SELECT creator FROM talks WHERE id = ?")
            .bind(id)
            .fetch_optional(self.pool.as_ref())
            .await
            .map(|creator| creator.map(|(creator,)| creator))
    }

    async fn update_title(&self, id: i64, title: &str) -> Result<(), Error> {
        query("UPDATE talks SET title = ? WHERE id = ?")
            .bind(title)
            .bind(id)
            .execute(self.pool.as_ref())
            .await
            .map(|_| ())
    }

    async fn update_description(&self, id: i64, description: &str) -> Result<(), Error> {
        query("UPDATE talks SET description = ? WHERE id = ?")
            .bind(description)
            .bind(id)
            .execute(self.pool.as_ref())
            .await
            .map(|_| ())
    }

    async fn update_scheduled_at(
        &self,
        id: i64,
        scheduled_at: Option<SystemTime>,
    ) -> Result<(), Error> {
        query("UPDATE talks SET scheduled_at = ? WHERE id = ?")
            .bind(scheduled_at.map(|scheduled_at| {
                scheduled_at.duration_since(UNIX_EPOCH).unwrap().as_secs() as i64
            }))
            .bind(id)
            .execute(self.pool.as_ref())
            .await
            .map(|_| ())
    }

    async fn update_duration(&self, id: i64, duration: Duration) -> Result<(), Error> {
        query("UPDATE talks SET duration = ? WHERE id = ?")
            .bind(duration.as_secs() as i64)
            .bind(id)
            .execute(self.pool.as_ref())
            .await
            .map(|_| ())
    }

    async fn update_location(&self, id: i64, location: Option<&str>) -> Result<(), Error> {
        query("UPDATE talks SET location = ? WHERE id = ?")
            .bind(location)
            .bind(id)
            .execute(self.pool.as_ref())
            .await
            .map(|_| ())
    }

    async fn get_all(&self) -> Result<Vec<Talk>, Error> {
        query_as(
            "SELECT id, creator, title, description, scheduled_at, duration, location FROM talks",
        )
        .fetch_all(self.pool.as_ref())
        .await
        .map(|talks| {
            talks
                .into_iter()
                .map(
                    |(id, creator, title, description, scheduled_at, duration, location): (
                        _,
                        _,
                        _,
                        _,
                        Option<i64>,
                        i64,
                        Option<String>,
                    )| Talk {
                        id,
                        creator,
                        title,
                        description,
                        scheduled_at: scheduled_at.map(|scheduled_at| {
                            UNIX_EPOCH + Duration::from_secs(scheduled_at as u64)
                        }),
                        duration: Duration::from_secs(duration as u64),
                        location,
                    },
                )
                .collect()
        })
    }
}
