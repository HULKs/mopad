use core::fmt::Debug;
use std::{
    ops::{Deref, DerefMut},
    path::{Path, PathBuf},
};

use eyre::Context as _;
use serde::{Deserialize, Serialize};
use tokio::{
    fs::{read, try_exists, File},
    io::AsyncWriteExt as _,
};
use tracing::warn;

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

    pub async fn read_from_or_create_default(path: impl Into<PathBuf>) -> eyre::Result<Self>
    where
        T: Default,
    {
        let path = path.into();
        if try_exists(&path)
            .await
            .wrap_err("failed to check if file exists")?
        {
            Self::read_from(path).await
        } else {
            warn!(
                "Cannot find file {path}, creating default",
                path = path.display()
            );
            let value = T::default();
            value.write_to_file(&path).await?;
            Ok(Self { path, value })
        }
    }

    pub async fn commit(&self) -> eyre::Result<()>
    where
        T: Serialize,
    {
        self.value.write_to_file(&self.path).await
    }
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
        let path = path.as_ref();

        let temp_path = path.with_extension("tmp");
        let contents = serde_json::to_vec_pretty(self).wrap_err("failed to serialize to JSON")?;

        let mut file = File::create(&temp_path)
            .await
            .wrap_err("failed to create temp file")?;

        file.write_all(&contents)
            .await
            .wrap_err("failed to write to temp file")?;

        file.sync_all().await.wrap_err("failed to sync to disk")?;

        tokio::fs::rename(&temp_path, path)
            .await
            .wrap_err("failed to rename temp file to target")?;

        Ok(())
    }
}
