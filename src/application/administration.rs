use std::{
    collections::{BTreeMap, BTreeSet},
    time::{Duration, SystemTime},
};

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use sqlx::Error;

use crate::persistence::{
    member::{Member, MemberRepository},
    role::{Role as PersistenceRole, RoleRepository, UserRole},
    talk::{Talk as PersistenceTalk, TalkRepository},
    team::{Team, TeamRepository},
    token::{Token as PersistenceToken, TokenRepository},
    user::{User as PersistenceUser, UserRepository},
};

use super::authentication::hash;

#[async_trait]
pub trait AdministrationService {
    async fn reset_password(&self, user: &str, team: &str, password: &str) -> Result<(), Error>;
    async fn import(
        &self,
        teams: BTreeSet<String>,
        users: BTreeMap<usize, User>,
        tokens: BTreeMap<String, Token>,
        talks: BTreeMap<usize, Talk>,
    ) -> Result<(), Error>;
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct User {
    pub id: usize,
    pub name: String,
    pub team: String,
    pub hash: String,
    pub roles: BTreeSet<Role>,
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, Serialize)]
pub enum Role {
    Editor,
    Scheduler,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Talk {
    pub id: usize,
    pub creator: usize,
    pub title: String,
    pub description: String,
    pub scheduled_at: Option<SystemTime>,
    pub duration: Duration,
    pub location: Option<String>,
    pub nerds: Vec<usize>,
    pub noobs: Vec<usize>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Token {
    pub user_id: usize,
    pub expires_at: SystemTime,
}

pub struct ProductionAdministrationService<
    TeamRepo,
    UserRepo,
    RoleRepo,
    TokenRepo,
    TalkRepo,
    MemberRepo,
> {
    team_repository: TeamRepo,
    user_repository: UserRepo,
    role_repository: RoleRepo,
    token_repository: TokenRepo,
    talk_repository: TalkRepo,
    member_repository: MemberRepo,
}

impl<
        TeamRepo: TeamRepository,
        UserRepo: UserRepository,
        RoleRepo: RoleRepository,
        TokenRepo: TokenRepository,
        TalkRepo: TalkRepository,
        MemberRepo: MemberRepository,
    >
    ProductionAdministrationService<TeamRepo, UserRepo, RoleRepo, TokenRepo, TalkRepo, MemberRepo>
{
    pub fn new(
        team_repository: TeamRepo,
        user_repository: UserRepo,
        role_repository: RoleRepo,
        token_repository: TokenRepo,
        talk_repository: TalkRepo,
        member_repository: MemberRepo,
    ) -> Self {
        Self {
            team_repository,
            user_repository,
            role_repository,
            token_repository,
            talk_repository,
            member_repository,
        }
    }
}

#[async_trait]
impl<
        TeamRepo: TeamRepository + Send + Sync,
        UserRepo: UserRepository + Send + Sync,
        RoleRepo: RoleRepository + Send + Sync,
        TokenRepo: TokenRepository + Send + Sync,
        TalkRepo: TalkRepository + Send + Sync,
        MemberRepo: MemberRepository + Send + Sync,
    > AdministrationService
    for ProductionAdministrationService<
        TeamRepo,
        UserRepo,
        RoleRepo,
        TokenRepo,
        TalkRepo,
        MemberRepo,
    >
{
    async fn reset_password(&self, user: &str, team: &str, password: &str) -> Result<(), Error> {
        let Some(team_id) = self.team_repository.get_id_by_name(team).await? else {
            eprintln!("unknown team");
            return Ok(());
        };

        let Some(user_id) = self.user_repository.get_id_by_name_and_team(user, team_id).await? else {
            eprintln!("unknown user");
            return Ok(());
        };

        let hash = hash(password);

        self.user_repository.update_hash(user_id, &hash).await
    }

    async fn import(
        &self,
        teams: BTreeSet<String>,
        users: BTreeMap<usize, User>,
        tokens: BTreeMap<String, Token>,
        talks: BTreeMap<usize, Talk>,
    ) -> Result<(), Error> {
        let (persistence_teams, team_ids): (_, BTreeMap<String, i64>) = teams
            .into_iter()
            .enumerate()
            .map(|(id, name)| {
                (
                    Team {
                        id: id as i64,
                        name: name.clone(),
                    },
                    (name, id as i64),
                )
            })
            .unzip();
        let persistence_roles = users
            .iter()
            .flat_map(|(id, user)| {
                user.roles.iter().map(|role| UserRole {
                    user: *id as i64,
                    role: match role {
                        Role::Editor => PersistenceRole::Editor,
                        Role::Scheduler => PersistenceRole::Scheduler,
                    },
                })
            })
            .collect();
        let persistence_users = users
            .into_iter()
            .map(|(id, user)| PersistenceUser {
                id: id as i64,
                name: user.name,
                team_id: *team_ids.get(&user.team).unwrap(),
                hash: user.hash,
            })
            .collect();
        let persistence_tokens = tokens
            .into_iter()
            .map(|(token, user_and_expires_at)| PersistenceToken {
                token,
                user_id: user_and_expires_at.user_id as i64,
                expires_at: user_and_expires_at.expires_at,
            })
            .collect();
        let persistence_members = talks
            .iter()
            .flat_map(|(id, talk)| {
                talk.nerds
                    .iter()
                    .map(|user_id| Member {
                        user_id: *user_id as i64,
                        talk_id: *id as i64,
                        is_nerd: true,
                    })
                    .chain(talk.noobs.iter().map(|user_id| Member {
                        user_id: *user_id as i64,
                        talk_id: *id as i64,
                        is_nerd: false,
                    }))
            })
            .collect();
        let persistence_talks = talks
            .into_iter()
            .map(|(_id, talk)| PersistenceTalk {
                id: talk.id as i64,
                creator: talk.creator as i64,
                title: talk.title,
                description: talk.description,
                scheduled_at: talk.scheduled_at,
                duration: talk.duration,
                location: talk.location,
            })
            .collect();

        self.member_repository.clear().await?;
        self.talk_repository.clear().await?;
        self.token_repository.clear().await?;
        self.role_repository.clear().await?;
        self.user_repository.clear().await?;
        self.team_repository.clear().await?;

        self.team_repository.import(persistence_teams).await?;
        self.user_repository.import(persistence_users).await?;
        self.role_repository.import(persistence_roles).await?;
        self.token_repository.import(persistence_tokens).await?;
        self.talk_repository.import(persistence_talks).await?;
        self.member_repository.import(persistence_members).await?;

        Ok(())
    }
}
