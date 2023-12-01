use std::sync::Arc;

use axum::serve;
use mopad::{
    application::{
        authentication::ProductionAuthenticationService, calendar::ProductionCalendarService,
        talks::ProductionTalksService, teams::ProductionTeamsService,
    },
    persistence::{
        member::SqliteMemberRepository, role::SqliteRoleRepository, talk::SqliteTalkRepository,
        team::SqliteTeamRepository, token::SqliteTokenRepository, user::SqliteUserRepository,
    },
    presentation::ProductionController,
};
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
                SqliteTeamRepository::new(pool.clone()),
                SqliteUserRepository::new(pool.clone()),
                SqliteRoleRepository::new(pool.clone()),
                SqliteTokenRepository::new(pool.clone()),
            ),
            ProductionCalendarService::new(
                SqliteTeamRepository::new(pool.clone()),
                SqliteUserRepository::new(pool.clone()),
                SqliteTalkRepository::new(pool.clone()),
                SqliteMemberRepository::new(pool.clone()),
            ),
            ProductionTalksService::new(
                SqliteTeamRepository::new(pool.clone()),
                SqliteUserRepository::new(pool.clone()),
                SqliteTalkRepository::new(pool.clone()),
                SqliteMemberRepository::new(pool.clone()),
            ),
            ProductionTeamsService::new(SqliteTeamRepository::new(pool)),
        ),
    )
    .await
    .unwrap();
}
