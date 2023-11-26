mod application;
mod persistence;

use std::sync::Arc;

use sqlx::SqlitePool;

use crate::{
    application::{concrete::ConcreteTeamsService, TeamsService},
    persistence::sqlite::SqliteTeamRepository,
};

#[tokio::main]
async fn main() {
    println!("Yo");
    let pool = Arc::new(
        SqlitePool::connect("sqlite:persistence.sqlite3")
            .await
            .unwrap(),
    );
    let teams = ConcreteTeamsService::new(SqliteTeamRepository::new(pool));
    dbg!(teams.get_teams().await.unwrap());
}
