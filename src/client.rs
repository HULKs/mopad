use std::sync::Arc;

use axum::{
    extract::{
        ws::{Message, WebSocket},
        WebSocketUpgrade,
    },
    response::IntoResponse,
};
use eyre::Context;
use tokio::{
    select,
    sync::{broadcast, Mutex},
};

use crate::{
    authentication::authenticate,
    messages::{Command, Update},
    storage::{Role, Storage, Talk, User, WriteToFileExt},
};

pub async fn handle_websocket(
    upgrade: WebSocketUpgrade,
    storage: Arc<Mutex<Storage>>,
    updates_sender: broadcast::Sender<Update>,
) -> impl IntoResponse {
    upgrade.on_upgrade(move |socket| handle_upgraded_websocket(socket, storage, updates_sender))
}

async fn handle_upgraded_websocket(
    socket: WebSocket,
    storage: Arc<Mutex<Storage>>,
    updates_sender: broadcast::Sender<Update>,
) {
    match connection(socket, storage, updates_sender).await {
        Ok(_) => {}
        Err(error) => eprintln!("Error in handle_upgraded_websocket():\n{error:?}"),
    }
}

async fn connection(
    mut socket: WebSocket,
    storage: Arc<Mutex<Storage>>,
    updates_sender: broadcast::Sender<Update>,
) -> eyre::Result<()> {
    let mut updates_receiver = updates_sender.subscribe();

    let (current_user, users_changed) = match authenticate(&mut socket, &storage).await {
        Some((current_user, users_changed)) => (current_user, users_changed),
        None => return Ok(()),
    };

    let update_users = Update::Users {
        users: storage
            .lock()
            .await
            .users
            .iter()
            .map(|(user_id, user)| (*user_id, user.into()))
            .collect(),
    };
    if users_changed {
        let _ = updates_sender.send(update_users);
    } else {
        let _ = socket
            .send(Message::Text(serde_json::to_string(&update_users).unwrap()))
            .await;
    }

    {
        let talks = &storage.lock().await.talks;
        for talk in talks.values() {
            let _ = socket
                .send(Message::Text(
                    serde_json::to_string(&Update::AddTalk { talk: talk.clone() }).unwrap(),
                ))
                .await;
        }
    }

    loop {
        select! {
            command_message = socket.recv() => {
                if command_message.is_none() {
                    break;
                }
                handle_message(command_message.unwrap(), &storage, &current_user, &updates_sender)
                    .await
                    .wrap_err("failed to handle command message")?;
            }
            update = updates_receiver.recv() => {
                let update = update.wrap_err("failed to receive update")?;
                handle_update(update, &mut socket)
                    .await
                    .wrap_err("failed to handle update")?;
            }
        }
    }

    Ok(())
}

async fn handle_update(update: Update, stream: &mut WebSocket) -> eyre::Result<()> {
    stream
        .send(Message::Text(
            serde_json::to_string(&update).wrap_err("failed to serialize update")?,
        ))
        .await
        .wrap_err("failed to send update")
}

