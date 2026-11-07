use crate::{storage::Storage, wire::Update};
use std::sync::Arc;
use tokio::{
    signal::unix::{signal, SignalKind},
    sync::{broadcast, RwLock},
};
use tracing::{error, info};

pub async fn refresh_files_from_disk_on_signal(
    storage: Arc<RwLock<Storage>>,
    updates_sender: broadcast::Sender<Update>,
) {
    let mut signals =
        signal(SignalKind::user_defined1()).expect("failed to register SIGUSR1 handler");
    while signals.recv().await.is_some() {
        let mut storage = storage.write().await;
        match Storage::load(storage.path.clone()).await {
            Ok(refreshed) => {
                *storage = refreshed;
                let _ = updates_sender.send(storage.snapshot());
                info!("Storage refreshed");
            }
            Err(error) => error!("Failed to refresh storage: {error:#}"),
        }
    }
}
