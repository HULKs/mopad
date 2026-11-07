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
    service::{Authentication, Service},
    wire::{
        AttendanceMode, AuthenticationCommand, AuthenticationResponse, Command, CommandRequest,
        Update, UserId,
    },
};

pub async fn handle_websocket(
    State(service): State<Service>,
    upgrade: WebSocketUpgrade,
) -> impl IntoResponse {
    upgrade.on_upgrade(move |socket| handle_upgraded_websocket(socket, service))
}

async fn handle_upgraded_websocket(socket: WebSocket, service: Service) {
    if let Err(error) = connection(socket, service).await {
        error!("Error in handle_upgraded_websocket(): {error:#?}");
    }
}

async fn connection(mut socket: WebSocket, service: Service) -> Result<()> {
    let Authentication {
        user_id,
        roles,
        token,
    } = match authenticate(&mut socket, &service).await {
        Ok(authentication) => authentication,
        Err(error) => {
            send_message(
                AuthenticationResponse::AuthenticationError {
                    reason: format!("{error:#}"),
                },
                &mut socket,
            )
            .await?;
            return Ok(());
        }
    };
    send_message(
        AuthenticationResponse::AuthenticationSuccess {
            user_id,
            roles,
            token: token.clone(),
        },
        &mut socket,
    )
    .await?;

    let (snapshot, mut updates_receiver) = {
        let storage = service.storage.read().await;
        (storage.snapshot(), service.updates_sender.subscribe())
    };
    send_message(snapshot, &mut socket).await?;
    let mut session_check = tokio::time::interval(std::time::Duration::from_secs(30));

    loop {
        select! {
            command_message = socket.recv() => {
                let Some(message) = command_message else { break; };
                let message = message.wrap_err("failed to receive command")?;
                let Message::Text(text) = message else { continue; };
                let request: CommandRequest = serde_json::from_str(&text).wrap_err("invalid command request")?;
                service.storage.read().await.user_for_token(&token)?;
                let logout = matches!(request.command, Command::Logout {});
                let result = if logout { service.logout(&token).await }
                    else { handle_command(request.command, user_id, &service).await };
                // Deliver committed data before acknowledging it to the editor.
                loop {
                    match updates_receiver.try_recv() {
                        Ok(update) => send_message(update, &mut socket).await?,
                        Err(tokio::sync::broadcast::error::TryRecvError::Empty) => break,
                        Err(error) => return Err(error.into()),
                    }
                }
                send_message(Update::CommandResult { id: request.id, error: result.err().map(|error| format!("{error:#}")) }, &mut socket).await?;
                if logout { break; }
            }
            update = updates_receiver.recv() => {
                let update = update.wrap_err("failed to receive update")?;
                send_message(update, &mut socket)
                    .await
                    .wrap_err("failed to handle update")?;
            }
            _ = session_check.tick() => { service.storage.read().await.user_for_token(&token)?; }
        }
    }

    Ok(())
}

async fn authenticate(socket: &mut WebSocket, service: &Service) -> Result<Authentication> {
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
        AuthenticationCommand::Relogin { token } => service.relogin(&token).await,
    }
}

async fn send_message(message: impl serde::Serialize, stream: &mut WebSocket) -> Result<()> {
    stream
        .send(Message::Text(
            serde_json::to_string(&message)
                .wrap_err("failed to serialize message")?
                .into(),
        ))
        .await
        .wrap_err("failed to send message")
}

async fn handle_command(command: Command, user_id: UserId, service: &Service) -> Result<()> {
    match command {
        Command::Logout {} => bail!("logout must be handled by the connection"),
        Command::ScheduleTalk {
            talk_id,
            before,
            after,
        } => service.schedule_talk(talk_id, user_id, before, after).await,
        Command::AddTalk {
            title,
            description,
            duration,
        } => {
            service
                .add_talk(user_id, title, description, duration)
                .await
        }
        Command::RemoveTalk { talk_id } => service.remove_talk(talk_id, user_id).await,
        Command::UpdateTitle { talk_id, title } => {
            service.update_title(talk_id, user_id, title).await
        }
        Command::UpdateDescription {
            talk_id,
            description,
        } => {
            service
                .update_description(talk_id, user_id, description)
                .await
        }
        Command::UpdateScheduledAt {
            talk_id,
            scheduled_at,
        } => {
            service
                .update_scheduled_at(talk_id, user_id, scheduled_at)
                .await
        }
        Command::UpdateDuration { talk_id, duration } => {
            service.update_duration(talk_id, user_id, duration).await
        }
        Command::UpdateLocation { talk_id, location } => {
            service.update_location(talk_id, user_id, location).await
        }
        Command::AddNoob { talk_id } => service.add_noob(talk_id, user_id).await,
        Command::RemoveNoob { talk_id } => service.remove_noob(talk_id, user_id).await,
        Command::AddNerd { talk_id } => service.add_nerd(talk_id, user_id).await,
        Command::RemoveNerd { talk_id } => service.remove_nerd(talk_id, user_id).await,
        Command::SetAttendanceMode { attendance_mode } => {
            service.set_attendance_mode(user_id, attendance_mode).await
        }
    }
}
