use std::{
    collections::{BTreeMap, BTreeSet},
    fmt::{Debug, Write},
    io,
    net::SocketAddr,
    path::Path,
    str::FromStr,
    sync::Arc,
    time::{Duration, SystemTime},
};

use argon2::{password_hash::SaltString, Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use axum::{
    extract::{
        ws::{Message, WebSocket},
        Query, WebSocketUpgrade,
    },
    http::{header::CONTENT_TYPE, StatusCode},
    response::IntoResponse,
    routing::{get, get_service},
    Json, Router, Server,
};
use eyre::WrapErr;
use rand_core::OsRng;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::{from_str, to_string};
use time::{format_description::parse, OffsetDateTime};
use tokio::{
    fs::{read_to_string, File},
    io::AsyncWriteExt,
    select,
    signal::unix::{signal, SignalKind},
    spawn,
    sync::{broadcast, Mutex},
};
use tower_http::services::ServeDir;

#[tokio::main]
async fn main() -> eyre::Result<()> {
    let teams: Arc<Mutex<BTreeSet<String>>> = Arc::new(Mutex::new(
        read_from_file("teams.json")
            .await
            .wrap_err("failed to read teams.json")?,
    ));
    let users = Arc::new(Mutex::new(
        read_users("users.json")
            .await
            .wrap_err("failed to read users")?,
    ));
    let talks = Arc::new(Mutex::new(
        read_talks("talks.json")
            .await
            .wrap_err("failed to read talks")?,
    ));

    let (updates_sender, _updates_receiver) = broadcast::channel(1337);
    let application = Router::new()
        .route(
            "/api",
            get({
                let teams = teams.clone();
                let users = users.clone();
                let talks = talks.clone();
                let updates_sender = updates_sender.clone();
                move |upgrade| handle_websocket(upgrade, teams, users, talks, updates_sender)
            }),
        )
        .route(
            "/teams.json",
            get({
                let teams = teams.clone();
                move || handle_teams(teams)
            }),
        )
        .route(
            "/talks.ics",
            get({
                let users = users.clone();
                let talks = talks.clone();
                move |parameters| handle_icalendar(parameters, users, talks)
            }),
        )
        .fallback(get_service(ServeDir::new("./frontend")).handle_error(handle_error));

    spawn({
        let teams = teams.clone();
        let users = users.clone();
        let talks = talks.clone();
        let updates_sender = updates_sender.clone();
        refresh_files_from_disk_on_signal(teams, users, talks, updates_sender)
    });

    Server::bind(&SocketAddr::from_str("[::]:1337").unwrap())
        .serve(application.into_make_service())
        .await
        .wrap_err("failed to server")
}

async fn read_users<P>(file_path: P) -> eyre::Result<BTreeMap<usize, User>>
where
    P: AsRef<Path> + Debug,
{
    let users: Vec<User> = read_from_file(file_path)
        .await
        .wrap_err("failed to read from users.json")?;
    Ok(users.into_iter().map(|user| (user.id, user)).collect())
}

async fn read_talks<P>(file_path: P) -> eyre::Result<BTreeMap<usize, Talk>>
where
    P: AsRef<Path> + Debug,
{
    let talks: Vec<Talk> = read_from_file(file_path)
        .await
        .wrap_err("failed to read from talks.json")?;
    Ok(talks.into_iter().map(|talk| (talk.id, talk)).collect())
}

async fn read_from_file<P, T>(file_path: P) -> eyre::Result<T>
where
    P: AsRef<Path> + Debug,
    T: DeserializeOwned,
{
    let contents = read_to_string(&file_path)
        .await
        .wrap_err_with(|| format!("failed to read {file_path:?}"))?;
    from_str(&contents).wrap_err_with(|| format!("failed to deserialize {file_path:?}"))
}

async fn write_to_file<P, T>(file_path: P, data: &T) -> eyre::Result<()>
where
    P: AsRef<Path> + Debug,
    T: Serialize,
{
    let contents =
        to_string(data).wrap_err_with(|| format!("failed to serialize {file_path:?}"))?;
    let mut file = File::create(&file_path)
        .await
        .wrap_err_with(|| format!("failed to create {file_path:?}"))?;
    file.write_all(contents.as_bytes())
        .await
        .wrap_err_with(|| format!("failed to write to {file_path:?}"))
}

async fn refresh_files_from_disk_on_signal(
    teams: Arc<Mutex<BTreeSet<String>>>,
    users: Arc<Mutex<BTreeMap<usize, User>>>,
    talks: Arc<Mutex<BTreeMap<usize, Talk>>>,
    updates_sender: broadcast::Sender<Update>,
) {
    let mut received_signals =
        signal(SignalKind::user_defined1()).expect("failed to register SIGUSR1 handler");

    loop {
        received_signals.recv().await;
        eprintln!("Refreshing files from disk...");

        let mut teams = teams.lock().await;
        let mut users = users.lock().await;
        let mut talks = talks.lock().await;

        let refreshed_teams: BTreeSet<String> = match read_from_file("teams.json").await {
            Ok(teams) => teams,
            Err(error) => {
                eprintln!("Failed to read teams.json: {error:?}");
                continue;
            }
        };

        let refreshed_users = match read_users("users.json").await {
            Ok(users) => users,
            Err(error) => {
                eprintln!("Failed to read users: {error:?}");
                continue;
            }
        };

        let refreshed_talks = match read_talks("talks.json").await {
            Ok(talks) => talks,
            Err(error) => {
                eprintln!("Failed to read talks: {error:?}");
                continue;
            }
        };

        *teams = refreshed_teams;

        if refreshed_users != *users {
            *users = refreshed_users;
            let _ = updates_sender.send(Update::Users {
                users: users
                    .iter()
                    .map(|(user_id, user)| (*user_id, user.into()))
                    .collect(),
            });
        }

        for talk_id in talks
            .keys()
            .filter(|talk_id| !refreshed_talks.contains_key(talk_id))
        {
            let _ = updates_sender.send(Update::RemoveTalk { talk_id: *talk_id });
        }
        for (talk_id, refreshed_talk) in refreshed_talks.iter() {
            if let Some(existing_talk) = talks.get(talk_id) {
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
                        scheduled_at: refreshed_talk.scheduled_at.clone(),
                    });
                }
                if refreshed_talk.duration != existing_talk.duration {
                    let _ = updates_sender.send(Update::UpdateDuration {
                        talk_id: *talk_id,
                        duration: refreshed_talk.duration.clone(),
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
        *talks = refreshed_talks;
    }
}

async fn handle_teams(teams: Arc<Mutex<BTreeSet<String>>>) -> Json<BTreeSet<String>> {
    Json(teams.lock().await.clone())
}

#[derive(Deserialize)]
struct ICalendarParameters {
    user_id: Option<usize>,
}

async fn handle_icalendar(
    parameters: Query<ICalendarParameters>,
    users: Arc<Mutex<BTreeMap<usize, User>>>,
    talks: Arc<Mutex<BTreeMap<usize, Talk>>>,
) -> impl IntoResponse {
    let mut response = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//HULKs//mopad//EN\r\nNAME:Mopad\r\nX-WR-CALNAME:Mopad\r\nX-WR-CALDESC:Moderated Organization PAD (powerful, agile, distributed)\r\n".to_string();
    let format = parse("[year][month][day]T[hour][minute][second]Z").unwrap();
    let now = OffsetDateTime::now_utc();
    let users = users.lock().await;
    let talks = talks.lock().await;
    for talk in talks.values() {
        match parameters.user_id {
            Some(user_id) if !talk.noobs.contains(&user_id) && !talk.nerds.contains(&user_id) => {
                continue
            }
            _ => {}
        }
        if let Some(scheduled_at) = talk.scheduled_at {
            let start = OffsetDateTime::from(scheduled_at);
            let end = start + talk.duration;
            write!(
                response,
                "BEGIN:VEVENT\r\nUID:{}\r\nDTSTAMP:{}\r\nDTSTART:{}\r\nDTEND:{}\r\nSUMMARY:{}\r\nDESCRIPTION:{}\r\n",
                talk.id,
                now.format(&format).unwrap(),
                start.format(&format).unwrap(),
                end.format(&format).unwrap(),
                talk.title.replace('\r', "").replace('\n', ""),
                talk.description.replace('\r', "").replace('\n', ""),
            )
            .unwrap();
            for nerd in talk.nerds.iter() {
                let user = &users[nerd];
                write!(
                    response,
                    "ATTENDEE;ROLE=CHAIR;PARTSTAT=ACCEPTED;CN={} ({}):MAILTO:user{}@mopad\r\n",
                    user.name
                        .replace(';', "")
                        .replace('\r', "")
                        .replace('\n', ""),
                    user.team
                        .replace(';', "")
                        .replace('\r', "")
                        .replace('\n', ""),
                    user.id,
                )
                .unwrap();
            }
            for noob in talk.noobs.iter() {
                let user = &users[noob];
                write!(
                    response,
                    "ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN={} ({}):MAILTO:user{}@mopad\r\n",
                    user.name.replace(';', "").replace('\r', "").replace('\n', ""),
                    user.team.replace(';', "").replace('\r', "").replace('\n', ""),
                    user.id,
                )
                .unwrap();
            }
            write!(response, "END:VEVENT\r\n",).unwrap();
        }
    }
    write!(response, "END:VCALENDAR\r\n",).unwrap();
    (
        StatusCode::OK,
        [(CONTENT_TYPE, "text/calendar; charset=utf-8")],
        response,
    )
}

async fn handle_error(error: io::Error) -> impl IntoResponse {
    eprintln!("Error in ServeDir: {error:?}");
    (StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error")
}

async fn handle_websocket(
    upgrade: WebSocketUpgrade,
    teams: Arc<Mutex<BTreeSet<String>>>,
    users: Arc<Mutex<BTreeMap<usize, User>>>,
    talks: Arc<Mutex<BTreeMap<usize, Talk>>>,
    updates_sender: broadcast::Sender<Update>,
) -> impl IntoResponse {
    upgrade.on_upgrade(move |socket| {
        handle_upgraded_websocket(socket, teams, users, talks, updates_sender)
    })
}

async fn handle_upgraded_websocket(
    socket: WebSocket,
    teams: Arc<Mutex<BTreeSet<String>>>,
    users: Arc<Mutex<BTreeMap<usize, User>>>,
    talks: Arc<Mutex<BTreeMap<usize, Talk>>>,
    updates_sender: broadcast::Sender<Update>,
) {
    match connection(socket, teams, users, talks, updates_sender).await {
        Ok(_) => {}
        Err(error) => eprintln!("Error in handle_upgraded_websocket():\n{error:?}"),
    }
}

async fn connection(
    mut socket: WebSocket,
    teams: Arc<Mutex<BTreeSet<String>>>,
    users: Arc<Mutex<BTreeMap<usize, User>>>,
    talks: Arc<Mutex<BTreeMap<usize, Talk>>>,
    updates_sender: broadcast::Sender<Update>,
) -> eyre::Result<()> {
    let mut updates_receiver = updates_sender.subscribe();

    let (current_user, users_changed) = match authenticate(&mut socket, &teams, &users).await {
        Some((current_user, users_changed)) => (current_user, users_changed),
        None => return Ok(()),
    };

    let update_users = Update::Users {
        users: users
            .lock()
            .await
            .iter()
            .map(|(user_id, user)| (*user_id, user.into()))
            .collect(),
    };
    if users_changed {
        let _ = updates_sender.send(update_users);
    } else {
        let _ = socket
            .send(Message::Text(to_string(&update_users).unwrap()))
            .await;
    }

    {
        let talks = talks.lock().await;
        for talk in talks.values() {
            let _ = socket
                .send(Message::Text(
                    to_string(&Update::AddTalk { talk: talk.clone() }).unwrap(),
                ))
                .await;
        }
    }

    loop {
        select! {
            command_message = socket.recv() => {
                if let None = command_message {
                    break;
                }
                handle_message(command_message.unwrap(), &talks, &current_user, &updates_sender)
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

async fn authenticate(
    socket: &mut WebSocket,
    teams: &Arc<Mutex<BTreeSet<String>>>,
    users: &Arc<Mutex<BTreeMap<usize, User>>>,
) -> Option<(User, bool)> {
    let authentication_command: AuthenticationCommand = match socket.recv().await {
        Some(Ok(authentication_command)) => match authentication_command {
            Message::Text(authentication_command) => match from_str(&authentication_command) {
                Ok(authentication_command) => authentication_command,
                Err(_) => {
                    let _ = socket
                        .send(Message::Text(
                            to_string(&AuthenticationResponse::AuthenticationError {
                                reason: "failed to deserialize from WebSocket".to_string(),
                            })
                            .unwrap(),
                        ))
                        .await;
                    return None;
                }
            },
            _ => {
                let _ = socket
                    .send(Message::Text(
                        to_string(&AuthenticationResponse::AuthenticationError {
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
                    to_string(&AuthenticationResponse::AuthenticationError {
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
            if !teams.lock().await.contains(&team) {
                let _ = socket
                    .send(Message::Text(
                        to_string(&AuthenticationResponse::AuthenticationError {
                            reason: "unknown team".to_string(),
                        })
                        .unwrap(),
                    ))
                    .await;
                return None;
            }

            let mut users = users.lock().await;

            if users
                .values()
                .any(|user| user.name == name && user.team == team)
            {
                let _ = socket
                    .send(Message::Text(
                        to_string(&AuthenticationResponse::AuthenticationError {
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

            write_to_file("users.json", &users.values().collect::<Vec<_>>())
                .await
                .expect("failed to write users.json");

            let _ = socket
                .send(Message::Text(
                    to_string(&AuthenticationResponse::AuthenticationSuccess {
                        user_id: next_user_id,
                        roles: users[&next_user_id].roles.clone(),
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
            let users = users.lock().await;

            if let Some(user) = users
                .values()
                .find(|user| user.name == name && user.team == team)
            {
                if user.verify(password) {
                    let _ = socket
                        .send(Message::Text(
                            to_string(&AuthenticationResponse::AuthenticationSuccess {
                                user_id: user.id,
                                roles: user.roles.clone(),
                            })
                            .unwrap(),
                        ))
                        .await;

                    Some((user.clone(), false))
                } else {
                    let _ = socket
                        .send(Message::Text(
                            to_string(&AuthenticationResponse::AuthenticationError {
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
                        to_string(&AuthenticationResponse::AuthenticationError {
                            reason: "unknown user".to_string(),
                        })
                        .unwrap(),
                    ))
                    .await;
                None
            }
        }
    }
}

async fn handle_message(
    command_message: Result<Message, axum::Error>,
    talks: &Arc<Mutex<BTreeMap<usize, Talk>>>,
    current_user: &User,
    updates_sender: &broadcast::Sender<Update>,
) -> eyre::Result<()> {
    let command_message = command_message.wrap_err("failed to receive command")?;

    match command_message {
        Message::Text(message) => {
            let command: Command =
                from_str(&message).wrap_err("failed to deserialize command message")?;

            match command {
                Command::AddTalk {
                    title,
                    description,
                    duration,
                } => {
                    let mut talks = talks.lock().await;

                    let next_talk_id = talks.keys().copied().max().unwrap_or_default() + 1;

                    let talk = Talk {
                        id: next_talk_id,
                        creator: current_user.id,
                        title,
                        description,
                        scheduled_at: None,
                        duration,
                        nerds: vec![current_user.id],
                        noobs: vec![],
                    };
                    talks.insert(next_talk_id, talk.clone());

                    write_to_file("talks.json", &talks.values().collect::<Vec<_>>())
                        .await
                        .wrap_err("failed to write talks.json")?;

                    let _ = updates_sender.send(Update::AddTalk { talk });
                }
                Command::RemoveTalk { talk_id } => {
                    let mut talks = talks.lock().await;

                    if !talks.contains_key(&talk_id)
                        || (!current_user.roles.contains(&Role::Editor)
                            && talks[&talk_id].creator != current_user.id)
                    {
                        return Ok(());
                    }

                    talks.remove(&talk_id);

                    write_to_file("talks.json", &talks.values().collect::<Vec<_>>())
                        .await
                        .wrap_err("failed to write talks.json")?;

                    let _ = updates_sender.send(Update::RemoveTalk { talk_id });
                }
                Command::UpdateTitle { talk_id, title } => {
                    let mut talks = talks.lock().await;

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

                    write_to_file("talks.json", &talks.values().collect::<Vec<_>>())
                        .await
                        .wrap_err("failed to write talks.json")?;

                    let _ = updates_sender.send(Update::UpdateTitle { talk_id, title });
                }
                Command::UpdateDescription {
                    talk_id,
                    description,
                } => {
                    let mut talks = talks.lock().await;

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

                    write_to_file("talks.json", &talks.values().collect::<Vec<_>>())
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
                    let mut talks = talks.lock().await;

                    if !talks.contains_key(&talk_id)
                        || !current_user.roles.contains(&Role::Scheduler)
                    {
                        return Ok(());
                    }

                    let talk = match talks.get_mut(&talk_id) {
                        Some(talk) => talk,
                        None => return Ok(()),
                    };

                    talk.scheduled_at = scheduled_at;

                    write_to_file("talks.json", &talks.values().collect::<Vec<_>>())
                        .await
                        .wrap_err("failed to write talks.json")?;

                    let _ = updates_sender.send(Update::UpdateScheduledAt {
                        talk_id,
                        scheduled_at,
                    });
                }
                Command::UpdateDuration { talk_id, duration } => {
                    let mut talks = talks.lock().await;

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

                    write_to_file("talks.json", &talks.values().collect::<Vec<_>>())
                        .await
                        .wrap_err("failed to write talks.json")?;

                    let _ = updates_sender.send(Update::UpdateDuration { talk_id, duration });
                }
                Command::AddNoob { talk_id, user_id } => {
                    let mut talks = talks.lock().await;

                    let talk = match talks.get_mut(&talk_id) {
                        Some(talk) => talk,
                        None => return Ok(()),
                    };

                    if !talk.noobs.contains(&user_id) {
                        talk.noobs.push(user_id);
                    }

                    write_to_file("talks.json", &talks.values().collect::<Vec<_>>())
                        .await
                        .wrap_err("failed to write talks.json")?;

                    let _ = updates_sender.send(Update::AddNoob { talk_id, user_id });
                }
                Command::RemoveNoob { talk_id, user_id } => {
                    let mut talks = talks.lock().await;

                    let talk = match talks.get_mut(&talk_id) {
                        Some(talk) => talk,
                        None => return Ok(()),
                    };

                    if let Some(index) = talk.noobs.iter().position(|&noob_id| noob_id == user_id) {
                        talk.noobs.remove(index);
                    }

                    write_to_file("talks.json", &talks.values().collect::<Vec<_>>())
                        .await
                        .wrap_err("failed to write talks.json")?;

                    let _ = updates_sender.send(Update::RemoveNoob { talk_id, user_id });
                }
                Command::AddNerd { talk_id, user_id } => {
                    let mut talks = talks.lock().await;

                    let talk = match talks.get_mut(&talk_id) {
                        Some(talk) => talk,
                        None => return Ok(()),
                    };

                    if !talk.nerds.contains(&user_id) {
                        talk.nerds.push(user_id);
                    }

                    write_to_file("talks.json", &talks.values().collect::<Vec<_>>())
                        .await
                        .wrap_err("failed to write talks.json")?;

                    let _ = updates_sender.send(Update::AddNerd { talk_id, user_id });
                }
                Command::RemoveNerd { talk_id, user_id } => {
                    let mut talks = talks.lock().await;

                    let talk = match talks.get_mut(&talk_id) {
                        Some(talk) => talk,
                        None => return Ok(()),
                    };

                    if let Some(index) = talk.nerds.iter().position(|&nerd_id| nerd_id == user_id) {
                        talk.nerds.remove(index);
                    }

                    write_to_file("talks.json", &talks.values().collect::<Vec<_>>())
                        .await
                        .wrap_err("failed to write talks.json")?;

                    let _ = updates_sender.send(Update::RemoveNerd { talk_id, user_id });
                }
            }
        }
        _ => {}
    }

    Ok(())
}

async fn handle_update(update: Update, stream: &mut WebSocket) -> eyre::Result<()> {
    stream
        .send(Message::Text(
            to_string(&update).wrap_err("failed to serialize update")?,
        ))
        .await
        .wrap_err("failed to send update")
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
}

#[derive(Clone, Debug, Serialize)]
enum AuthenticationResponse {
    AuthenticationSuccess {
        user_id: usize,
        roles: BTreeSet<Role>,
    },
    AuthenticationError {
        reason: String,
    },
}

#[derive(Clone, Debug, Deserialize)]
enum Command {
    AddTalk {
        title: String,
        description: String,
        duration: Duration,
    },
    RemoveTalk {
        talk_id: usize,
    },
    UpdateTitle {
        talk_id: usize,
        title: String,
    },
    UpdateDescription {
        talk_id: usize,
        description: String,
    },
    UpdateScheduledAt {
        talk_id: usize,
        scheduled_at: Option<SystemTime>,
    },
    UpdateDuration {
        talk_id: usize,
        duration: Duration,
    },
    AddNoob {
        talk_id: usize,
        user_id: usize,
    },
    RemoveNoob {
        talk_id: usize,
        user_id: usize,
    },
    AddNerd {
        talk_id: usize,
        user_id: usize,
    },
    RemoveNerd {
        talk_id: usize,
        user_id: usize,
    },
}

#[derive(Clone, Debug, Serialize)]
enum Update {
    Users {
        users: BTreeMap<usize, UserWithoutHash>,
    },
    AddTalk {
        talk: Talk,
    },
    RemoveTalk {
        talk_id: usize,
    },
    UpdateTitle {
        talk_id: usize,
        title: String,
    },
    UpdateDescription {
        talk_id: usize,
        description: String,
    },
    UpdateScheduledAt {
        talk_id: usize,
        scheduled_at: Option<SystemTime>,
    },
    UpdateDuration {
        talk_id: usize,
        duration: Duration,
    },
    AddNoob {
        talk_id: usize,
        user_id: usize,
    },
    RemoveNoob {
        talk_id: usize,
        user_id: usize,
    },
    AddNerd {
        talk_id: usize,
        user_id: usize,
    },
    RemoveNerd {
        talk_id: usize,
        user_id: usize,
    },
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
struct User {
    id: usize,
    name: String,
    team: String,
    hash: String,
    roles: BTreeSet<Role>,
}

impl User {
    fn new(id: usize, name: String, team: String, password: String, roles: BTreeSet<Role>) -> Self {
        let salt = SaltString::generate(&mut OsRng);
        let hash = Argon2::default()
            .hash_password(password.as_bytes(), &salt)
            .unwrap();

        Self {
            id,
            name,
            team,
            hash: hash.to_string(),
            roles,
        }
    }

    fn verify(&self, password: String) -> bool {
        let stored_hash = PasswordHash::new(&self.hash).unwrap();
        Argon2::default()
            .verify_password(password.as_bytes(), &stored_hash)
            .is_ok()
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
struct UserWithoutHash {
    id: usize,
    name: String,
    team: String,
}

impl From<&User> for UserWithoutHash {
    fn from(user: &User) -> Self {
        Self {
            id: user.id,
            name: user.name.clone(),
            team: user.team.clone(),
        }
    }
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, Serialize)]
enum Role {
    Editor,
    Scheduler,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Talk {
    id: usize,
    creator: usize,
    title: String,
    description: String,
    scheduled_at: Option<SystemTime>,
    duration: Duration,
    nerds: Vec<usize>,
    noobs: Vec<usize>,
}
