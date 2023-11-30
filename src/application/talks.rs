use std::{
    collections::HashSet,
    time::{Duration, SystemTime},
};

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use sqlx::Error;
use tokio::sync::broadcast::{channel, Receiver, Sender};

use crate::persistence::{
    member::{MemberRepository, State},
    talk::TalkRepository,
    team::TeamRepository,
    user::UserRepository,
};

use super::authentication::Capability;

#[async_trait]
pub trait TalksService {
    async fn trigger(
        &self,
        user_id: i64,
        capabilities: &HashSet<Capability>,
        command: Command,
    ) -> Result<(), Error>;
    fn register_for_updates(&self) -> Receiver<Update>;
    async fn get_all_talks(&self) -> Result<Vec<Talk>, Error>;
}

#[derive(Deserialize)]
pub enum Command {
    AddTalk,
    RemoveTalk {
        id: i64,
    },
    UpdateTitle {
        id: i64,
        title: String,
    },
    UpdateDescription {
        id: i64,
        description: String,
    },
    UpdateScheduledAt {
        id: i64,
        scheduled_at: Option<SystemTime>,
    },
    UpdateDuration {
        id: i64,
        duration: Duration,
    },
    UpdateLocation {
        id: i64,
        location: Option<String>,
    },
    ToggleNerd {
        id: i64,
    },
    ToggleNoob {
        id: i64,
    },
}

#[derive(Clone, Serialize)]
pub enum Update {
    AddTalk(Talk),
    RemoveTalk {
        id: i64,
    },
    UpdateTitle {
        id: i64,
        title: String,
    },
    UpdateDescription {
        id: i64,
        description: String,
    },
    UpdateScheduledAt {
        id: i64,
        scheduled_at: Option<SystemTime>,
    },
    UpdateDuration {
        id: i64,
        duration: Duration,
    },
    UpdateLocation {
        id: i64,
        location: Option<String>,
    },
    UpdateNerds {
        id: i64,
        nerds: Vec<User>,
    },
    UpdateNoobs {
        id: i64,
        noobs: Vec<User>,
    },
}

#[derive(Clone, Serialize)]
pub struct Talk {
    id: i64,
    creator: User,
    title: String,
    description: String,
    scheduled_at: Option<SystemTime>,
    duration: Duration,
    location: Option<String>,
    nerds: Vec<User>,
    noobs: Vec<User>,
}

#[derive(Clone, Serialize)]
pub struct User {
    id: i64,
    name: String,
    team: String,
}

pub struct ProductionTalksService<TeamRepo, UserRepo, TalkRepo, MemberRepo> {
    team_repository: TeamRepo,
    user_repository: UserRepo,
    talk_repository: TalkRepo,
    member_repository: MemberRepo,
    sender: Sender<Update>,
}

impl<
        TeamRepo: TeamRepository,
        UserRepo: UserRepository,
        TalkRepo: TalkRepository,
        MemberRepo: MemberRepository,
    > ProductionTalksService<TeamRepo, UserRepo, TalkRepo, MemberRepo>
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
            sender: channel(1337).0,
        }
    }
}

