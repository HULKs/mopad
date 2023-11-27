mod application;
mod persistence;
mod presentation;

use std::sync::Arc;

use application::teams::ProductionTeamsService;
use axum::serve;
use persistence::team::SqliteTeamRepository;
use presentation::ProductionController;
use sqlx::SqlitePool;
use tokio::net::TcpListener;

#[tokio::main]
async fn main() {
    let pool = Arc::new(
        SqlitePool::connect("sqlite:persistence.sqlite3")
            .await
            .unwrap(),
    );

    serve(
        TcpListener::bind("[::]:1337").await.unwrap(),
        ProductionController::new(
            "./frontend",
            ProductionTeamsService::new(SqliteTeamRepository::new(pool)),
        ),
    )
    .await
    .unwrap();
}
