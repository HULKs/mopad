use eyre::Context as _;
use serde::{de::DeserializeOwned, Serialize};
use std::{
    ops::{Deref, DerefMut},
    path::{Path, PathBuf},
};
use tokio::{
    fs::{read, try_exists, File},
    io::AsyncWriteExt as _,
};

#[derive(Debug)]
pub struct MirroredToDisk<T> {
    pub path: PathBuf,
    pub value: T,
    saved: T,
}

impl<T> Deref for MirroredToDisk<T> {
    type Target = T;
    fn deref(&self) -> &T {
        &self.value
    }
}
impl<T> DerefMut for MirroredToDisk<T> {
    fn deref_mut(&mut self) -> &mut T {
        &mut self.value
    }
}

impl<T: Clone + Default + DeserializeOwned + Serialize> MirroredToDisk<T> {
    pub async fn read_from_or_create_default(path: impl Into<PathBuf>) -> eyre::Result<Self> {
        let path = path.into();
        let value = if try_exists(&path).await.wrap_err("failed to check file")? {
            serde_json::from_slice(&read(&path).await.wrap_err("failed to read file")?)
                .wrap_err_with(|| format!("invalid JSON in {}", path.display()))?
        } else {
            let value = T::default();
            write_json(&value, &path).await?;
            value
        };
        Ok(Self {
            path,
            saved: value.clone(),
            value,
        })
    }

    pub async fn commit(&mut self) -> eyre::Result<()> {
        if let Err(error) = write_json(&self.value, &self.path).await {
            self.value = self.saved.clone();
            return Err(error);
        }
        self.saved = self.value.clone();
        Ok(())
    }
}

async fn write_json(value: &impl Serialize, path: &Path) -> eyre::Result<()> {
    let contents = serde_json::to_vec_pretty(value).wrap_err("failed to serialize JSON")?;
    let temp_path = path.with_extension("tmp");
    let mut file = File::create(&temp_path)
        .await
        .wrap_err("failed to create temp file")?;
    file.write_all(&contents)
        .await
        .wrap_err("failed to write temp file")?;
    file.sync_all().await.wrap_err("failed to sync file")?;
    tokio::fs::rename(&temp_path, path)
        .await
        .wrap_err("failed to replace file")?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn failed_write_restores_last_saved_value() {
        let path = std::env::temp_dir().join(format!("mopad-rollback-{}.json", std::process::id()));
        let mut store = MirroredToDisk::<Vec<u8>>::read_from_or_create_default(&path)
            .await
            .unwrap();
        store.push(1);
        store.commit().await.unwrap();
        store.path = path.join("missing.json");
        store.push(2);
        assert!(store.commit().await.is_err());
        assert_eq!(*store, vec![1]);
        assert_eq!(read(&path).await.unwrap(), b"[\n  1\n]");
        tokio::fs::remove_file(path).await.unwrap();
    }
}
