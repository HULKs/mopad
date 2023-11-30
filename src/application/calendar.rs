use std::time::{Duration, SystemTime};

use async_trait::async_trait;
use serde::Serialize;
use sqlx::Error;

use crate::persistence::{
    member::MemberRepository, talk::TalkRepository, team::TeamRepository, user::UserRepository,
};

use super::{user_ids_to_users, User};

#[async_trait]
pub trait CalendarService {
    async fn get_talks(&self, user_id: Option<i64>) -> Result<Vec<Talk>, Error>;
}

#[derive(Debug, Serialize)]
pub struct Talk {
    pub id: i64,
    pub title: String,
    pub description: String,
    pub scheduled_at: Option<SystemTime>,
    pub duration: Duration,
    pub location: Option<String>,
    pub nerds: Vec<User>,
    pub noobs: Vec<User>,
}

pub struct ProductionCalendarService<TeamRepo, UserRepo, TalkRepo, MemberRepo> {
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
    > ProductionCalendarService<TeamRepo, UserRepo, TalkRepo, MemberRepo>
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
    > CalendarService for ProductionCalendarService<TeamRepo, UserRepo, TalkRepo, MemberRepo>
{
    async fn get_talks(&self, user_id: Option<i64>) -> Result<Vec<Talk>, Error> {
        let mut talks = Vec::new();
        for talk in self.talk_repository.get_all().await? {
            let (nerd_ids, noob_ids) = self
                .member_repository
                .get_nerds_and_noobs_by_talk(talk.id)
                .await?;

            if let Some(user_id) = user_id {
                if !nerd_ids.contains(&user_id) && !noob_ids.contains(&user_id) {
                    continue;
                }
            }

            let nerds =
                user_ids_to_users(nerd_ids, &self.user_repository, &self.team_repository).await?;
            let noobs =
                user_ids_to_users(noob_ids, &self.user_repository, &self.team_repository).await?;

            talks.push(Talk {
                id: talk.id,
                title: talk.title,
                description: talk.description,
                scheduled_at: talk.scheduled_at,
                duration: talk.duration,
                location: talk.location,
                nerds,
                noobs,
            });
        }
        Ok(talks)
    }
}
