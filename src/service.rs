use argon2::password_hash::SaltString;
use eyre::{bail, Context as _, ContextCompat as _, Result};
use rand_core::OsRng;
use std::{
    collections::BTreeSet,
    ops::DerefMut as _,
    sync::Arc,
    time::{Duration, SystemTime},
};

use tokio::sync::{broadcast, RwLock};

use crate::{
    messages::Update,
    storage::{AttendanceMode, Role, Storage, Talk, UserId},
};

#[derive(Debug, Clone)]
pub struct Service {
    pub storage: Arc<RwLock<Storage>>,
    pub updates_sender: broadcast::Sender<Update>,
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
    ) -> eyre::Result<Authentication> {
        let storage = &mut self.storage.write().await;

        if !storage.teams.contains(&team) {
            bail!("unknown team {team}");
        }

        if storage
            .users
            .values()
            .any(|user| user.name == name && user.team == team)
        {
            bail!("user {name} from team {team} already exists");
        }

        let new_user_id = storage.add_user(name, team, attendance_mode, password);
        storage
            .users
            .commit()
            .await
            .expect("failed to commit users");

        // Inform all connected clients about the new user.
        let users_update = Update::Users {
            users: storage
                .users
                .values()
                .map(|user| (user.id, user.into()))
                .collect(),
        };
        let _ = self.updates_sender.send(users_update);

        let token = SaltString::generate(&mut OsRng).to_string();
        let now = SystemTime::now();
        let seven_days = Duration::from_secs(60 * 60 * 24 * 7);
        storage.tokens.remove_expired(now);
        storage
            .tokens
            .insert(token.clone(), new_user_id, now + seven_days);
        storage
            .tokens
            .commit()
            .await
            .wrap_err("failed to commit tokens")?;
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
    ) -> eyre::Result<Authentication> {
        let storage = &mut self.storage.write().await;
        let Storage { users, tokens, .. } = storage.deref_mut();

        let Some(user) = users
            .values()
            .find(|user| user.name == name && user.team == team)
        else {
            bail!("unknown user {name} from team {team}");
        };

        if !user.verify(password) {
            bail!("wrong password");
        }

        let token = SaltString::generate(&mut OsRng).to_string();
        let now = SystemTime::now();
        let seven_days = Duration::from_secs(60 * 60 * 24 * 7);
        tokens.remove_expired(now);
        tokens.insert(token.clone(), user.id, now + seven_days);
        tokens.commit().await.wrap_err("failed to commit tokens")?;

        Ok(Authentication {
            user_id: user.id,
            roles: user.roles.clone(),
            token,
        })
    }

    pub async fn relogin(&self, token: String) -> eyre::Result<Authentication> {
        let storage = &mut self.storage.write().await;

        let now = SystemTime::now();
        storage.tokens.remove_expired(now);
        storage
            .tokens
            .commit()
            .await
            .wrap_err("failed to commit tokens")?;

        let data = storage.tokens.get(&token).wrap_err("unknown token")?;
        let user = storage
            .users
            .get(&data.user_id)
            .wrap_err("unknown user id from token")?;

        Ok(Authentication {
            user_id: user.id,
            roles: user.roles.clone(),
            token,
        })
    }

    pub async fn add_talk(
        &self,
        user_id: UserId,
        title: String,
        description: String,
        duration: Duration,
    ) -> Result<()> {
        let talks = &mut self.storage.write().await.talks;
        let max_talk_id = talks.keys().copied().max().unwrap_or_default();
        let next_talk_id = max_talk_id + 1;
        let talk = Talk {
            id: next_talk_id,
            creator: user_id,
            title,
            description,
            scheduled_at: None,
            duration,
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
        let Storage { users, talks, .. } = storage.deref_mut();
        let user = users
            .get(&user_id)
            .wrap_err_with(|| format!("user {user_id} does not exist"))?;
        let talk = talks
            .get_mut(&talk_id)
            .wrap_err_with(|| format!("talk {talk_id} does not exist"))?;
        if !(user.is_editor() || user.is_scheduler() || user.is_creator(talk)) {
            bail!("user cannot edit talk with id {talk_id}");
        }
        let id = talk.id;
        talks.remove(&id);
        talks.commit().await.wrap_err("failed to commit talks")?;
        let _ = self.updates_sender.send(Update::RemoveTalk { talk_id });
        Ok(())
    }

    pub async fn update_title(&self, talk_id: usize, user_id: UserId, title: String) -> Result<()> {
        let mut storage = self.storage.write().await;
        let Storage { users, talks, .. } = storage.deref_mut();
        let user = users
            .get(&user_id)
            .wrap_err_with(|| format!("user {user_id} does not exist"))?;
        let talk = talks
            .get_mut(&talk_id)
            .wrap_err_with(|| format!("talk {talk_id} does not exist"))?;
        if !(user.is_editor() || user.is_creator(talk)) {
            bail!("user cannot edit talk with id {talk_id}");
        }
        talk.title = title.clone();
        talks.commit().await.wrap_err("failed to commit talks")?;
        let _ = self
            .updates_sender
            .send(Update::UpdateTitle { talk_id, title });
        Ok(())
    }

    pub async fn update_description(
        &self,
        talk_id: usize,
        user_id: UserId,
        description: String,
    ) -> Result<()> {
        let mut storage = self.storage.write().await;
        let Storage { users, talks, .. } = storage.deref_mut();
        let user = users
            .get(&user_id)
            .wrap_err_with(|| format!("user {user_id} does not exist"))?;
        let talk = talks
            .get_mut(&talk_id)
            .wrap_err_with(|| format!("talk {talk_id} does not exist"))?;
        if !(user.is_editor() || user.is_creator(talk)) {
            bail!("user cannot edit talk with id {talk_id}");
        }
        talk.description = description.clone();
        talks.commit().await.wrap_err("failed to commit talks")?;
        let _ = self.updates_sender.send(Update::UpdateDescription {
            talk_id,
            description,
        });
        Ok(())
    }

    pub async fn update_scheduled_at(
        &self,
        talk_id: usize,
        user_id: UserId,
        scheduled_at: Option<SystemTime>,
    ) -> Result<()> {
        let mut storage = self.storage.write().await;
        let Storage { users, talks, .. } = storage.deref_mut();
        let user = users
            .get(&user_id)
            .wrap_err_with(|| format!("user {user_id} does not exist"))?;
        let talk = {
            talks
                .get_mut(&talk_id)
                .wrap_err_with(|| format!("talk {talk_id} does not exist"))
        }?;
        if !user.is_scheduler() {
            bail!("user cannot schedule talks");
        }
        talk.scheduled_at = scheduled_at;
        talks.commit().await.wrap_err("failed to commit talks")?;
        let _ = self.updates_sender.send(Update::UpdateScheduledAt {
            talk_id,
            scheduled_at,
        });
        Ok(())
    }

    pub async fn update_duration(
        &self,
        talk_id: usize,
        user_id: UserId,
        duration: Duration,
    ) -> Result<()> {
        let mut storage = self.storage.write().await;
        let Storage { users, talks, .. } = storage.deref_mut();
        let user = users
            .get(&user_id)
            .wrap_err_with(|| format!("user {user_id} does not exist"))?;
        let talk = talks
            .get_mut(&talk_id)
            .wrap_err_with(|| format!("talk {talk_id} does not exist"))?;
        if !(user.is_scheduler() || user.is_creator(talk)) {
            bail!("user cannot change duration of talk with id {talk_id}");
        }
        talk.duration = duration;
        talks.commit().await.wrap_err("failed to commit talks")?;
        let _ = self
            .updates_sender
            .send(Update::UpdateDuration { talk_id, duration });
        Ok(())
    }

    pub async fn update_location(
        &self,
        talk_id: usize,
        user_id: UserId,
        location: Option<usize>,
    ) -> Result<()> {
        let mut storage = self.storage.write().await;
        let Storage { users, talks, .. } = storage.deref_mut();
        let user = users
            .get(&user_id)
            .wrap_err_with(|| format!("user {user_id} does not exist"))?;
        let talk = talks
            .get_mut(&talk_id)
            .wrap_err_with(|| format!("talk {talk_id} does not exist"))?;
        if !(user.is_scheduler() || user.is_creator(talk)) {
            bail!("user cannot schedule talks");
        }
        talk.location = location;
        talks.commit().await.wrap_err("failed to commit talks")?;
        let _ = self
            .updates_sender
            .send(Update::UpdateLocation { talk_id, location });
        Ok(())
    }

    pub async fn add_noob(&self, talk_id: usize, user_id: usize) -> Result<(), eyre::Error> {
        let talks = &mut self.storage.write().await.talks;
        let talk = talks
            .get_mut(&talk_id)
            .wrap_err_with(|| format!("talk {talk_id} does not exist"))?;
        talk.noobs.insert(user_id);
        talks.commit().await.wrap_err("failed to commit talks")?;
        let _ = self
            .updates_sender
            .send(Update::AddNoob { talk_id, user_id });
        Ok(())
    }

    pub async fn remove_noob(&self, talk_id: usize, user_id: usize) -> Result<(), eyre::Error> {
        let talks = &mut self.storage.write().await.talks;
        let talk = talks
            .get_mut(&talk_id)
            .wrap_err_with(|| format!("talk {talk_id} does not exist"))?;
        talk.noobs.remove(&user_id);
        talks.commit().await.wrap_err("failed to commit talks")?;
        let _ = self
            .updates_sender
            .send(Update::RemoveNoob { talk_id, user_id });
        Ok(())
    }

    pub async fn add_nerd(&self, talk_id: usize, user_id: usize) -> Result<(), eyre::Error> {
        let talks = &mut self.storage.write().await.talks;
        let talk = talks
            .get_mut(&talk_id)
            .wrap_err_with(|| format!("talk {talk_id} does not exist"))?;
        talk.nerds.insert(user_id);
        talks.commit().await.wrap_err("failed to commit talks")?;
        let _ = self
            .updates_sender
            .send(Update::AddNerd { talk_id, user_id });
        Ok(())
    }

    pub async fn remove_nerd(&self, talk_id: usize, user_id: usize) -> Result<(), eyre::Error> {
        let talks = &mut self.storage.write().await.talks;
        let talk = talks
            .get_mut(&talk_id)
            .wrap_err_with(|| format!("talk {talk_id} does not exist"))?;
        talk.nerds.remove(&user_id);
        talks.commit().await.wrap_err("failed to commit talks")?;
        let _ = self
            .updates_sender
            .send(Update::RemoveNerd { talk_id, user_id });
        Ok(())
    }

    pub async fn set_attendance_mode(
        &self,
        user_id: UserId,
        attendance_mode: crate::storage::AttendanceMode,
    ) -> Result<()> {
        let mut storage = self.storage.write().await;
        let Storage { users, .. } = storage.deref_mut();
        let user = users
            .get_mut(&user_id)
            .wrap_err_with(|| format!("user {user_id} does not exist"))?;
        user.attendance_mode = attendance_mode;
        users.commit().await.wrap_err("failed to commit users")?;
        let _ = self.updates_sender.send(Update::UpdateAttendanceMode {
            user_id,
            attendance_mode,
        });
        Ok(())
    }
}
