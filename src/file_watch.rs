use std::sync::Arc;

use tokio::{
    signal::unix::{signal, SignalKind},
    sync::{broadcast, Mutex},
};

use crate::{messages::Update, storage::Storage};

pub async fn refresh_files_from_disk_on_signal(
    storage: Arc<Mutex<Storage>>,
    updates_sender: broadcast::Sender<Update>,
) {
    let mut received_signals =
        signal(SignalKind::user_defined1()).expect("failed to register SIGUSR1 handler");

    loop {
        received_signals.recv().await;
        eprintln!("Refreshing files from disk...");

        let mut storage = storage.lock().await;

        let refreshed_storage = match Storage::load(".").await {
            Ok(storage) => storage,
            Err(error) => {
                eprintln!("Failed to load storage: {error:?}");
                continue;
            }
        };

        storage.teams = refreshed_storage.teams;

        if refreshed_storage.users != storage.users {
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
            let _ = updates_sender.send(Update::RemoveTalk { talk_id: *talk_id });
        }
        for (talk_id, refreshed_talk) in refreshed_storage.talks.iter() {
            if let Some(existing_talk) = storage.talks.get(talk_id) {
                if refreshed_talk.title != existing_talk.title {
                    let _ = updates_sender.send(Update::UpdateTitle {
                        talk_id: *talk_id,
                        title: refreshed_talk.title.clone(),
                    });
                }
                if refreshed_talk.description != existing_talk.description {
                    let _ = updates_sender.send(Update::UpdateDescription {
                        talk_id: *talk_id,
                        description: refreshed_talk.description.clone(),
                    });
                }
                if refreshed_talk.scheduled_at != existing_talk.scheduled_at {
                    let _ = updates_sender.send(Update::UpdateScheduledAt {
                        talk_id: *talk_id,
                        scheduled_at: refreshed_talk.scheduled_at,
                    });
                }
                if refreshed_talk.duration != existing_talk.duration {
                    let _ = updates_sender.send(Update::UpdateDuration {
                        talk_id: *talk_id,
                        duration: refreshed_talk.duration,
                    });
                }
                for user_id in existing_talk
                    .noobs
                    .iter()
                    .filter(|user_id| !refreshed_talk.noobs.contains(user_id))
                {
                    let _ = updates_sender.send(Update::RemoveNoob {
                        talk_id: *talk_id,
                        user_id: *user_id,
                    });
                }
                for user_id in refreshed_talk.noobs.iter() {
                    if !existing_talk.noobs.contains(user_id) {
                        let _ = updates_sender.send(Update::AddNoob {
                            talk_id: *talk_id,
                            user_id: *user_id,
                        });
                    }
                }
                for user_id in existing_talk
                    .nerds
                    .iter()
                    .filter(|user_id| !refreshed_talk.nerds.contains(user_id))
                {
                    let _ = updates_sender.send(Update::RemoveNerd {
                        talk_id: *talk_id,
                        user_id: *user_id,
                    });
                }
                for user_id in refreshed_talk.nerds.iter() {
                    if !existing_talk.nerds.contains(user_id) {
                        let _ = updates_sender.send(Update::AddNerd {
                            talk_id: *talk_id,
                            user_id: *user_id,
                        });
                    }
                }
            } else {
                let _ = updates_sender.send(Update::AddTalk {
                    talk: refreshed_talk.clone(),
                });
            }
        }
        storage.talks = refreshed_storage.talks;
    }
}
