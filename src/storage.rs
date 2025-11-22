use core::fmt::Debug;
use std::{
    collections::{BTreeMap, BTreeSet},
    path::PathBuf,
    time::{Duration, SystemTime},
};

use argon2::{password_hash::SaltString, Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use eyre::Context;
use rand_core::OsRng;
use serde::{Deserialize, Serialize};
use tokio::fs::{create_dir_all, try_exists};

use crate::mirrored_to_disk::MirroredToDisk;

pub type Token = String;

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct TokenData {
    pub user_id: usize,
    pub expires_at: SystemTime,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct TokenStore {
    #[serde(flatten)]
    store: BTreeMap<Token, TokenData>,
}

impl TokenStore {
    pub fn insert(&mut self, token: Token, user_id: usize, expires_at: SystemTime) {
        self.store.insert(
            token,
            TokenData {
                user_id,
                expires_at,
            },
        );
    }

    pub fn remove_expired(&mut self, now: SystemTime) {
        self.store.retain(|_token, data| data.expires_at >= now);
    }

    pub fn get(&self, token: &Token) -> Option<&TokenData> {
        self.store.get(token)
    }
}

#[derive(Debug)]
pub struct Storage {
    pub path: PathBuf,
    pub teams: MirroredToDisk<BTreeSet<String>>,
    pub users: MirroredToDisk<BTreeMap<UserId, User>>,
    pub locations: MirroredToDisk<BTreeMap<usize, Location>>,
    pub talks: MirroredToDisk<BTreeMap<usize, Talk>>,
    pub tokens: MirroredToDisk<TokenStore>,
}

impl Storage {
    pub fn add_user(
        &mut self,
        name: String,
        team: String,
        attendance_mode: AttendanceMode,
        password: String,
    ) -> UserId {
        let new_id = self
            .users
            .keys()
            .max()
            .map(|id| id + 1)
            .unwrap_or_else(|| 0);
        let user = User::new(new_id, name, team, attendance_mode, password);
        self.users.insert(new_id, user);
        new_id
    }

    pub async fn load(path: impl Into<PathBuf> + Debug) -> eyre::Result<Self> {
        let path = path.into();
        let exists = try_exists(&path)
            .await
            .wrap_err("failed to check if storage directory exists")?;
        if !exists {
            create_dir_all(&path)
                .await
                .wrap_err("failed to create storage directory")?;
        }
        let mut teams = MirroredToDisk::<BTreeSet<String>>::read_from_or_create_default(
            path.join("teams.json"),
        )
        .await
        .wrap_err("failed to read teams.json")?;

        let mut users = MirroredToDisk::<BTreeMap<usize, User>>::read_from_or_create_default(
            path.join("users.json"),
        )
        .await
        .wrap_err("failed to read users")?;

        for (user_id, user) in users.iter_mut() {
            if *user_id != user.id {
                tracing::warn!(
                    "Inconsistent user id for user {}: key is {}, but user.id is {}. Syncing user.id to {}.",
                    user.name,
                    user_id,
                    user.id,
                    user_id,
                );
                user.id = *user_id;
            }
            if !teams.value.contains(&user.team) {
                tracing::warn!(
                    "User {} has unknown team {}. Assigning to 'Unknown' team.",
                    user.name,
                    user.team
                );
                user.team = "Unknown".to_string();
                teams.value.insert("Unknown".to_string());
            }
        }

        let locations = MirroredToDisk::<BTreeMap<usize, Location>>::read_from_or_create_default(
            path.join("locations.json"),
        )
        .await?;

        let mut talks = MirroredToDisk::<BTreeMap<usize, Talk>>::read_from_or_create_default(
            path.join("talks.json"),
        )
        .await?;
        let tokens = MirroredToDisk::read_from_or_create_default(path.join("tokens.json")).await?;

        let user_ids: BTreeSet<usize> = users.keys().copied().collect();

        talks.value.retain(|talk_id, talk| {
            if !user_ids.contains(&talk.creator) {
                tracing::warn!(
                    "Dropping orphan talk {talk_id} (creator {} missing)",
                    talk.creator
                );
                return false;
            }

            let original_nerds = talk.nerds.len();
            talk.nerds.retain(|id| user_ids.contains(id));
            if talk.nerds.len() != original_nerds {
                tracing::info!("Cleaned invalid nerds from talk {talk_id}");
            }

            let original_noobs = talk.noobs.len();
            talk.noobs.retain(|id| user_ids.contains(id));
            if talk.noobs.len() != original_noobs {
                tracing::info!("Cleaned invalid noobs from talk {talk_id}");
            }

            true
        });

        Ok(Self {
            path: path.to_path_buf(),
            teams,
            users,
            locations,
            talks,
            tokens,
        })
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub enum AttendanceMode {
    OnSite,
    Remote,
}

pub type UserId = usize;

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct User {
    pub id: usize,
    pub name: String,
    pub team: String,
    pub attendance_mode: AttendanceMode,
    pub hash: String,
    pub roles: BTreeSet<Role>,
}

impl User {
    pub fn new(
        id: usize,
        name: String,
        team: String,
        attendance_mode: AttendanceMode,
        password: String,
    ) -> Self {
        let salt = SaltString::generate(&mut OsRng);
        let hash = Argon2::default()
            .hash_password(password.as_bytes(), &salt)
            .unwrap();

        Self {
            id,
            name,
            team,
            attendance_mode,
            hash: hash.to_string(),
            roles: BTreeSet::new(),
        }
    }

    pub fn verify(&self, password: String) -> bool {
        let stored_hash = PasswordHash::new(&self.hash).unwrap();
        Argon2::default()
            .verify_password(password.as_bytes(), &stored_hash)
            .is_ok()
    }

    pub fn is_editor(&self) -> bool {
        self.roles.contains(&Role::Editor)
    }

    pub fn is_scheduler(&self) -> bool {
        self.roles.contains(&Role::Scheduler)
    }

    pub fn is_creator(&self, talk: &Talk) -> bool {
        self.id == talk.creator
    }
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, Serialize)]
pub enum Role {
    Editor,
    Scheduler,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Talk {
    pub id: usize,
    pub creator: UserId,
    pub title: String,
    pub description: String,
    pub scheduled_at: Option<SystemTime>,
    pub duration: Duration,
    pub location: Option<usize>,
    pub nerds: BTreeSet<usize>,
    pub noobs: BTreeSet<usize>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Location {
    pub id: usize,
    pub name: String,
    pub live_stream: Option<String>,
}
