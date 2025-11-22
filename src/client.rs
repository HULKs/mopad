use axum::{
    extract::{
        ws::{Message, WebSocket},
        State, WebSocketUpgrade,
    },
    response::IntoResponse,
};
use eyre::{bail, Context, ContextCompat as _, Result};
use tokio::select;
use tracing::error;

use crate::{
    messages::{AuthenticationCommand, AuthenticationResponse, Command, Update},
    service::{Authentication, Service},
    storage::{AttendanceMode, UserId},
};

pub async fn handle_websocket(
    State(service): State<Service>,
    upgrade: WebSocketUpgrade,
) -> impl IntoResponse {
    upgrade.on_upgrade(move |socket| handle_upgraded_websocket(socket, service))
}

async fn handle_upgraded_websocket(socket: WebSocket, service: Service) {
    match connection(socket, service).await {
        Ok(_) => {}
        Err(error) => error!("Error in handle_upgraded_websocket(): {error:#?}"),
    }
}

async fn connection(mut socket: WebSocket, service: Service) -> Result<()> {
    let mut updates_receiver = service.updates_sender.subscribe();

    let user_id = match authenticate(&mut socket, &service).await {
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
        users: service
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
        let talks = &service.storage.read().await.talks;
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
                handle_message(command_message.unwrap(), user_id, &service)
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

pub async fn authenticate(
    socket: &mut WebSocket,
    service: &Service,
) -> eyre::Result<Authentication> {
    let maybe_message = socket.recv().await.wrap_err("WebSocket closed")?;
    let message = maybe_message.wrap_err("failed to receive message from WebSocket")?;
    let text = match message {
        Message::Text(text) => text,
        other => bail!("expected text message from WebSocket, got: {other:#?}"),
    };
    let authentication_command = serde_json::from_str(&text).wrap_err("failed to parse JSON")?;

    match authentication_command {
        AuthenticationCommand::Register {
            name,
            team,
            attendance_mode,
            password,
        } => service
            .register(
                name,
                team,
                attendance_mode.unwrap_or(AttendanceMode::OnSite),
                password,
            )
            .await
            .wrap_err("failed to register"),
        AuthenticationCommand::Login {
            name,
            team,
            password,
        } => service
            .login(name, team, password)
            .await
            .wrap_err("failed to login"),
        AuthenticationCommand::Relogin { token } => service.relogin(token).await,
    }
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
    service: &Service,
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
                service
                    .add_talk(user_id, title, description, duration)
                    .await?;
            }
            Command::RemoveTalk { talk_id } => {
                service.remove_talk(talk_id, user_id).await?;
            }
            Command::UpdateTitle { talk_id, title } => {
                service.update_title(talk_id, user_id, title).await?;
            }
            Command::UpdateDescription {
                talk_id,
                description,
            } => {
                service
                    .update_description(talk_id, user_id, description)
                    .await?;
            }
            Command::UpdateScheduledAt {
                talk_id,
                scheduled_at,
            } => {
                service
                    .update_scheduled_at(talk_id, user_id, scheduled_at)
                    .await?;
            }
            Command::UpdateDuration { talk_id, duration } => {
                service.update_duration(talk_id, user_id, duration).await?;
            }
            Command::UpdateLocation { talk_id, location } => {
                service.update_location(talk_id, user_id, location).await?;
            }
            Command::AddNoob { talk_id } => {
                service.add_noob(talk_id, user_id).await?;
            }
            Command::RemoveNoob { talk_id } => {
                service.remove_noob(talk_id, user_id).await?;
            }
            Command::AddNerd { talk_id } => {
                service.add_nerd(talk_id, user_id).await?;
            }
            Command::RemoveNerd { talk_id } => {
                service.remove_nerd(talk_id, user_id).await?;
            }
            Command::SetAttendanceMode { attendance_mode } => {
                service
                    .set_attendance_mode(user_id, attendance_mode)
                    .await?;
            }
        }
    }

    Ok(())
}
