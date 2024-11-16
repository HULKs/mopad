use core::fmt::Debug;
use std::{
    collections::{BTreeMap, BTreeSet},
    ops::{Deref, DerefMut},
    path::{Path, PathBuf},
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

pub type Token = String;

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct TokenData {
    pub user_id: usize,
    pub expires_at: SystemTime,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
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
pub struct MirroredToDisk<T> {
    pub path: PathBuf,
    pub value: T,
}

impl<T> Deref for MirroredToDisk<T> {
    type Target = T;

    fn deref(&self) -> &Self::Target {
        &self.value
    }
}

impl<T> DerefMut for MirroredToDisk<T> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.value
    }
}

impl<T> MirroredToDisk<T>
where
    T: ReadFromFileExt + WriteToFileExt,
{
    pub async fn read_from(path: impl Into<PathBuf>) -> eyre::Result<Self> {
        let path = path.into();
        let value = T::read_from_file(&path).await?;
        Ok(Self { path, value })
    }

    pub async fn commit(&self) -> eyre::Result<()>
    where
        T: Serialize,
    {
        self.value.write_to_file(&self.path).await
    }
}

#[derive(Debug)]
pub struct Storage {
    pub path: PathBuf,
    pub teams: MirroredToDisk<BTreeSet<String>>,
    pub users: MirroredToDisk<BTreeMap<usize, User>>,
    pub talks: MirroredToDisk<BTreeMap<usize, Talk>>,
    pub tokens: MirroredToDisk<TokenStore>,
}

impl Storage {
    pub async fn load(path: impl Into<PathBuf> + Debug) -> eyre::Result<Self> {
        let path = path.into();
        let teams = MirroredToDisk::read_from(path.join("teams.json"))
            .await
            .wrap_err("failed to read teams.json")?;
        let users = MirroredToDisk::read_from(path.join("users.json"))
            .await
            .wrap_err("failed to read users")?;
        let talks = MirroredToDisk::read_from(path.join("talks.json"))
            .await
            .wrap_err("failed to read talks")?;
        let tokens = MirroredToDisk::read_from(path.join("tokens.json"))
            .await
            .wrap_err("failed to read talks")?;
        Ok(Self {
            path: path.to_path_buf(),
            teams,
            users,
            talks,
            tokens,
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
    pub fn new(id: usize, name: String, team: String, password: String) -> Self {
        let salt = SaltString::generate(&mut OsRng);
        let hash = Argon2::default()
            .hash_password(password.as_bytes(), &salt)
            .unwrap();

        Self {
            id,
            name,
            team,
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
    pub creator: usize,
    pub title: String,
    pub description: String,
    pub scheduled_at: Option<SystemTime>,
    pub duration: Duration,
    pub location: Option<String>,
    pub nerds: BTreeSet<usize>,
    pub noobs: BTreeSet<usize>,
}

pub trait ReadFromFileExt {
    async fn read_from_file(path: impl AsRef<Path> + Debug) -> eyre::Result<Self>
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
    async fn write_to_file(&self, path: impl AsRef<Path> + Debug) -> eyre::Result<()>;
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
