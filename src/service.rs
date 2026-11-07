use argon2::password_hash::phc::SaltString;
use eyre::{bail, Context as _, ContextCompat as _, Result};
use std::{
    collections::BTreeSet,
    sync::Arc,
    time::{Duration, SystemTime},
};

use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use tokio::sync::{broadcast, RwLock};

use crate::{
    storage::{Storage, TokenData, User},
    wire::{AttendanceMode, EventConfig, Role, Schedule, Talk, Update, UserId},
};

#[derive(Debug, Clone)]
pub struct Service {
    pub storage: Arc<RwLock<Storage>>,
    pub updates_sender: broadcast::Sender<Update>,
    pub event: EventConfig,
}

pub struct Authentication {
    pub user_id: UserId,
    pub roles: BTreeSet<Role>,
    pub token: String,
}

impl Service {
    pub async fn register(
        &self,
        name: String,
        team: String,
        attendance_mode: AttendanceMode,
        password: String,
    ) -> Result<Authentication> {
        eyre::ensure!(
            !name.trim().is_empty() && !password.is_empty(),
            "name and password must not be empty"
        );
        let mut user = tokio::task::spawn_blocking(move || {
            User::new(0, name, team, attendance_mode, &password)
        })
        .await??;
        let mut storage = self.storage.write().await;

        if !storage.teams.contains(&user.team) {
            bail!("unknown team {}", user.team);
        }

        if storage
            .users
            .values()
            .any(|existing| existing.name == user.name && existing.team == user.team)
        {
            bail!("user {} from team {} already exists", user.name, user.team);
        }

        let new_user_id = match storage.users.keys().next_back() {
            Some(id) => id.checked_add(1).wrap_err("user IDs exhausted")?,
            None => 0,
        };
        eyre::ensure!(new_user_id <= 9_007_199_254_740_991, "user IDs exhausted");
        user.id = new_user_id;
        storage.users.insert(new_user_id, user);
        storage
            .users
            .commit()
            .await
            .wrap_err("failed to commit users")?;

        // Inform all connected clients about the new user.
        let users_update = Update::Users {
            users: storage
                .users
                .values()
                .map(|user| (user.id, user.into()))
                .collect(),
        };
        let _ = self.updates_sender.send(users_update);

        let token = Self::issue_token(&mut storage, new_user_id)
            .await
            .wrap_err("account created, but signing in failed. Use Login to try again")?;
        Ok(Authentication {
            user_id: new_user_id,
            roles: BTreeSet::new(),
            token,
        })
    }

    pub async fn login(
        &self,
        name: String,
        team: String,
        password: String,
    ) -> Result<Authentication> {
        let user = self
            .storage
            .read()
            .await
            .users
            .values()
            .find(|user| user.name == name && user.team == team)
            .cloned()
            .wrap_err("unknown name or team")?;
        let user = tokio::task::spawn_blocking(move || {
            eyre::ensure!(user.verify(&password), "wrong password");
            Ok::<_, eyre::Report>(user)
        })
        .await??;
        let mut storage = self.storage.write().await;
        eyre::ensure!(
            storage.users.get(&user.id) == Some(&user),
            "user changed during login; try again"
        );
        let token = Self::issue_token(&mut storage, user.id).await?;

        Ok(Authentication {
            user_id: user.id,
            roles: user.roles,
            token,
        })
    }

    async fn issue_token(storage: &mut Storage, user_id: UserId) -> Result<String> {
        let token = SaltString::generate().to_string();
        let now = SystemTime::now();
        storage.tokens.retain(|_, data| data.expires_at >= now);
        storage.tokens.insert(
            token.clone(),
            TokenData {
                user_id,
                expires_at: now + Duration::from_secs(60 * 60 * 24 * 7),
            },
        );
        storage
            .tokens
            .commit()
            .await
            .wrap_err("failed to commit tokens")?;
        Ok(token)
    }

    pub async fn relogin(&self, token: &str) -> Result<Authentication> {
        let storage = self.storage.read().await;
        let user = storage.user_for_token(token)?;

        Ok(Authentication {
            user_id: user.id,
            roles: user.roles.clone(),
            token: token.to_owned(),
        })
    }

    pub async fn logout(&self, token: &str) -> Result<()> {
        let mut storage = self.storage.write().await;
        storage.tokens.remove(token);
        storage.tokens.commit().await
    }

