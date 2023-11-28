mod application;
mod persistence;
mod presentation;

use std::sync::Arc;

use application::{
    authentication::ProductionAuthenticationService, talks::ProductionTalksService,
    teams::ProductionTeamsService,
};
use axum::serve;
use persistence::{
    member::SqliteMemberRepository, role::SqliteRoleRepository, team::SqliteTeamRepository,
    token::SqliteTokenRepository, user::SqliteUserRepository,
};
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
            ProductionAuthenticationService::new(
                SqliteTeamRepository::new(pool),
                SqliteUserRepository::new(pool),
                SqliteRoleRepository::new(pool),
                SqliteTokenRepository::new(pool),
            ),
            ProductionCalendarService::new(),
            ProductionTalksService::new(
                SqliteTeamRepository::new(pool),
                SqliteUserRepository::new(pool),
                SqliteTalkRepository::new(pool),
                SqliteMemberRepository::new(pool),
            ),
            ProductionTeamsService::new(SqliteTeamRepository::new(pool)),
        ),
    )
    .await
    .unwrap();
}
