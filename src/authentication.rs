use std::{
    collections::{BTreeMap, BTreeSet},
    time::{Duration, SystemTime},
};

use argon2::password_hash::SaltString;
use axum::extract::ws::{Message, WebSocket};
use rand_core::OsRng;
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

use crate::storage::{ReadFromFileExt, Role, Storage, User, WriteToFileExt};

type Tokens = BTreeMap<String, StoredToken>;

#[derive(Clone, Debug, Deserialize, Serialize)]
struct StoredToken {
    user_id: usize,
    expires_at: SystemTime,
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
        roles: BTreeSet<Role>,
        token: String,
    },
    AuthenticationError {
        reason: String,
    },
}

pub async fn authenticate(
    socket: &mut WebSocket,
    storage: &Mutex<Storage>,
) -> Option<(User, bool)> {
    let authentication_command: AuthenticationCommand = match socket.recv().await {
        Some(Ok(authentication_command)) => match authentication_command {
            Message::Text(authentication_command) => {
                match serde_json::from_str(&authentication_command) {
                    Ok(authentication_command) => authentication_command,
                    Err(_) => {
                        let _ = socket
                            .send(Message::Text(
                                serde_json::to_string(
                                    &AuthenticationResponse::AuthenticationError {
                                        reason: "failed to deserialize from WebSocket".to_string(),
                                    },
                                )
                                .unwrap(),
                            ))
                            .await;
                        return None;
                    }
                }
            }
            _ => {
                let _ = socket
                    .send(Message::Text(
                        serde_json::to_string(&AuthenticationResponse::AuthenticationError {
                            reason: "expected text message from WebSocket".to_string(),
                        })
                        .unwrap(),
                    ))
                    .await;
                return None;
            }
        },
        Some(Err(_)) => {
            let _ = socket
                .send(Message::Text(
                    serde_json::to_string(&AuthenticationResponse::AuthenticationError {
                        reason: "failed to read from WebSocket".to_string(),
                    })
                    .unwrap(),
                ))
                .await;
            return None;
        }
        None => return None,
    };

    match authentication_command {
        AuthenticationCommand::Register {
            name,
            team,
            password,
        } => {
            if !storage.lock().await.teams.contains(&team) {
                let _ = socket
                    .send(Message::Text(
                        serde_json::to_string(&AuthenticationResponse::AuthenticationError {
                            reason: "unknown team".to_string(),
                        })
                        .unwrap(),
                    ))
                    .await;
                return None;
            }

            let users = &mut storage.lock().await.users;

            if users
                .values()
                .any(|user| user.name == name && user.team == team)
            {
                let _ = socket
                    .send(Message::Text(
                        serde_json::to_string(&AuthenticationResponse::AuthenticationError {
                            reason: "already registered".to_string(),
                        })
                        .unwrap(),
                    ))
                    .await;
                return None;
            }

            let next_user_id = users.keys().copied().max().unwrap_or_default() + 1;

            users.insert(
                next_user_id,
                User::new(next_user_id, name, team, password, BTreeSet::new()),
            );

            users
                .values()
                .collect::<Vec<_>>()
                .write_to_file("users.json")
                .await
                .expect("failed to write users.json");

            let mut tokens = Tokens::read_from_file("tokens.json")
                .await
                .expect("failed to read tokens.json");
            let token = SaltString::generate(&mut OsRng).to_string();
            let now = SystemTime::now();
            tokens.insert(
                token.clone(),
                StoredToken {
                    user_id: next_user_id,
                    expires_at: now + Duration::from_secs(60 * 60 * 24 * 7),
                },
            );
            tokens.retain(|_token, stored_token| stored_token.expires_at >= now);
            tokens
                .write_to_file("tokens.json")
                .await
                .expect("failed to write tokens.json");

            let _ = socket
                .send(Message::Text(
                    serde_json::to_string(&AuthenticationResponse::AuthenticationSuccess {
                        user_id: next_user_id,
                        roles: users[&next_user_id].roles.clone(),
                        token,
                    })
                    .unwrap(),
                ))
                .await;

            Some((users[&next_user_id].clone(), true))
        }
        AuthenticationCommand::Login {
            name,
            team,
            password,
        } => {
            let users = &mut storage.lock().await.users;

            if let Some(user) = users
                .values()
                .find(|user| user.name == name && user.team == team)
            {
                if user.verify(password) {
                    let mut tokens = Tokens::read_from_file("tokens.json")
                        .await
                        .expect("failed to read tokens.json");
                    let token = SaltString::generate(&mut OsRng).to_string();
                    let now = SystemTime::now();
                    tokens.insert(
                        token.clone(),
                        StoredToken {
                            user_id: user.id,
                            expires_at: now + Duration::from_secs(60 * 60 * 24 * 7),
                        },
                    );
                    tokens.retain(|_token, stored_token| stored_token.expires_at >= now);
                    tokens
                        .write_to_file("tokens.json")
                        .await
                        .expect("failed to write tokens.json");

                    let _ = socket
                        .send(Message::Text(
                            serde_json::to_string(&AuthenticationResponse::AuthenticationSuccess {
                                user_id: user.id,
                                roles: user.roles.clone(),
                                token,
                            })
                            .unwrap(),
                        ))
                        .await;

                    Some((user.clone(), false))
                } else {
                    let _ = socket
                        .send(Message::Text(
                            serde_json::to_string(&AuthenticationResponse::AuthenticationError {
                                reason: "wrong password".to_string(),
                            })
                            .unwrap(),
                        ))
                        .await;
                    None
                }
            } else {
                let _ = socket
                    .send(Message::Text(
                        serde_json::to_string(&AuthenticationResponse::AuthenticationError {
                            reason: "unknown user".to_string(),
                        })
                        .unwrap(),
                    ))
                    .await;
                None
            }
        }
        AuthenticationCommand::Relogin { token } => {
            let users = &mut storage.lock().await.users;

            let mut tokens = Tokens::read_from_file("tokens.json")
                .await
                .expect("failed to read tokens.json");
            let now = SystemTime::now();
            let number_of_tokens = tokens.len();
            tokens.retain(|_token, stored_token| stored_token.expires_at >= now);
            let number_of_tokens_changed = number_of_tokens != tokens.len();
            let result = match tokens.get(&token) {
                Some(stored_token) => match users.get(&stored_token.user_id) {
                    Some(user) => {
                        let _ = socket
                            .send(Message::Text(
                                serde_json::to_string(
                                    &AuthenticationResponse::AuthenticationSuccess {
                                        user_id: user.id,
                                        roles: user.roles.clone(),
                                        token,
                                    },
                                )
                                .unwrap(),
                            ))
                            .await;
                        Some((user.clone(), false))
                    }
                    None => {
                        let _ = socket
                            .send(Message::Text(
                                serde_json::to_string(
                                    &AuthenticationResponse::AuthenticationError {
                                        reason: "unknown user from token".to_string(),
                                    },
                                )
                                .unwrap(),
                            ))
                            .await;
                        None
                    }
                },
                None => {
                    let _ = socket
                        .send(Message::Text(
                            serde_json::to_string(&AuthenticationResponse::AuthenticationError {
                                reason: "unknown token".to_string(),
                            })
                            .unwrap(),
                        ))
                        .await;
                    None
                }
            };
            if number_of_tokens_changed {
                tokens
                    .write_to_file("tokens.json")
                    .await
                    .expect("failed to write tokens.json");
            }
            result
        }
    }
}
