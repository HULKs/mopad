use std::{
    collections::BTreeSet,
    ops::DerefMut,
    time::{Duration, SystemTime},
};

use argon2::password_hash::SaltString;
use axum::extract::ws::{Message, WebSocket};
use eyre::{bail, Context, ContextCompat};
use rand_core::OsRng;

use crate::{
    messages::{AuthenticationCommand, Update},
    storage::{AttendanceMode, Role, Storage, UserId},
    AppState,
};

pub struct Authentication {
    pub user_id: UserId,
    pub roles: BTreeSet<Role>,
    pub token: String,
}

pub async fn authenticate(
    socket: &mut WebSocket,
    state: &AppState,
) -> eyre::Result<Authentication> {
    let authentication_command = receive_command(socket).await?;

    match authentication_command {
        AuthenticationCommand::Register {
            name,
            team,
            attendance_mode,
            password,
        } => register(
            state,
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
        } => login(state, name, team, password)
            .await
            .wrap_err("failed to login"),
        AuthenticationCommand::Relogin { token } => relogin(state, token).await,
    }
}

async fn receive_command(socket: &mut WebSocket) -> eyre::Result<AuthenticationCommand> {
    let maybe_message = socket.recv().await.wrap_err("WebSocket closed")?;
    let message = maybe_message.wrap_err("failed to receive message from WebSocket")?;
    let text = match message {
        Message::Text(text) => text,
        other => bail!("expected text message from WebSocket, got: {other:#?}"),
    };
    serde_json::from_str(&text).wrap_err("failed to parse JSON")
}

async fn register(
    state: &AppState,
    name: String,
    team: String,
    attendance_mode: AttendanceMode,
    password: String,
) -> eyre::Result<Authentication> {
    let storage = &mut state.storage.write().await;

    if !storage.teams.contains(&team) {
        bail!("unknown team {team}");
    }

    if storage
        .users
        .values()
        .any(|user| user.name == name && user.team == team)
    {
        bail!("user {name} from team {team} already exists");
    }

    let new_user_id = storage.add_user(name, team, attendance_mode, password);
    storage
        .users
        .commit()
        .await
        .expect("failed to commit users");

    // Inform all connected clients about the new user.
    let users_update = Update::Users {
        users: storage
            .users
            .values()
            .map(|user| (user.id, user.into()))
            .collect(),
    };
    let _ = state.updates_sender.send(users_update);

    let token = SaltString::generate(&mut OsRng).to_string();
    let now = SystemTime::now();
    let seven_days = Duration::from_secs(60 * 60 * 24 * 7);
    storage.tokens.remove_expired(now);
    storage
        .tokens
        .insert(token.clone(), new_user_id, now + seven_days);
    storage
        .tokens
        .commit()
        .await
        .wrap_err("failed to commit tokens")?;
    Ok(Authentication {
        user_id: new_user_id,
        roles: BTreeSet::new(),
        token,
    })
}

async fn login(
    state: &AppState,
    name: String,
    team: String,
    password: String,
) -> eyre::Result<Authentication> {
    let storage = &mut state.storage.write().await;
    let Storage { users, tokens, .. } = storage.deref_mut();

    let Some(user) = users
        .values()
        .find(|user| user.name == name && user.team == team)
    else {
        bail!("unknown user {name} from team {team}");
    };

    if !user.verify(password) {
        bail!("wrong password");
    }

    let token = SaltString::generate(&mut OsRng).to_string();
    let now = SystemTime::now();
    let seven_days = Duration::from_secs(60 * 60 * 24 * 7);
    tokens.remove_expired(now);
    tokens.insert(token.clone(), user.id, now + seven_days);
    tokens.commit().await.wrap_err("failed to commit tokens")?;

    Ok(Authentication {
        user_id: user.id,
        roles: user.roles.clone(),
        token,
    })
}

async fn relogin(state: &AppState, token: String) -> eyre::Result<Authentication> {
    let storage = &mut state.storage.write().await;

    let now = SystemTime::now();
    storage.tokens.remove_expired(now);
    storage
        .tokens
        .commit()
        .await
        .wrap_err("failed to commit tokens")?;

    let data = storage.tokens.get(&token).wrap_err("unknown token")?;
    let user = storage
        .users
        .get(&data.user_id)
        .wrap_err("unknown user id from token")?;

    Ok(Authentication {
        user_id: user.id,
        roles: user.roles.clone(),
        token,
    })
}
