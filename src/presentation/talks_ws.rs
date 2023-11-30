use std::{collections::HashSet, sync::Arc};

use axum::{
    extract::{
        ws::{Message, WebSocket},
        State, WebSocketUpgrade,
    },
    response::IntoResponse,
};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::{from_str, to_string};
use tokio::select;

use crate::application::{
    authentication::{AuthenticationService, Capability, Response},
    calendar::CalendarService,
    talks::{TalksService, Update},
    teams::TeamsService,
};

use super::Services;

pub async fn talks_ws(
    upgrade: WebSocketUpgrade,
    State(services): State<
        Arc<
            Services<
                impl AuthenticationService + Send + Sync + 'static,
                impl CalendarService + Send + Sync + 'static,
                impl TalksService + Send + Sync + 'static,
                impl TeamsService + Send + Sync + 'static,
            >,
        >,
    >,
) -> impl IntoResponse {
    upgrade.on_upgrade(move |socket| talks_ws_upgraded(socket, services))
}

async fn talks_ws_upgraded(
    socket: WebSocket,
    services: Arc<
        Services<
            impl AuthenticationService + Send + Sync,
            impl CalendarService + Send + Sync,
            impl TalksService + Send + Sync,
            impl TeamsService + Send + Sync,
        >,
    >,
) {
    if let Err(error) = talks_ws_connection(socket, services).await {
        eprintln!("Error from connection: {error:?}");
    }
}

async fn talks_ws_connection(
    mut socket: WebSocket,
    services: Arc<
        Services<
            impl AuthenticationService + Send + Sync,
            impl CalendarService + Send + Sync,
            impl TalksService + Send + Sync,
            impl TeamsService + Send + Sync,
        >,
    >,
) -> Result<(), String> {
    let mut updates = services.talks.register_for_updates();

    let response = match receive(&mut socket).await? {
        AuthenticationCommand::Register {
            name,
            team,
            password,
        } => services
            .authentication
            .register(&name, &team, &password)
            .await
            .map_err(|error| error.to_string())?,
        AuthenticationCommand::Login {
            name,
            team,
            password,
        } => services
            .authentication
            .login(&name, &team, &password)
            .await
            .map_err(|error| error.to_string())?,
        AuthenticationCommand::Relogin { token } => services
            .authentication
            .relogin(&token)
            .await
            .map_err(|error| error.to_string())?,
    };

    let Response::Success { user_id, capabilities, token } = response else {
        let reason = match response {
            Response::UnknownTeam => "unknown team",
            Response::AlreadyRegistered => "already registered",
            Response::WrongPassword => "wrong password",
            Response::UnknownUser => "unknown user",
            Response::UnknownUserFromToken => "unknown user from token",
            Response::UnknownToken => "unknown token",
            Response::Success { .. } => panic!("should not be reached"),
        };
        return send(&mut socket, &AuthenticationResponse::AuthenticationError {
            reason: reason.to_string(),
        }).await;
    };

    send(
        &mut socket,
        &AuthenticationResponse::AuthenticationSuccess {
            user_id: user_id as usize,
            capabilities: capabilities.clone(),
            token,
        },
    )
    .await?;

    for talk in services
        .talks
        .get_all_talks()
        .await
        .map_err(|error| error.to_string())?
    {
        send(&mut socket, &Update::AddTalk(talk)).await?;
    }

    loop {
        select! {
            command = receive(&mut socket) => {
                let command = command?;
                services
                    .talks
                    .trigger(user_id, &capabilities, command)
                    .await
                    .map_err(|error| error.to_string())?;
            },
            update = updates.recv() => {
                let update = update.map_err(|error| error.to_string())?;
                send(&mut socket, &update).await?;
            },
        }
    }
}

async fn send(socket: &mut WebSocket, message: &impl Serialize) -> Result<(), String> {
    socket
        .send(Message::Text(to_string(message).unwrap()))
        .await
        .map_err(|error| error.to_string())
}

async fn receive<T: DeserializeOwned>(socket: &mut WebSocket) -> Result<T, String> {
    let Message::Text(message) = socket
        .recv()
        .await
        .ok_or_else(|| "closed".to_string())?
        .map_err(|error| error.to_string())?
    else {
        return Err("expected text message".to_string());
    };
    from_str(&message).map_err(|error| error.to_string())
}

#[derive(Clone, Debug, Deserialize)]
enum AuthenticationCommand {
    Register {
        name: String,
        team: String,
        password: String,
    },
    Login {
        name: String,
        team: String,
        password: String,
    },
    Relogin {
        token: String,
    },
}

#[derive(Clone, Debug, Serialize)]
enum AuthenticationResponse {
    AuthenticationSuccess {
        user_id: usize,
        capabilities: HashSet<Capability>,
        token: String,
    },
    AuthenticationError {
        reason: String,
    },
}
