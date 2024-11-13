use core::fmt::Debug;
use std::{
    collections::{BTreeMap, BTreeSet},
    path::Path,
    time::{Duration, SystemTime},
};

use argon2::{password_hash::SaltString, Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use eyre::Context;
use rand_core::OsRng;
use serde::{Deserialize, Serialize};
use tokio::{
    fs::{read, File},
    io::AsyncWriteExt,
};

#[derive(Debug)]
pub struct Storage {
    pub teams: BTreeSet<String>,
    pub users: BTreeMap<usize, User>,
    pub talks: BTreeMap<usize, Talk>,
}

impl Storage {
    pub async fn load(path: impl AsRef<Path> + Debug) -> eyre::Result<Self> {
        let path = path.as_ref();
        let teams = BTreeSet::<String>::read_from_file(path.join("teams.json"))
            .await
            .wrap_err("failed to read teams.json")?;
        let users = Vec::<User>::read_from_file(path.join("users.json"))
            .await
            .wrap_err("failed to read users")?
            .into_iter()
            .map(|user| (user.id, user))
            .collect();
        let talks = Vec::<Talk>::read_from_file(path.join("talks.json"))
            .await
            .wrap_err("failed to read talks")?
            .into_iter()
            .map(|talk| (talk.id, talk))
            .collect();
        Ok(Self {
            teams,
            users,
            talks,
        })
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct User {
    pub id: usize,
    pub name: String,
    pub team: String,
    pub hash: String,
    pub roles: BTreeSet<Role>,
}

impl User {
    pub fn new(
        id: usize,
        name: String,
        team: String,
        password: String,
        roles: BTreeSet<Role>,
    ) -> Self {
        let salt = SaltString::generate(&mut OsRng);
        let hash = Argon2::default()
            .hash_password(password.as_bytes(), &salt)
            .unwrap();

        Self {
            id,
            name,
            team,
            hash: hash.to_string(),
            roles,
        }
    }

    pub fn verify(&self, password: String) -> bool {
        let stored_hash = PasswordHash::new(&self.hash).unwrap();
        Argon2::default()
            .verify_password(password.as_bytes(), &stored_hash)
            .is_ok()
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
    pub creator: usize,
    pub title: String,
    pub description: String,
    pub scheduled_at: Option<SystemTime>,
    pub duration: Duration,
    pub location: Option<String>,
    pub nerds: Vec<usize>,
    pub noobs: Vec<usize>,
}

pub trait ReadFromFileExt {
    async fn read_from_file(file_path: impl AsRef<Path> + Debug) -> eyre::Result<Self>
    where
        Self: Sized;
}

impl<T> ReadFromFileExt for T
where
    T: for<'de> Deserialize<'de>,
{
    async fn read_from_file(path: impl AsRef<Path> + Debug) -> eyre::Result<Self> {
        let contents = read(path).await.wrap_err("failed to read file")?;
        serde_json::from_slice(&contents).wrap_err("failed to deserialize JSON")
    }
}

pub trait WriteToFileExt {
    async fn write_to_file(&self, file_path: impl AsRef<Path> + Debug) -> eyre::Result<()>;
}

impl<T> WriteToFileExt for T
where
    T: Serialize,
{
    async fn write_to_file(&self, path: impl AsRef<Path> + Debug) -> eyre::Result<()> {
        let contents = serde_json::to_vec_pretty(self).wrap_err("failed to serialize to JSON")?;
        let mut file = File::create(path).await.wrap_err("failed to create file")?;
        file.write_all(&contents)
            .await
            .wrap_err("failed to write to file")?;
        Ok(())
    }
}
