use std::sync::Arc;

use tokio::{
    signal::unix::{signal, SignalKind},
    sync::{broadcast, Mutex},
};
use tracing::{error, info};

use crate::{
    messages::Update,
    storage::{Storage, Talk},
};

pub async fn refresh_files_from_disk_on_signal(
    storage: Arc<Mutex<Storage>>,
    updates_sender: broadcast::Sender<Update>,
) {
    let mut received_signals =
        signal(SignalKind::user_defined1()).expect("failed to register SIGUSR1 handler");

    loop {
        received_signals.recv().await;
        info!("Received SIGUSR1, refreshing storage...");

        let mut storage = storage.lock().await;

        let refreshed_storage = match Storage::load(storage.path.clone()).await {
            Ok(storage) => storage,
            Err(error) => {
                error!("Failed to refresh storage: {error:#?}");
                continue;
            }
        };

        storage.teams = refreshed_storage.teams;

        if *refreshed_storage.users != *storage.users {
            info!("Users changed, sending update...");
            storage.users = refreshed_storage.users;
            let _ = updates_sender.send(Update::Users {
                users: storage
                    .users
                    .iter()
                    .map(|(user_id, user)| (*user_id, user.into()))
                    .collect(),
            });
        }

        for talk_id in storage
            .talks
            .keys()
            .filter(|talk_id| !refreshed_storage.talks.contains_key(talk_id))
        {
            info!("Talk {talk_id} removed");
            let _ = updates_sender.send(Update::RemoveTalk { talk_id: *talk_id });
        }
        for (talk_id, refreshed_talk) in refreshed_storage.talks.iter() {
            if let Some(existing_talk) = storage.talks.get(talk_id) {
                update_existing_talk(existing_talk, refreshed_talk, &updates_sender, *talk_id);
            } else {
                info!("Talk {talk_id} added");
                let _ = updates_sender.send(Update::AddTalk {
                    talk: refreshed_talk.clone(),
                });
            }
        }
        storage.talks = refreshed_storage.talks;
        info!("Storage refreshed");
    }
}

fn update_existing_talk(
    existing_talk: &Talk,
    refreshed_talk: &Talk,
    updates_sender: &broadcast::Sender<Update>,
    talk_id: usize,
) {
    if refreshed_talk.title != existing_talk.title {
        info!("Talk {talk_id} title changed");
        let _ = updates_sender.send(Update::UpdateTitle {
            talk_id,
            title: refreshed_talk.title.clone(),
        });
    }
    if refreshed_talk.description != existing_talk.description {
        info!("Talk {talk_id} description changed");
        let _ = updates_sender.send(Update::UpdateDescription {
            talk_id,
            description: refreshed_talk.description.clone(),
        });
    }
    if refreshed_talk.scheduled_at != existing_talk.scheduled_at {
        info!("Talk {talk_id} scheduled_at changed");
        let _ = updates_sender.send(Update::UpdateScheduledAt {
            talk_id,
            scheduled_at: refreshed_talk.scheduled_at,
        });
    }
    if refreshed_talk.duration != existing_talk.duration {
        info!("Talk {talk_id} duration changed");
        let _ = updates_sender.send(Update::UpdateDuration {
            talk_id,
            duration: refreshed_talk.duration,
        });
    }
    for user_id in existing_talk
        .noobs
        .iter()
        .filter(|user_id| !refreshed_talk.noobs.contains(user_id))
    {
        info!("Talk {talk_id} noob {user_id} removed");
        let _ = updates_sender.send(Update::RemoveNoob {
            talk_id,
            user_id: *user_id,
        });
    }
    for user_id in refreshed_talk
        .noobs
        .iter()
        .filter(|user_id| !existing_talk.noobs.contains(user_id))
    {
        info!("Talk {talk_id} noob {user_id} added");
        if !existing_talk.noobs.contains(user_id) {
            let _ = updates_sender.send(Update::AddNoob {
                talk_id,
                user_id: *user_id,
            });
        }
    }
    for user_id in existing_talk
        .nerds
        .iter()
        .filter(|user_id| !refreshed_talk.nerds.contains(user_id))
    {
        info!("Talk {talk_id} nerd {user_id} removed");
        let _ = updates_sender.send(Update::RemoveNerd {
            talk_id,
            user_id: *user_id,
        });
    }
    for user_id in refreshed_talk
        .nerds
        .iter()
        .filter(|user_id| !existing_talk.nerds.contains(user_id))
    {
        info!("Talk {talk_id} nerd {user_id} added");
        if !existing_talk.nerds.contains(user_id) {
            let _ = updates_sender.send(Update::AddNerd {
                talk_id,
                user_id: *user_id,
            });
        }
    }
}
