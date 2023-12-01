use async_trait::async_trait;
use sqlx::Error;

use crate::persistence::{
    member::MemberRepository, talk::TalkRepository, team::TeamRepository, user::UserRepository,
};

use super::authentication::hash;

#[async_trait]
pub trait AdministrationService {
    async fn reset_password(&self, user: &str, team: &str, password: &str) -> Result<(), Error>;
}

pub struct ProductionAdministrationService<TeamRepo, UserRepo, TalkRepo, MemberRepo> {
    team_repository: TeamRepo,
    user_repository: UserRepo,
    talk_repository: TalkRepo,
    member_repository: MemberRepo,
}

impl<
        TeamRepo: TeamRepository,
        UserRepo: UserRepository,
        TalkRepo: TalkRepository,
        MemberRepo: MemberRepository,
    > ProductionAdministrationService<TeamRepo, UserRepo, TalkRepo, MemberRepo>
{
    pub fn new(
        team_repository: TeamRepo,
        user_repository: UserRepo,
        talk_repository: TalkRepo,
        member_repository: MemberRepo,
    ) -> Self {
        Self {
            team_repository,
            user_repository,
            talk_repository,
            member_repository,
        }
    }
}

#[async_trait]
impl<
        TeamRepo: TeamRepository + Send + Sync,
        UserRepo: UserRepository + Send + Sync,
        TalkRepo: TalkRepository + Send + Sync,
        MemberRepo: MemberRepository + Send + Sync,
    > AdministrationService
    for ProductionAdministrationService<TeamRepo, UserRepo, TalkRepo, MemberRepo>
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
}
