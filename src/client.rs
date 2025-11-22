use std::{
    collections::{BTreeMap, BTreeSet},
    ops::DerefMut,
    time::{Duration, SystemTime},
};

use axum::{
    extract::{
        ws::{Message, WebSocket},
        State, WebSocketUpgrade,
    },
    response::IntoResponse,
};
use eyre::{bail, Context, ContextCompat, Result};
use tokio::select;
use tracing::error;

use crate::{
    authentication::authenticate,
    messages::{AuthenticationResponse, Command, Update},
    storage::{Storage, Talk, UserId},
    AppState,
};

pub async fn handle_websocket(
    State(state): State<AppState>,
    upgrade: WebSocketUpgrade,
) -> impl IntoResponse {
    upgrade.on_upgrade(move |socket| handle_upgraded_websocket(socket, state))
}

async fn handle_upgraded_websocket(socket: WebSocket, state: AppState) {
    match connection(socket, state).await {
        Ok(_) => {}
        Err(error) => error!("Error in handle_upgraded_websocket(): {error:#?}"),
    }
}

async fn connection(mut socket: WebSocket, state: AppState) -> Result<()> {
    let mut updates_receiver = state.updates_sender.subscribe();

    let user_id = match authenticate(&mut socket, &state).await {
        Ok(authentication) => {
            let response = AuthenticationResponse::AuthenticationSuccess {
                user_id: authentication.user_id,
                roles: authentication.roles.clone(),
                token: authentication.token,
            };
            let _ = socket
                .send(Message::Text(
                    serde_json::to_string(&response).unwrap().into(),
                ))
                .await;
            authentication.user_id
        }
        Err(error) => {
            let response = AuthenticationResponse::AuthenticationError {
                reason: format!("{error:#}"),
            };
            let _ = socket
                .send(Message::Text(
                    serde_json::to_string(&response).unwrap().into(),
                ))
                .await;
            return Ok(());
        }
    };

    let update_users = Update::Users {
        users: state
            .storage
            .read()
            .await
            .users
            .values()
            .map(|user| (user.id, user.into()))
            .collect(),
    };
    let _ = socket
        .send(Message::Text(
            serde_json::to_string(&update_users).unwrap().into(),
        ))
        .await;

    {
        let talks = &state.storage.read().await.talks;
        for talk in talks.values() {
            let update = Update::AddTalk { talk: talk.clone() };
            let _ = socket
                .send(Message::Text(
                    serde_json::to_string(&update)
                        .wrap_err_with(|| format!("failed to serialize talk update: {update:#?}"))?
                        .into(),
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
                handle_message(command_message.unwrap(), user_id, &state)
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

async fn handle_update(update: Update, stream: &mut WebSocket) -> Result<()> {
    stream
        .send(Message::Text(
            serde_json::to_string(&update)
                .wrap_err("failed to serialize update")?
                .into(),
        ))
        .await
        .wrap_err("failed to send update")
}

async fn handle_message(
    command_message: Result<Message, axum::Error>,
    user_id: UserId,
    state: &AppState,
) -> Result<()> {
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
                add_talk(state, user_id, title, description, duration).await?;
            }
            Command::RemoveTalk { talk_id } => {
                remove_talk(state, talk_id, user_id).await?;
            }
            Command::UpdateTitle { talk_id, title } => {
                update_title(state, talk_id, user_id, title).await?;
            }
            Command::UpdateDescription {
                talk_id,
                description,
            } => {
                update_description(state, talk_id, user_id, description).await?;
            }
            Command::UpdateScheduledAt {
                talk_id,
                scheduled_at,
            } => {
                update_scheduled_at(state, talk_id, user_id, scheduled_at).await?;
            }
            Command::UpdateDuration { talk_id, duration } => {
                update_duration(state, talk_id, user_id, duration).await?;
            }
            Command::UpdateLocation { talk_id, location } => {
                update_location(state, talk_id, user_id, location).await?;
            }
            Command::AddNoob { talk_id } => {
                add_noob(state, talk_id, user_id).await?;
            }
            Command::RemoveNoob { talk_id } => {
                remove_noob(state, talk_id, user_id).await?;
            }
            Command::AddNerd { talk_id } => {
                add_nerd(state, talk_id, user_id).await?;
            }
            Command::RemoveNerd { talk_id } => {
                remove_nerd(state, talk_id, user_id).await?;
            }
            Command::SetAttendanceMode { attendance_mode } => {
                set_attendance_mode(state, user_id, attendance_mode).await?;
            }
        }
    }

    Ok(())
}

async fn add_talk(
    state: &AppState,
    user_id: UserId,
    title: String,
    description: String,
    duration: Duration,
) -> Result<()> {
    let talks = &mut state.storage.write().await.talks;
    let max_talk_id = talks.keys().copied().max().unwrap_or_default();
    let next_talk_id = max_talk_id + 1;
    let talk = Talk {
        id: next_talk_id,
        creator: user_id,
        title,
        description,
        scheduled_at: None,
        duration,
        location: None,
        nerds: BTreeSet::from([user_id]),
        noobs: Default::default(),
    };
    talks.insert(next_talk_id, talk.clone());
    talks.commit().await.wrap_err("failed to commit talks")?;
    let _ = state.updates_sender.send(Update::AddTalk { talk });
    Ok(())
}

fn get_talk(talks: &mut BTreeMap<usize, Talk>, talk_id: usize) -> Result<&mut Talk> {
    talks
        .get_mut(&talk_id)
        .wrap_err_with(|| format!("talk {talk_id} does not exist"))
}

async fn remove_talk(state: &AppState, talk_id: usize, user_id: UserId) -> Result<()> {
    let mut storage = state.storage.write().await;
    let Storage { users, talks, .. } = storage.deref_mut();
    let user = users
        .get(&user_id)
        .wrap_err_with(|| format!("user {user_id} does not exist"))?;
    let talk = get_talk(talks, talk_id)?;
    if !(user.is_editor() || user.is_scheduler() || user.is_creator(talk)) {
        bail!("user cannot edit talk with id {talk_id}");
    }
    let id = talk.id;
    talks.remove(&id);
    talks.commit().await.wrap_err("failed to commit talks")?;
    let _ = state.updates_sender.send(Update::RemoveTalk { talk_id });
    Ok(())
}

async fn update_title(
    state: &AppState,
    talk_id: usize,
    user_id: UserId,
    title: String,
) -> Result<()> {
    let mut storage = state.storage.write().await;
    let Storage { users, talks, .. } = storage.deref_mut();
    let user = users
        .get(&user_id)
        .wrap_err_with(|| format!("user {user_id} does not exist"))?;
    let talk = get_talk(talks, talk_id)?;
    if !(user.is_editor() || user.is_creator(talk)) {
        bail!("user cannot edit talk with id {talk_id}");
    }
    talk.title = title.clone();
    talks.commit().await.wrap_err("failed to commit talks")?;
    let _ = state
        .updates_sender
        .send(Update::UpdateTitle { talk_id, title });
    Ok(())
}

async fn update_description(
    state: &AppState,
    talk_id: usize,
    user_id: UserId,
    description: String,
) -> Result<()> {
    let mut storage = state.storage.write().await;
    let Storage { users, talks, .. } = storage.deref_mut();
    let user = users
        .get(&user_id)
        .wrap_err_with(|| format!("user {user_id} does not exist"))?;
    let talk = get_talk(talks, talk_id)?;
    if !(user.is_editor() || user.is_creator(talk)) {
        bail!("user cannot edit talk with id {talk_id}");
    }
    talk.description = description.clone();
    talks.commit().await.wrap_err("failed to commit talks")?;
    let _ = state.updates_sender.send(Update::UpdateDescription {
        talk_id,
        description,
    });
    Ok(())
}

async fn update_scheduled_at(
    state: &AppState,
    talk_id: usize,
    user_id: UserId,
    scheduled_at: Option<SystemTime>,
) -> Result<()> {
    let mut storage = state.storage.write().await;
    let Storage { users, talks, .. } = storage.deref_mut();
    let user = users
        .get(&user_id)
        .wrap_err_with(|| format!("user {user_id} does not exist"))?;
    let talk = get_talk(talks, talk_id)?;
    if !user.is_scheduler() {
        bail!("user cannot schedule talks");
    }
    talk.scheduled_at = scheduled_at;
    talks.commit().await.wrap_err("failed to commit talks")?;
    let _ = state.updates_sender.send(Update::UpdateScheduledAt {
        talk_id,
        scheduled_at,
    });
    Ok(())
}

async fn update_duration(
    state: &AppState,
    talk_id: usize,
    user_id: UserId,
    duration: Duration,
) -> Result<()> {
    let mut storage = state.storage.write().await;
    let Storage { users, talks, .. } = storage.deref_mut();
    let user = users
        .get(&user_id)
        .wrap_err_with(|| format!("user {user_id} does not exist"))?;
    let talk = get_talk(talks, talk_id)?;
    if !(user.is_scheduler() || user.is_creator(talk)) {
        bail!("user cannot change duration of talk with id {talk_id}");
    }
    talk.duration = duration;
    talks.commit().await.wrap_err("failed to commit talks")?;
    let _ = state
        .updates_sender
        .send(Update::UpdateDuration { talk_id, duration });
    Ok(())
}

async fn update_location(
    state: &AppState,
    talk_id: usize,
    user_id: UserId,
    location: Option<String>,
) -> Result<()> {
    let mut storage = state.storage.write().await;
    let Storage { users, talks, .. } = storage.deref_mut();
    let user = users
        .get(&user_id)
        .wrap_err_with(|| format!("user {user_id} does not exist"))?;
    let talk = get_talk(talks, talk_id)?;
    if !(user.is_scheduler() || user.is_creator(talk)) {
        bail!("user cannot schedule talks");
    }
    talk.location = location.clone();
    talks.commit().await.wrap_err("failed to commit talks")?;
    let _ = state
        .updates_sender
        .send(Update::UpdateLocation { talk_id, location });
    Ok(())
}

async fn add_noob(state: &AppState, talk_id: usize, user_id: usize) -> Result<(), eyre::Error> {
    let talks = &mut state.storage.write().await.talks;
    let talk = get_talk(talks, talk_id)?;
    talk.noobs.insert(user_id);
    talks.commit().await.wrap_err("failed to commit talks")?;
    let _ = state
        .updates_sender
        .send(Update::AddNoob { talk_id, user_id });
    Ok(())
}

async fn remove_noob(state: &AppState, talk_id: usize, user_id: usize) -> Result<(), eyre::Error> {
    let talks = &mut state.storage.write().await.talks;
    let talk = get_talk(talks, talk_id)?;
    talk.noobs.remove(&user_id);
    talks.commit().await.wrap_err("failed to commit talks")?;
    let _ = state
        .updates_sender
        .send(Update::RemoveNoob { talk_id, user_id });
    Ok(())
}

async fn add_nerd(state: &AppState, talk_id: usize, user_id: usize) -> Result<(), eyre::Error> {
    let talks = &mut state.storage.write().await.talks;
    let talk = get_talk(talks, talk_id)?;
    talk.nerds.insert(user_id);
    talks.commit().await.wrap_err("failed to commit talks")?;
    let _ = state
        .updates_sender
        .send(Update::AddNerd { talk_id, user_id });
    Ok(())
}

async fn remove_nerd(state: &AppState, talk_id: usize, user_id: usize) -> Result<(), eyre::Error> {
    let talks = &mut state.storage.write().await.talks;
    let talk = get_talk(talks, talk_id)?;
    talk.nerds.remove(&user_id);
    talks.commit().await.wrap_err("failed to commit talks")?;
    let _ = state
        .updates_sender
        .send(Update::RemoveNerd { talk_id, user_id });
    Ok(())
}

async fn set_attendance_mode(
    state: &AppState,
    user_id: UserId,
    attendance_mode: crate::storage::AttendanceMode,
) -> Result<()> {
    let mut storage = state.storage.write().await;
    let Storage { users, .. } = storage.deref_mut();
    let user = users
        .get_mut(&user_id)
        .wrap_err_with(|| format!("user {user_id} does not exist"))?;
    user.attendance_mode = attendance_mode;
    users.commit().await.wrap_err("failed to commit users")?;
    let _ = state.updates_sender.send(Update::UpdateAttendanceMode {
        user_id,
        attendance_mode,
    });
    Ok(())
}
