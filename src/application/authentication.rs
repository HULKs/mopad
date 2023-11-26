use std::{
    collections::HashSet,
    time::{Duration, SystemTime},
};

use argon2::{password_hash::SaltString, Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use async_trait::async_trait;
use rand_core::OsRng;
use sqlx::Error;

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

#[derive(Clone, Copy, Eq, Hash, PartialEq)]
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

        let user_id = self
            .user_repository
            .insert_name_and_team_and_hash(name, team_id, &hash)
            .await?;
        // TODO: already registered error

        let token = SaltString::generate(&mut OsRng).to_string();
        let now = SystemTime::now();
        self.token_repository
            .insert_token_for_user(user_id, &token, now + Duration::from_secs(60 * 60 * 24 * 7))
            .await?;

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

        let capabilities = match self.role_repository.get_roles_by_id(user_id).await? {
            Some(roles) => roles
                .into_iter()
                .flat_map(|role| role.into_capabilities())
                .collect(),
            None => Default::default(),
        };

        let token = SaltString::generate(&mut OsRng).to_string();
        let now = SystemTime::now();
        self.token_repository
            .insert_token_for_user(user_id, &token, now + Duration::from_secs(60 * 60 * 24 * 7))
            .await?;

        Ok(Response::Success {
            user_id,
            capabilities,
            token,
        })
    }

    async fn relogin(&self, token: &str) -> Result<Response, Error> {
        let Some(user_id) = self.token_repository.get_user_id(token).await? else {
            return Ok(Response::UnknownToken);
        };

        if !self.user_repository.exists(user_id).await? {
            return Ok(Response::UnknownUserFromToken);
        }

        let capabilities = match self.role_repository.get_roles_by_id(user_id).await? {
            Some(roles) => roles
                .into_iter()
                .flat_map(|role| role.into_capabilities())
                .collect(),
            None => Default::default(),
        };

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

#[async_trait]
pub trait TeamRepository {
    async fn get_id_by_name(&self, name: &str) -> Result<Option<i64>, Error>;
}

#[async_trait]
pub trait UserRepository {
    async fn exists(&self, id: i64) -> Result<bool, Error>;
    async fn get_id_and_hash_by_name_and_team(
        &self,
        name: &str,
        team_id: i64,
    ) -> Result<Option<(i64, String)>, Error>;
    async fn insert_name_and_team_and_hash(
        &self,
        name: &str,
        team_id: i64,
        hash: &str,
    ) -> Result<i64, Error>;
}

#[async_trait]
pub trait RoleRepository {
    async fn get_roles_by_id(&self, user_id: i64) -> Result<Option<Vec<Role>>, Error>;
}

pub enum Role {
    Editor,
    Scheduler,
}

impl Role {
    fn into_capabilities(self) -> impl Iterator<Item = Capability> {
        match self {
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
}

#[async_trait]
pub trait TokenRepository {
    async fn insert_token_for_user(
        &self,
        user_id: i64,
        token: &str,
        expires_at: SystemTime,
    ) -> Result<(), Error>;
    // TODO: remove expired tokens
    async fn get_user_id(&self, token: &str) -> Result<Option<i64>, Error>;
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
