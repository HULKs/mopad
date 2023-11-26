mod persistence;

use std::sync::Arc;

use sqlx::SqlitePool;

use crate::persistence::{sqlite::SqliteTeamRepository, TeamRepository};

#[tokio::main]
async fn main() {
    println!("Yo");
    let pool = Arc::new(
        SqlitePool::connect("sqlite:persistence.sqlite3")
            .await
            .unwrap(),
    );
    let teams = SqliteTeamRepository::new(pool);
    dbg!(teams.get_all().await.unwrap());
    dbg!(teams.get_by_id(1).await.unwrap());
    dbg!(teams.get_by_id(42).await.unwrap());
}
