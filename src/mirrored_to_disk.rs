use std::{
    ops::{Deref, DerefMut},
    path::PathBuf,
};

use eyre::Context as _;
use serde::Serialize;
use tokio::fs::{create_dir_all, try_exists};
use tracing::warn;

use crate::storage::{ReadFromFileExt, WriteToFileExt};

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
