use std::{
    collections::HashSet,
    time::{Duration, SystemTime},
};

use argon2::{password_hash::SaltString, Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use async_trait::async_trait;
use rand_core::OsRng;
use serde::Serialize;
use sqlx::Error;

use crate::persistence::{
    role::{Role, RoleRepository},
    team::TeamRepository,
    token::TokenRepository,
    user::UserRepository,
};

#[async_trait]
pub trait AuthenticationService {
    async fn register(&self, name: &str, team: &str, password: &str) -> Result<Response, Error>;
    async fn login(&self, name: &str, team: &str, password: &str) -> Result<Response, Error>;
    async fn relogin(&self, token: &str) -> Result<Response, Error>;
}

pub enum Response {
    Success {
        user_id: i64,
        capabilities: HashSet<Capability>,
        token: String,
    },
    UnknownTeam,
    AlreadyRegistered,
    WrongPassword,
    UnknownUser,
    UnknownUserFromToken,
    UnknownToken,
}

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq, Serialize)]
pub enum Capability {
    DeleteOtherTalks,
    ChangeOtherTitles,
    ChangeOtherDescriptions,
    ChangeOtherDurations,
    ChangeOtherScheduledAts,
    ChangeOtherLocations,
}

pub struct ProductionAuthenticationService<TeamRepo, UserRepo, RoleRepo, TokenRepo> {
    team_repository: TeamRepo,
    user_repository: UserRepo,
    role_repository: RoleRepo,
    token_repository: TokenRepo,
}

impl<
        TeamRepo: TeamRepository,
        UserRepo: UserRepository,
        RoleRepo: RoleRepository,
        TokenRepo: TokenRepository,
    > ProductionAuthenticationService<TeamRepo, UserRepo, RoleRepo, TokenRepo>
{
    pub fn new(
        team_repository: TeamRepo,
        user_repository: UserRepo,
        role_repository: RoleRepo,
        token_repository: TokenRepo,
    ) -> Self {
        Self {
            team_repository,
            user_repository,
            role_repository,
            token_repository,
        }
    }
}

#[async_trait]
impl<
        TeamRepo: TeamRepository + Send + Sync,
        UserRepo: UserRepository + Send + Sync,
        RoleRepo: RoleRepository + Send + Sync,
        TokenRepo: TokenRepository + Send + Sync,
    > AuthenticationService
    for ProductionAuthenticationService<TeamRepo, UserRepo, RoleRepo, TokenRepo>
{
    async fn register(&self, name: &str, team: &str, password: &str) -> Result<Response, Error> {
        let Some(team_id) = self.team_repository.get_id_by_name(team).await? else {
            return Ok(Response::UnknownTeam);
        };

        let salt = SaltString::generate(&mut OsRng);
        let hash = Argon2::default()
            .hash_password(password.as_bytes(), &salt)
            .unwrap()
            .to_string();

        let Some(user_id) = self.user_repository.insert_name_and_team_and_hash(name, team_id, &hash).await? else {
            return Ok(Response::AlreadyRegistered);
        };

        let token = SaltString::generate(&mut OsRng).to_string();
        let now = SystemTime::now();
        self.token_repository
            .insert_or_update_token_for_user(
                &token,
                user_id,
                now + Duration::from_secs(60 * 60 * 24 * 7),
            )
            .await?;
        self.token_repository.delete_later_than(now).await?;

        Ok(Response::Success {
            user_id,
            capabilities: Default::default(),
            token,
        })
    }

    async fn login(&self, name: &str, team: &str, password: &str) -> Result<Response, Error> {
        // TODO: transaction
        let Some(team_id) = self.team_repository.get_id_by_name(team).await? else {
            return Ok(Response::UnknownTeam);
        };

        let Some((user_id, stored_hash)) = self.user_repository.get_id_and_hash_by_name_and_team(name, team_id).await? else {
            return Ok(Response::UnknownUser);
        };

        if !verify(&stored_hash, password) {
            return Ok(Response::WrongPassword);
        }

        let capabilities = self
            .role_repository
            .get_roles_by_id(user_id)
            .await?
            .into_iter()
            .flat_map(|role| into_capabilities(role))
            .collect();

        let token = SaltString::generate(&mut OsRng).to_string();
        let now = SystemTime::now();
        self.token_repository
            .insert_or_update_token_for_user(
                &token,
                user_id,
                now + Duration::from_secs(60 * 60 * 24 * 7),
            )
            .await?;
        self.token_repository.delete_later_than(now).await?;

        Ok(Response::Success {
            user_id,
            capabilities,
            token,
        })
    }

    async fn relogin(&self, token: &str) -> Result<Response, Error> {
        self.token_repository
            .delete_later_than(SystemTime::now())
            .await?;

        let Some(user_id) = self.token_repository.get_user_id(token).await? else {
            return Ok(Response::UnknownToken);
        };

        if !self.user_repository.exists(user_id).await? {
            return Ok(Response::UnknownUserFromToken);
        }

        let capabilities = self
            .role_repository
            .get_roles_by_id(user_id)
            .await?
            .into_iter()
            .flat_map(|role| into_capabilities(role))
            .collect();

        Ok(Response::Success {
            user_id,
            capabilities,
            token: token.to_string(),
        })
    }
}

fn verify(stored_hash: &str, password_to_verify: &str) -> bool {
    let stored_hash = PasswordHash::new(stored_hash).unwrap();
    Argon2::default()
        .verify_password(password_to_verify.as_bytes(), &stored_hash)
        .is_ok()
}

fn into_capabilities(role: Role) -> impl Iterator<Item = Capability> {
    match role {
        Role::Editor => [
            Capability::DeleteOtherTalks,
            Capability::ChangeOtherTitles,
            Capability::ChangeOtherDescriptions,
            Capability::ChangeOtherDurations,
        ]
        .as_slice()
        .into_iter()
        .copied(),
        Role::Scheduler => [
            Capability::ChangeOtherScheduledAts,
            Capability::ChangeOtherDurations,
            Capability::ChangeOtherLocations,
        ]
        .as_slice()
        .into_iter()
        .copied(),
    }
}

#[cfg(test)]
mod tests {
    fn register_succeeds() {}
    fn register_with_unknown_team_results_in_error() {}
    fn register_with_existing_user_results_in_error() {}
    fn register_inserts_token() {}
    fn login_succeeds() {}
    fn login_with_unknown_team_results_in_error() {}
    fn login_with_unknown_user_results_in_error() {}
    fn login_with_wrong_password_results_in_error() {}
    fn login_outputs_capabilities_from_roles() {}
    fn login_inserts_token() {}
    fn relogin_succeeds() {}
    fn relogin_with_unknown_token_results_in_error() {}
    fn relogin_outputs_capabilities_from_roles() {}
}
