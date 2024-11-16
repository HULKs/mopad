use std::{
    collections::{BTreeMap, BTreeSet},
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
    storage::{Talk, User},
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

    let user = match authenticate(&mut socket, &state).await {
        Ok((user, token)) => {
            let response = AuthenticationResponse::AuthenticationSuccess {
                user_id: user.id,
                roles: user.roles.clone(),
                token,
            };
            let _ = socket
                .send(Message::Text(serde_json::to_string(&response).unwrap()))
                .await;
            user
        }
        Err(error) => {
            let response = AuthenticationResponse::AuthenticationError {
                reason: format!("{error:#}"),
            };
            let _ = socket
                .send(Message::Text(serde_json::to_string(&response).unwrap()))
                .await;
            return Ok(());
        }
    };

    let update_users = Update::Users {
        users: state
            .storage
            .lock()
            .await
            .users
            .values()
            .map(|user| (user.id, user.into()))
            .collect(),
    };
    let _ = socket
        .send(Message::Text(serde_json::to_string(&update_users).unwrap()))
        .await;

    {
        let talks = &state.storage.lock().await.talks;
        for talk in talks.values() {
            let update = Update::AddTalk { talk: talk.clone() };
            let _ = socket
                .send(Message::Text(
                    serde_json::to_string(&update).wrap_err_with(|| {
                        format!("failed to serialize talk update: {update:#?}")
                    })?,
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
                handle_message(command_message.unwrap(), &user, &state)
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
            serde_json::to_string(&update).wrap_err("failed to serialize update")?,
        ))
        .await
        .wrap_err("failed to send update")
}

async fn handle_message(
    command_message: Result<Message, axum::Error>,
    user: &User,
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
                add_talk(state, user, title, description, duration).await?;
            }
            Command::RemoveTalk { talk_id } => {
                remove_talk(state, talk_id, user).await?;
            }
            Command::UpdateTitle { talk_id, title } => {
                update_title(state, talk_id, user, title).await?;
            }
            Command::UpdateDescription {
                talk_id,
                description,
            } => {
                update_description(state, talk_id, user, description).await?;
            }
            Command::UpdateScheduledAt {
                talk_id,
                scheduled_at,
            } => {
                update_scheduled_at(state, talk_id, user, scheduled_at).await?;
            }
            Command::UpdateDuration { talk_id, duration } => {
                update_duration(state, talk_id, user, duration).await?;
            }
            Command::UpdateLocation { talk_id, location } => {
                update_location(state, talk_id, user, location).await?;
            }
            Command::AddNoob { talk_id, user_id } => {
                add_noob(state, talk_id, user_id).await?;
            }
            Command::RemoveNoob { talk_id, user_id } => {
                remove_noob(state, talk_id, user_id).await?;
            }
            Command::AddNerd { talk_id, user_id } => {
                add_nerd(state, talk_id, user_id).await?;
            }
            Command::RemoveNerd { talk_id, user_id } => {
                remove_nerd(state, talk_id, user_id).await?;
            }
        }
    }

    Ok(())
}

async fn add_talk(
    state: &AppState,
    user: &User,
    title: String,
    description: String,
    duration: Duration,
) -> Result<()> {
    let talks = &mut state.storage.lock().await.talks;
    let max_talk_id = talks.keys().copied().max().unwrap_or_default();
    let next_talk_id = max_talk_id + 1;
    let talk = Talk {
        id: next_talk_id,
        creator: user.id,
        title,
        description,
        scheduled_at: None,
        duration,
        location: None,
        nerds: BTreeSet::from([user.id]),
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

async fn remove_talk(state: &AppState, talk_id: usize, user: &User) -> Result<()> {
    let talks = &mut state.storage.lock().await.talks;
    let talk = get_talk(talks, talk_id)?;
    if !(user.is_editor() || user.is_scheduler()) {
        bail!("user cannot edit talk with id {talk_id}");
    }
    let id = talk.id;
    talks.remove(&id);
    talks.commit().await.wrap_err("failed to commit talks")?;
    let _ = state.updates_sender.send(Update::RemoveTalk { talk_id });
    Ok(())
}

async fn update_title(state: &AppState, talk_id: usize, user: &User, title: String) -> Result<()> {
    let talks = &mut state.storage.lock().await.talks;
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
    user: &User,
    description: String,
) -> Result<()> {
    let talks = &mut state.storage.lock().await.talks;
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
    user: &User,
    scheduled_at: Option<SystemTime>,
) -> Result<()> {
    let talks = &mut state.storage.lock().await.talks;
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
    user: &User,
    duration: Duration,
) -> Result<()> {
    let talks = &mut state.storage.lock().await.talks;
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
    user: &User,
    location: Option<String>,
) -> Result<()> {
    let talks = &mut state.storage.lock().await.talks;
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
    let talks = &mut state.storage.lock().await.talks;
    let talk = get_talk(talks, talk_id)?;
    talk.noobs.insert(user_id);
    talks.commit().await.wrap_err("failed to commit talks")?;
    let _ = state
        .updates_sender
        .send(Update::AddNoob { talk_id, user_id });
    Ok(())
}

async fn remove_noob(state: &AppState, talk_id: usize, user_id: usize) -> Result<(), eyre::Error> {
    let talks = &mut state.storage.lock().await.talks;
    let talk = get_talk(talks, talk_id)?;
    talk.noobs.remove(&user_id);
    talks.commit().await.wrap_err("failed to commit talks")?;
    let _ = state
        .updates_sender
        .send(Update::RemoveNoob { talk_id, user_id });
    Ok(())
}

async fn add_nerd(state: &AppState, talk_id: usize, user_id: usize) -> Result<(), eyre::Error> {
    let talks = &mut state.storage.lock().await.talks;
    let talk = get_talk(talks, talk_id)?;
    talk.nerds.insert(user_id);
    talks.commit().await.wrap_err("failed to commit talks")?;
    let _ = state
        .updates_sender
        .send(Update::AddNerd { talk_id, user_id });
    Ok(())
}

async fn remove_nerd(state: &AppState, talk_id: usize, user_id: usize) -> Result<(), eyre::Error> {
    let talks = &mut state.storage.lock().await.talks;
    let talk = get_talk(talks, talk_id)?;
    talk.nerds.remove(&user_id);
    talks.commit().await.wrap_err("failed to commit talks")?;
    let _ = state
        .updates_sender
        .send(Update::RemoveNerd { talk_id, user_id });
    Ok(())
}
