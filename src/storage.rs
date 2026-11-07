use std::{
    collections::{BTreeMap, BTreeSet},
    path::PathBuf,
    time::SystemTime,
};

use crate::{
    mirrored_to_disk::MirroredToDisk,
    wire::{AttendanceMode, Location, Role, Talk, Update, UserId, UserReference},
};
use argon2::{
    password_hash::{phc::PasswordHash, PasswordHasher, PasswordVerifier},
    Argon2,
};
use eyre::{Context, ContextCompat, Result};
use serde::{Deserialize, Serialize};
use tokio::fs::create_dir_all;

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct TokenData {
    pub user_id: UserId,
    pub expires_at: SystemTime,
}

#[derive(Debug)]
pub struct Storage {
    pub path: PathBuf,
    pub teams: MirroredToDisk<BTreeSet<String>>,
    pub users: MirroredToDisk<BTreeMap<UserId, User>>,
    pub locations: MirroredToDisk<BTreeMap<usize, Location>>,
    pub talks: MirroredToDisk<BTreeMap<usize, Talk>>,
    pub tokens: MirroredToDisk<BTreeMap<String, TokenData>>,
    pub next_talk_id: MirroredToDisk<usize>,
}

impl Storage {
    pub fn snapshot(&self) -> Update {
        Update::State {
            users: self
                .users
                .values()
                .map(|user| (user.id, user.into()))
                .collect(),
            talks: self.talks.value.clone(),
            teams: self.teams.value.clone(),
            locations: self.locations.value.clone(),
        }
    }

    pub fn user_for_token(&self, token: &str) -> Result<&User> {
        let data = self.tokens.get(token).wrap_err("unknown token")?;
        eyre::ensure!(data.expires_at > SystemTime::now(), "session expired");
        self.users
            .get(&data.user_id)
            .wrap_err("unknown user id from token")
    }

    pub async fn load(path: impl Into<PathBuf>) -> Result<Self> {
        let path = path.into();
        create_dir_all(&path)
            .await
            .wrap_err("failed to create storage directory")?;
        let teams = MirroredToDisk::<BTreeSet<String>>::read_from_or_create_default(
            path.join("teams.json"),
        )
        .await
        .wrap_err("failed to read teams.json")?;

        let users = MirroredToDisk::<BTreeMap<usize, User>>::read_from_or_create_default(
            path.join("users.json"),
        )
        .await
        .wrap_err("failed to read users")?;

        for (user_id, user) in users.iter() {
            eyre::ensure!(*user_id == user.id, "user {user_id} has inconsistent id");
            eyre::ensure!(
                teams.contains(&user.team),
                "user {user_id} has unknown team {}; restore teams.json",
                user.team
            );
        }

        let locations = MirroredToDisk::<BTreeMap<usize, Location>>::read_from_or_create_default(
            path.join("locations.json"),
        )
        .await?;
        eyre::ensure!(
            locations.iter().all(|(id, room)| *id == room.id),
            "inconsistent location id in locations.json"
        );

        let mut talks = MirroredToDisk::<BTreeMap<usize, Talk>>::read_from_or_create_default(
            path.join("talks.json"),
        )
        .await?;
        let tokens = MirroredToDisk::read_from_or_create_default(path.join("tokens.json")).await?;

        for (talk_id, talk) in talks.iter_mut() {
            eyre::ensure!(*talk_id == talk.id, "talk {talk_id} has inconsistent id");
            eyre::ensure!(
                users.contains_key(&talk.creator),
                "talk {talk_id} has missing creator {}; restore users.json before starting",
                talk.creator
            );
            talk.creator_duration.get_or_insert(talk.duration);

            eyre::ensure!(
                talk.nerds
                    .iter()
                    .chain(&talk.noobs)
                    .all(|id| users.contains_key(id)),
                "talk {talk_id} has missing participants; restore users.json before starting"
            );
        }
        let mut next_talk_id =
            MirroredToDisk::read_from_or_create_default(path.join("next_talk_id.json")).await?;
        let minimum = talks
            .keys()
            .next_back()
            .copied()
            .unwrap_or(0)
            .checked_add(1)
            .ok_or_else(|| eyre::eyre!("talk IDs exhausted"))?;
        if *next_talk_id < minimum {
            *next_talk_id = minimum;
            next_talk_id.commit().await?;
        }

        Ok(Self {
            path,
            teams,
            users,
            locations,
            talks,
            tokens,
            next_talk_id,
        })
    }
}

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
        password: &str,
    ) -> Result<Self> {
        let hash = Argon2::default()
            .hash_password(password.as_bytes())
            .map_err(|error| eyre::eyre!("failed to hash password: {error}"))?;

        Ok(Self {
            id,
            name,
            team,
            attendance_mode,
            hash: hash.to_string(),
            roles: BTreeSet::new(),
        })
    }

    pub fn verify(&self, password: &str) -> bool {
        let Ok(stored_hash) = PasswordHash::new(&self.hash) else {
            return false;
        };
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

impl From<&User> for UserReference {
    fn from(user: &User) -> Self {
        Self {
            id: user.id,
            name: user.name.clone(),
            team: user.team.clone(),
            attendance_mode: user.attendance_mode,
            roles: user.roles.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stored_highlights_are_preserved_and_legacy_talks_default_to_false() {
        let mut value = serde_json::json!({"id":1,"creator":0,"title":"Talk","description":"","scheduled_at":null,"duration":{"secs":1800,"nanos":0},"location":null,"nerds":[],"noobs":[]});
        assert!(
            !serde_json::from_value::<Talk>(value.clone())
                .unwrap()
                .highlight
        );
        value["highlight"] = serde_json::json!(true);
        assert!(serde_json::from_value::<Talk>(value).unwrap().highlight);
    }

    #[test]
    fn password_hashing_and_stored_hash_verification() {
        let mut user = User::new(
            0,
            "Alice".into(),
            "Alpha".into(),
            AttendanceMode::OnSite,
            "password",
        )
        .unwrap();
        assert!(user.verify("password"));
        assert!(!user.verify("wrong password"));

        user.hash =
            "$argon2id$v=19$m=256,t=2,p=1$c29tZXNhbHQ$nf65EOgLrQMR/uIPnA4rEsF5h7TKyQwu9U1bMCHGi/4"
                .into();
        assert!(user.verify("password"));
        assert!(!user.verify("wrong password"));
        user.hash = "invalid hash".into();
        assert!(!user.verify("password"));
    }
}