    fn validate_schedule(
        &self,
        scheduled_at: Option<SystemTime>,
        duration: Duration,
    ) -> Result<()> {
        let start = OffsetDateTime::parse(&self.event.start, &Rfc3339)?;
        let end = OffsetDateTime::parse(&self.event.end, &Rfc3339)?;
        eyre::ensure!(
            duration >= Duration::from_secs(60) && duration <= (end - start).unsigned_abs(),
            "duration must be at least one minute and no longer than the event"
        );
        if let Some(at) = scheduled_at {
            let event_start: SystemTime = start.into();
            let event_end: SystemTime = end.into();
            eyre::ensure!(
                at >= event_start
                    && at
                        .checked_add(duration)
                        .is_some_and(|until| until <= event_end),
                "keep the whole talk inside the event"
            );
        }
        Ok(())
    }

    pub async fn schedule_talk(
        &self,
        talk_id: usize,
        user_id: UserId,
        before: Schedule,
        after: Schedule,
    ) -> Result<()> {
        let mut storage = self.storage.write().await;
        eyre::ensure!(
            storage.users.get(&user_id).is_some_and(User::is_scheduler),
            "user cannot schedule talks"
        );
        eyre::ensure!(
            after
                .location
                .is_none_or(|id| storage.locations.contains_key(&id)),
            "unknown room"
        );
        let talk = storage
            .talks
            .get_mut(&talk_id)
            .wrap_err("talk was deleted")?;
        if Schedule::from(&*talk) == after {
            return Ok(());
        }
        eyre::ensure!(
            Schedule::from(&*talk) == before,
            "this talk's schedule changed; cancel and reopen to refresh"
        );
        self.validate_schedule(after.scheduled_at, after.duration)?;
        if talk.duration != after.duration {
            talk.creator_duration.get_or_insert(talk.duration);
            if talk.creator == user_id {
                talk.creator_duration = Some(after.duration);
            }
        }
        talk.scheduled_at = after.scheduled_at;
        talk.duration = after.duration;
        talk.location = after.location;
        let talk = talk.clone();
        storage
            .talks
            .commit()
            .await
            .wrap_err("failed to commit talks")?;
        let _ = self.updates_sender.send(Update::AddTalk { talk });
        Ok(())
    }

    pub async fn add_talk(
        &self,
        user_id: UserId,
        title: String,
        description: String,
        duration: Duration,
    ) -> Result<()> {
        eyre::ensure!(!title.trim().is_empty(), "talk title must not be empty");
        self.validate_schedule(None, duration)?;
        let mut storage = self.storage.write().await;
        eyre::ensure!(storage.users.contains_key(&user_id), "unknown user");
        let next_talk_id = *storage.next_talk_id;
        eyre::ensure!(next_talk_id < 9_007_199_254_740_991, "talk IDs exhausted");
        *storage.next_talk_id += 1;
        storage.next_talk_id.commit().await?;
        let talks = &mut storage.talks;
        let talk = Talk {
            id: next_talk_id,
            creator: user_id,
            title,
            description,
            highlight: false,
            scheduled_at: None,
            duration,
            creator_duration: Some(duration),
            location: None,
            nerds: BTreeSet::from([user_id]),
            noobs: Default::default(),
        };
        talks.insert(next_talk_id, talk.clone());
        talks.commit().await.wrap_err("failed to commit talks")?;
        let _ = self.updates_sender.send(Update::AddTalk { talk });
        Ok(())
    }

    pub async fn remove_talk(&self, talk_id: usize, user_id: UserId) -> Result<()> {
        let mut storage = self.storage.write().await;
        let Storage { users, talks, .. } = &mut *storage;
        let user = users
            .get(&user_id)
            .wrap_err_with(|| format!("user {user_id} does not exist"))?;
        let talk = talks
            .get(&talk_id)
            .wrap_err_with(|| format!("talk {talk_id} does not exist"))?;
        if !(user.is_editor() || user.is_scheduler() || user.is_creator(talk)) {
            bail!("user cannot edit talk with id {talk_id}");
        }
        talks.remove(&talk_id);
        talks.commit().await.wrap_err("failed to commit talks")?;
        let _ = self.updates_sender.send(Update::RemoveTalk { talk_id });
        Ok(())
    }

    async fn edit_talk(
        &self,
        talk_id: usize,
        user_id: UserId,
        edit: impl FnOnce(&User, &mut Talk, &Storage) -> Result<Update>,
    ) -> Result<()> {
        let mut storage = self.storage.write().await;
        let user = storage
            .users
            .get(&user_id)
            .wrap_err_with(|| format!("user {user_id} does not exist"))?;
        let mut talk = storage
            .talks
            .get(&talk_id)
            .cloned()
            .wrap_err_with(|| format!("talk {talk_id} does not exist"))?;
        let update = edit(user, &mut talk, &storage)?;
        storage.talks.insert(talk_id, talk);
        storage
            .talks
            .commit()
            .await
            .wrap_err("failed to commit talks")?;
        let _ = self.updates_sender.send(update);
        Ok(())
    }