async fn handle_message(
    command_message: Result<Message, axum::Error>,
    storage: &Mutex<Storage>,
    current_user: &User,
    updates_sender: &broadcast::Sender<Update>,
) -> eyre::Result<()> {
    let command_message = command_message.wrap_err("failed to receive command")?;

    if let Message::Text(message) = command_message {
        let command: Command =
            serde_json::from_str(&message).wrap_err("failed to deserialize command message")?;

        match command {
            Command::AddTalk {
                title,
                description,
                duration,
            } => {
                let talks = &mut storage.lock().await.talks;

                let next_talk_id = talks.keys().copied().max().unwrap_or_default() + 1;

                let talk = Talk {
                    id: next_talk_id,
                    creator: current_user.id,
                    title,
                    description,
                    scheduled_at: None,
                    duration,
                    location: None,
                    nerds: vec![current_user.id],
                    noobs: vec![],
                };
                talks.insert(next_talk_id, talk.clone());

                talks
                    .values()
                    .collect::<Vec<_>>()
                    .write_to_file("talks.json")
                    .await
                    .wrap_err("failed to write talks.json")?;

                let _ = updates_sender.send(Update::AddTalk { talk });
            }
            Command::RemoveTalk { talk_id } => {
                let talks = &mut storage.lock().await.talks;

                let no_such_talk = !talks.contains_key(&talk_id);
                let is_editor = current_user.roles.contains(&Role::Editor);
                let is_creator = talks[&talk_id].creator == current_user.id;
                let can_edit = is_editor || is_creator;
                if no_such_talk || !can_edit {
                    return Ok(());
                }

                talks.remove(&talk_id);

                talks
                    .values()
                    .collect::<Vec<_>>()
                    .write_to_file("talks.json")
                    .await
                    .wrap_err("failed to write talks.json")?;

                let _ = updates_sender.send(Update::RemoveTalk { talk_id });
            }
            Command::UpdateTitle { talk_id, title } => {
                let talks = &mut storage.lock().await.talks;

                if !talks.contains_key(&talk_id)
                    || (!current_user.roles.contains(&Role::Editor)
                        && talks[&talk_id].creator != current_user.id)
                {
                    return Ok(());
                }

                let talk = match talks.get_mut(&talk_id) {
                    Some(talk) => talk,
                    None => return Ok(()),
                };

                talk.title = title.clone();

                talks
                    .values()
                    .collect::<Vec<_>>()
                    .write_to_file("talks.json")
                    .await
                    .wrap_err("failed to write talks.json")?;

                let _ = updates_sender.send(Update::UpdateTitle { talk_id, title });
            }
            Command::UpdateDescription {
                talk_id,
                description,
            } => {
                let talks = &mut storage.lock().await.talks;

                if !talks.contains_key(&talk_id)
                    || (!current_user.roles.contains(&Role::Editor)
                        && talks[&talk_id].creator != current_user.id)
                {
                    return Ok(());
                }

                let talk = match talks.get_mut(&talk_id) {
                    Some(talk) => talk,
                    None => return Ok(()),
                };

                talk.description = description.clone();

                talks
                    .values()
                    .collect::<Vec<_>>()
                    .write_to_file("talks.json")
                    .await
                    .wrap_err("failed to write talks.json")?;

                let _ = updates_sender.send(Update::UpdateDescription {
                    talk_id,
                    description,
                });
            }
            Command::UpdateScheduledAt {
                talk_id,
                scheduled_at,
            } => {
                let talks = &mut storage.lock().await.talks;

                if !talks.contains_key(&talk_id) || !current_user.roles.contains(&Role::Scheduler) {
                    return Ok(());
                }

                let talk = match talks.get_mut(&talk_id) {
                    Some(talk) => talk,
                    None => return Ok(()),
                };

                talk.scheduled_at = scheduled_at;

                talks
                    .values()
                    .collect::<Vec<_>>()
                    .write_to_file("talks.json")
                    .await
                    .wrap_err("failed to write talks.json")?;

                let _ = updates_sender.send(Update::UpdateScheduledAt {
                    talk_id,
                    scheduled_at,
                });
            }
            Command::UpdateDuration { talk_id, duration } => {
                let talks = &mut storage.lock().await.talks;

                if !talks.contains_key(&talk_id)
                    || (!current_user.roles.contains(&Role::Editor)
                        && talks[&talk_id].creator != current_user.id)
                {
                    return Ok(());
                }

                let talk = match talks.get_mut(&talk_id) {
                    Some(talk) => talk,
                    None => return Ok(()),
                };

                talk.duration = duration;

                talks
                    .values()
                    .collect::<Vec<_>>()
                    .write_to_file("talks.json")
                    .await
                    .wrap_err("failed to write talks.json")?;

                let _ = updates_sender.send(Update::UpdateDuration { talk_id, duration });
            }
            Command::UpdateLocation { talk_id, location } => {
                let talks = &mut storage.lock().await.talks;

                if !talks.contains_key(&talk_id)
                    || (!current_user.roles.contains(&Role::Scheduler)
                        && talks[&talk_id].creator != current_user.id)
                {
                    return Ok(());
                }

                let talk = match talks.get_mut(&talk_id) {
                    Some(talk) => talk,
                    None => return Ok(()),
                };

                talk.location = location.clone();

                talks
                    .values()
                    .collect::<Vec<_>>()
                    .write_to_file("talks.json")
                    .await
                    .wrap_err("failed to write talks.json")?;

                let _ = updates_sender.send(Update::UpdateLocation { talk_id, location });
            }
            Command::AddNoob { talk_id, user_id } => {
                let talks = &mut storage.lock().await.talks;

                let talk = match talks.get_mut(&talk_id) {
                    Some(talk) => talk,
                    None => return Ok(()),
                };

                if !talk.noobs.contains(&user_id) {
                    talk.noobs.push(user_id);
                }

                talks
                    .values()
                    .collect::<Vec<_>>()
                    .write_to_file("talks.json")
                    .await
                    .wrap_err("failed to write talks.json")?;

                let _ = updates_sender.send(Update::AddNoob { talk_id, user_id });
            }
            Command::RemoveNoob { talk_id, user_id } => {
                let talks = &mut storage.lock().await.talks;

                let talk = match talks.get_mut(&talk_id) {
                    Some(talk) => talk,
                    None => return Ok(()),
                };

                if let Some(index) = talk.noobs.iter().position(|&noob_id| noob_id == user_id) {
                    talk.noobs.remove(index);
                }

                talks
                    .values()
                    .collect::<Vec<_>>()
                    .write_to_file("talks.json")
                    .await
                    .wrap_err("failed to write talks.json")?;

                let _ = updates_sender.send(Update::RemoveNoob { talk_id, user_id });
            }
            Command::AddNerd { talk_id, user_id } => {
                let talks = &mut storage.lock().await.talks;

                let talk = match talks.get_mut(&talk_id) {
                    Some(talk) => talk,
                    None => return Ok(()),
                };

                if !talk.nerds.contains(&user_id) {
                    talk.nerds.push(user_id);
                }

                talks
                    .values()
                    .collect::<Vec<_>>()
                    .write_to_file("talks.json")
                    .await
                    .wrap_err("failed to write talks.json")?;

                let _ = updates_sender.send(Update::AddNerd { talk_id, user_id });
            }
            Command::RemoveNerd { talk_id, user_id } => {
                let talks = &mut storage.lock().await.talks;

                let talk = match talks.get_mut(&talk_id) {
                    Some(talk) => talk,
                    None => return Ok(()),
                };

                if let Some(index) = talk.nerds.iter().position(|&nerd_id| nerd_id == user_id) {
                    talk.nerds.remove(index);
                }

                talks
                    .values()
                    .collect::<Vec<_>>()
                    .write_to_file("talks.json")
                    .await
                    .wrap_err("failed to write talks.json")?;

                let _ = updates_sender.send(Update::RemoveNerd { talk_id, user_id });
            }
        }
    }

    Ok(())
}
