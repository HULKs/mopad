use std::{fs::File, path::PathBuf, sync::Arc};

use clap::{Parser, Subcommand};
use mopad::{
    application::administration::{
        AdministrationService, ProductionAdministrationService, Talk, User,
    },
    persistence::{
        member::SqliteMemberRepository, role::SqliteRoleRepository, talk::SqliteTalkRepository,
        team::SqliteTeamRepository, token::SqliteTokenRepository, user::SqliteUserRepository,
    },
};
use serde_json::from_reader;
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
    Import {
        teams_path: PathBuf,
        users_path: PathBuf,
        tokens_path: PathBuf,
        talks_path: PathBuf,
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
        SqliteRoleRepository::new(pool.clone()),
        SqliteTokenRepository::new(pool.clone()),
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
        Command::Import {
            teams_path,
            users_path,
            tokens_path,
            talks_path,
        } => {
            let teams = from_reader(File::open(teams_path).unwrap()).unwrap();
            let users = from_reader::<_, Vec<User>>(File::open(users_path).unwrap())
                .unwrap()
                .into_iter()
                .map(|user| (user.id, user))
                .collect();
            let tokens = from_reader(File::open(tokens_path).unwrap()).unwrap();
            let talks = from_reader::<_, Vec<Talk>>(File::open(talks_path).unwrap())
                .unwrap()
                .into_iter()
                .map(|talk| (talk.id, talk))
                .collect();
            service.import(teams, users, tokens, talks).await.unwrap();
        }
    }
}