    pub async fn update_title(&self, talk_id: usize, user_id: UserId, title: String) -> Result<()> {
        eyre::ensure!(!title.trim().is_empty(), "talk title must not be empty");
        self.edit_talk(talk_id, user_id, |user, talk, _| {
            eyre::ensure!(
                user.is_editor() || user.is_creator(talk),
                "user cannot edit talk with id {talk_id}"
            );
            talk.title = title.clone();
            Ok(Update::UpdateTitle { talk_id, title })
        })
        .await
    }

    pub async fn update_description(
        &self,
        talk_id: usize,
        user_id: UserId,
        description: String,
    ) -> Result<()> {
        self.edit_talk(talk_id, user_id, |user, talk, _| {
            eyre::ensure!(
                user.is_editor() || user.is_creator(talk),
                "user cannot edit talk with id {talk_id}"
            );
            talk.description = description.clone();
            Ok(Update::UpdateDescription {
                talk_id,
                description,
            })
        })
        .await
    }

    pub async fn update_scheduled_at(
        &self,
        talk_id: usize,
        user_id: UserId,
        scheduled_at: Option<SystemTime>,
    ) -> Result<()> {
        self.edit_talk(talk_id, user_id, |user, talk, _| {
            eyre::ensure!(user.is_scheduler(), "user cannot schedule talks");
            self.validate_schedule(scheduled_at, talk.duration)?;
            talk.scheduled_at = scheduled_at;
            Ok(Update::UpdateScheduledAt {
                talk_id,
                scheduled_at,
            })
        })
        .await
    }

    pub async fn update_duration(
        &self,
        talk_id: usize,
        user_id: UserId,
        duration: Duration,
    ) -> Result<()> {
        self.edit_talk(talk_id, user_id, |user, talk, _| {
            eyre::ensure!(
                user.is_scheduler() || user.is_creator(talk),
                "user cannot change duration of talk with id {talk_id}"
            );
            self.validate_schedule(talk.scheduled_at, duration)?;
            if user.is_creator(talk) {
                talk.creator_duration = Some(duration);
            }
            let creator_duration = *talk.creator_duration.get_or_insert(talk.duration);
            talk.duration = duration;
            Ok(Update::UpdateDuration {
                talk_id,
                duration,
                creator_duration,
            })
        })
        .await
    }

    pub async fn update_location(
        &self,
        talk_id: usize,
        user_id: UserId,
        location: Option<usize>,
    ) -> Result<()> {
        self.edit_talk(talk_id, user_id, |user, talk, storage| {
            eyre::ensure!(
                location.is_none_or(|id| storage.locations.contains_key(&id)),
                "unknown room"
            );
            eyre::ensure!(
                user.is_scheduler() || user.is_creator(talk),
                "user cannot schedule talks"
            );
            talk.location = location;
            Ok(Update::UpdateLocation { talk_id, location })
        })
        .await
    }

    pub async fn add_noob(&self, talk_id: usize, user_id: UserId) -> Result<()> {
        self.edit_talk(talk_id, user_id, |_, talk, _| {
            talk.noobs.insert(user_id);
            Ok(Update::AddNoob { talk_id, user_id })
        })
        .await
    }

    pub async fn remove_noob(&self, talk_id: usize, user_id: UserId) -> Result<()> {
        self.edit_talk(talk_id, user_id, |_, talk, _| {
            talk.noobs.remove(&user_id);
            Ok(Update::RemoveNoob { talk_id, user_id })
        })
        .await
    }

    pub async fn add_nerd(&self, talk_id: usize, user_id: UserId) -> Result<()> {
        self.edit_talk(talk_id, user_id, |_, talk, _| {
            talk.nerds.insert(user_id);
            Ok(Update::AddNerd { talk_id, user_id })
        })
        .await
    }

    pub async fn remove_nerd(&self, talk_id: usize, user_id: UserId) -> Result<()> {
        self.edit_talk(talk_id, user_id, |_, talk, _| {
            talk.nerds.remove(&user_id);
            Ok(Update::RemoveNerd { talk_id, user_id })
        })
        .await
    }

    pub async fn set_attendance_mode(
        &self,
        user_id: UserId,
        attendance_mode: AttendanceMode,
    ) -> Result<()> {
        let mut storage = self.storage.write().await;
        let user = storage
            .users
            .get_mut(&user_id)
            .wrap_err_with(|| format!("user {user_id} does not exist"))?;
        user.attendance_mode = attendance_mode;
        storage
            .users
            .commit()
            .await
            .wrap_err("failed to commit users")?;
        let _ = self.updates_sender.send(Update::UpdateAttendanceMode {
            user_id,
            attendance_mode,
        });
        Ok(())
    }
}