#[async_trait]
impl<
        TeamRepo: TeamRepository + Send + Sync,
        UserRepo: UserRepository + Send + Sync,
        TalkRepo: TalkRepository + Send + Sync,
        MemberRepo: MemberRepository + Send + Sync,
    > TalksService for ProductionTalksService<TeamRepo, UserRepo, TalkRepo, MemberRepo>
{
    async fn trigger(
        &self,
        user_id: i64,
        capabilities: &HashSet<Capability>,
        command: Command,
    ) -> Result<(), Error> {
        if !is_authorized(user_id, capabilities, &self.talk_repository, &command).await? {
            // TODO: log authorization violation
            return Ok(());
        }

        match command {
            Command::AddTalk => {
                let Some((user, team_id)) = self.user_repository.get_name_and_team_id_by_id(user_id).await? else {
                    // TODO: log inconsistency
                    return Ok(());
                };
                let Some(team) = self.team_repository.get_name_by_id(team_id).await? else {
                    // TODO: log inconsistency
                    return Ok(());
                };

                let title = format!("New talk from {user}");
                let description =
                    "You can change the title, duration, and description by clicking on them"
                        .to_string();
                let scheduled_at = None;
                let duration = Duration::from_secs(30 * 60);
                let location = Option::<String>::None;

                let id = self
                    .talk_repository
                    .insert(
                        user_id,
                        &title,
                        &description,
                        scheduled_at,
                        duration,
                        location.as_ref().map(String::as_str),
                    )
                    .await?;

                let _ = self.sender.send(Update::AddTalk(Talk {
                    id,
                    creator: User {
                        id: user_id,
                        name: user,
                        team,
                    },
                    title,
                    description,
                    scheduled_at,
                    duration,
                    location,
                    nerds: Default::default(),
                    noobs: Default::default(),
                }));
            }
            Command::RemoveTalk { id } => {
                self.member_repository.delete_by_talk(id).await?;
                self.talk_repository.delete(id).await?;
                let _ = self.sender.send(Update::RemoveTalk { id });
            }
            Command::UpdateTitle { id, title } => {
                self.talk_repository.update_title(id, &title).await?;
                let _ = self.sender.send(Update::UpdateTitle { id, title });
            }
            Command::UpdateDescription { id, description } => {
                self.talk_repository
                    .update_description(id, &description)
                    .await?;
                let _ = self
                    .sender
                    .send(Update::UpdateDescription { id, description });
            }
            Command::UpdateScheduledAt { id, scheduled_at } => {
                self.talk_repository
                    .update_scheduled_at(id, scheduled_at)
                    .await?;
                let _ = self
                    .sender
                    .send(Update::UpdateScheduledAt { id, scheduled_at });
            }
            Command::UpdateDuration { id, duration } => {
                self.talk_repository.update_duration(id, duration).await?;
                let _ = self.sender.send(Update::UpdateDuration { id, duration });
            }
            Command::UpdateLocation { id, location } => {
                self.talk_repository
                    .update_location(id, location.as_ref().map(String::as_str))
                    .await?;
                let _ = self.sender.send(Update::UpdateLocation { id, location });
            }
            Command::ToggleNerd { id } => {
                let current_state = self
                    .member_repository
                    .get_state_by_user_and_talk(user_id, id)
                    .await?;
                let (new_state, nerds_changed, noobs_changed) = match current_state {
                    State::None => (State::Nerd, true, false),
                    State::Nerd => (State::None, true, false),
                    State::Noob => (State::Nerd, true, true),
                };
                self.member_repository
                    .set_state_by_user_and_talk(user_id, id, new_state)
                    .await?;
                let (nerd_ids, noob_ids) = self
                    .member_repository
                    .get_nerds_and_noobs_by_talk(id)
                    .await?;
                if nerds_changed {
                    let _ = self.sender.send(Update::UpdateNerds {
                        id,
                        nerds: user_ids_to_users(
                            nerd_ids,
                            &self.user_repository,
                            &self.team_repository,
                        )
                        .await?,
                    });
                }
                if noobs_changed {
                    let _ = self.sender.send(Update::UpdateNoobs {
                        id,
                        noobs: user_ids_to_users(
                            noob_ids,
                            &self.user_repository,
                            &self.team_repository,
                        )
                        .await?,
                    });
                }
            }
            Command::ToggleNoob { id } => {
                let current_state = self
                    .member_repository
                    .get_state_by_user_and_talk(user_id, id)
                    .await?;
                let (new_state, nerds_changed, noobs_changed) = match current_state {
                    State::None => (State::Noob, false, true),
                    State::Nerd => (State::Noob, true, true),
                    State::Noob => (State::None, false, true),
                };
                self.member_repository
                    .set_state_by_user_and_talk(user_id, id, new_state)
                    .await?;
                let (nerd_ids, noob_ids) = self
                    .member_repository
                    .get_nerds_and_noobs_by_talk(id)
                    .await?;
                if nerds_changed {
                    let _ = self.sender.send(Update::UpdateNerds {
                        id,
                        nerds: user_ids_to_users(
                            nerd_ids,
                            &self.user_repository,
                            &self.team_repository,
                        )
                        .await?,
                    });
                }
                if noobs_changed {
                    let _ = self.sender.send(Update::UpdateNoobs {
                        id,
                        noobs: user_ids_to_users(
                            noob_ids,
                            &self.user_repository,
                            &self.team_repository,
                        )
                        .await?,
                    });
                }
            }
        }

        Ok(())
    }

    fn register_for_updates(&self) -> Receiver<Update> {
        self.sender.subscribe()
    }

    async fn get_all_talks(&self) -> Result<Vec<Talk>, Error> {
        let mut talks = Vec::new();
        for talk in self.talk_repository.get_all().await? {
            let creator =
                user_id_to_user(talk.creator, &self.user_repository, &self.team_repository).await?;

            let (nerd_ids, noob_ids) = self
                .member_repository
                .get_nerds_and_noobs_by_talk(talk.id)
                .await?;
            let nerds =
                user_ids_to_users(nerd_ids, &self.user_repository, &self.team_repository).await?;
            let noobs =
                user_ids_to_users(noob_ids, &self.user_repository, &self.team_repository).await?;

            talks.push(Talk {
                id: talk.id,
                creator,
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

async fn is_authorized(
    user_id: i64,
    capabilities: &HashSet<Capability>,
    talk_repository: &impl TalkRepository,
    command: &Command,
) -> Result<bool, Error> {
    if is_authorized_by_capabilities(capabilities, command) {
        return Ok(true);
    }

    let talk_id = get_talk_id_by_command(command);
    let Some(creator_id) = talk_repository.get_creator_id_by_id(talk_id).await? else {
        return Ok(false);
    };
    Ok(user_id == creator_id)
}

fn is_authorized_by_capabilities(capabilities: &HashSet<Capability>, command: &Command) -> bool {
    match command {
        Command::AddTalk => true,
        Command::RemoveTalk { .. } => capabilities.contains(&Capability::DeleteOtherTalks),
        Command::UpdateTitle { .. } => capabilities.contains(&Capability::ChangeOtherTitles),
        Command::UpdateDescription { .. } => {
            capabilities.contains(&Capability::ChangeOtherDescriptions)
        }
        Command::UpdateScheduledAt { .. } => {
            capabilities.contains(&Capability::ChangeOtherScheduledAts)
        }
        Command::UpdateDuration { .. } => capabilities.contains(&Capability::ChangeOtherDurations),
        Command::UpdateLocation { .. } => capabilities.contains(&Capability::ChangeOtherLocations),
        Command::ToggleNerd { .. } => true,
        Command::ToggleNoob { .. } => true,
    }
}

fn get_talk_id_by_command(command: &Command) -> i64 {
    match command {
        Command::AddTalk => panic!("there is no talk id"),
        Command::RemoveTalk { id } => *id,
        Command::UpdateTitle { id, .. } => *id,
        Command::UpdateDescription { id, .. } => *id,
        Command::UpdateScheduledAt { id, .. } => *id,
        Command::UpdateDuration { id, .. } => *id,
        Command::UpdateLocation { id, .. } => *id,
        Command::ToggleNerd { id } => *id,
        Command::ToggleNoob { id } => *id,
    }
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
