use serde::Serialize;
use sqlx::Error;

use crate::persistence::{team::TeamRepository, user::UserRepository};

pub mod authentication;
pub mod calendar;
pub mod talks;
pub mod teams;

#[derive(Clone, Debug, Serialize)]
pub struct User {
    pub id: i64,
    pub name: String,
    pub team: String,
}

async fn user_ids_to_users(
    user_ids: Vec<i64>,
    user_repository: &impl UserRepository,
    team_repository: &impl TeamRepository,
) -> Result<Vec<User>, Error> {
    let mut users = Vec::new();
    for user_id in user_ids {
        users.push(user_id_to_user(user_id, user_repository, team_repository).await?);
    }
    Ok(users)
}

async fn user_id_to_user(
    user_id: i64,
    user_repository: &impl UserRepository,
    team_repository: &impl TeamRepository,
) -> Result<User, Error> {
    let Some((name, team_id)) = user_repository.get_name_and_team_id_by_id(user_id).await? else {
        return Err(Error::RowNotFound);
    };
    let Some(team) = team_repository.get_name_by_id(team_id).await? else {
        return Err(Error::RowNotFound);
    };
    Ok(User {
        id: user_id,
        name,
        team,
    })
}
