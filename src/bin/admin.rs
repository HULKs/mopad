use std::sync::Arc;

use clap::{Parser, Subcommand};
use mopad::{
    application::administration::{AdministrationService, ProductionAdministrationService},
    persistence::{
        member::SqliteMemberRepository, talk::SqliteTalkRepository, team::SqliteTeamRepository,
        user::SqliteUserRepository,
    },
};
use sqlx::SqlitePool;

#[derive(Parser)]
#[clap(name = "admin")]
struct Arguments {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    ResetPassword {
        user: String,
        team: String,
        new_password: String,
    },
}

#[tokio::main]
async fn main() {
    let arguments = Arguments::parse();

    let pool = Arc::new(
        SqlitePool::connect("sqlite:persistence.sqlite3")
            .await
            .unwrap(),
    );

    let service = ProductionAdministrationService::new(
        SqliteTeamRepository::new(pool.clone()),
        SqliteUserRepository::new(pool.clone()),
        SqliteTalkRepository::new(pool.clone()),
        SqliteMemberRepository::new(pool.clone()),
    );

    match arguments.command {
        Command::ResetPassword {
            user,
            team,
            new_password,
        } => service
            .reset_password(&user, &team, &new_password)
            .await
            .unwrap(),
    }
}
