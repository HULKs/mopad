use std::{
    collections::{BTreeMap, BTreeSet},
    fmt::Debug,
    path::Path,
    sync::Arc,
    time::{Duration, SystemTime},
};

use argon2::{password_hash::SaltString, Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use eyre::{ContextCompat, WrapErr};
use futures_util::{SinkExt, StreamExt};
use rand_core::OsRng;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::{from_str, to_string};
use tokio::{
    fs::{read_to_string, File},
    io::AsyncWriteExt,
    net::{TcpListener, TcpStream},
    select, spawn,
    sync::{broadcast, mpsc, Mutex},
};
use tokio_tungstenite::{
    accept_async,
    tungstenite::{Message, Result},
    WebSocketStream,
};

#[tokio::main]
async fn main() -> eyre::Result<()> {
    let teams: Arc<BTreeSet<String>> = Arc::new(
        read_from_file("teams.json")
            .await
            .wrap_err("failed to read teams.json")?,
    );
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

    let listener = TcpListener::bind("0.0.0.0:1337")
        .await
        .wrap_err("failed to bind")?;

    let (updates_sender, _updates_receiver) = broadcast::channel(1337);
    loop {
        let (stream, _) = listener.accept().await.wrap_err("failed to accept")?;

        spawn(connection(
            stream,
            teams.clone(),
            users.clone(),
            talks.clone(),
            updates_sender.clone(),
        ));
    }
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

async fn connection(
    stream: TcpStream,
    teams: Arc<BTreeSet<String>>,
    users: Arc<Mutex<BTreeMap<usize, User>>>,
    talks: Arc<Mutex<BTreeMap<usize, Talk>>>,
    updates_sender: broadcast::Sender<Update>,
) -> eyre::Result<()> {
    let mut websocket_stream = accept_async(stream)
        .await
        .wrap_err("failed to shake hands")?;

    websocket_stream
        .send(Message::Text(
            to_string(&Update::Teams {
                teams: (*teams).clone(),
            })
            .wrap_err("failed to serialize teams update")?,
        ))
        .await
        .wrap_err("failed to update teams")?;

    let mut updates_receiver = updates_sender.subscribe();
    let (responses_sender, mut responses_receiver) = mpsc::channel(1337);
    let mut current_user = None;
    loop {
        select! {
            command_message = websocket_stream.next() => {
                if let None = command_message {
                    break;
                }
                handle_message(command_message.unwrap(), &teams, &users, &talks, &updates_sender, &responses_sender, &mut current_user)
                    .await
                    .wrap_err("failed to handle command message")?;
            }
            update = updates_receiver.recv() => {
                let update = update.wrap_err("failed to receive update")?;
                handle_update(update, &mut websocket_stream)
                    .await
                    .wrap_err("failed to handle update")?;
            }
            response = responses_receiver.recv() => {
                let response = response.wrap_err("failed to receive response")?;
                handle_response(response, &mut websocket_stream)
                    .await
                    .wrap_err("failed to handle response")?;
            }
        }
    }

    Ok(())
}

async fn handle_message(
    command_message: Result<Message>,
    teams: &Arc<BTreeSet<String>>,
    users: &Arc<Mutex<BTreeMap<usize, User>>>,
    talks: &Arc<Mutex<BTreeMap<usize, Talk>>>,
    updates_sender: &broadcast::Sender<Update>,
    responses_sender: &mpsc::Sender<Response>,
    current_user: &mut Option<UserWithoutHash>,
) -> eyre::Result<()> {
    let command_message = command_message.wrap_err("failed to receive command")?;

    match command_message {
        Message::Text(message) => {
            let command: Command =
                from_str(&message).wrap_err("failed to deserialize command message")?;

            match command {
                Command::Register {
                    name,
                    team,
                    password,
                } => {
                    if !teams.contains(&team) {
                        let _ = responses_sender
                            .send(Response::RegisterError {
                                reason: "unknown team".to_string(),
                            })
                            .await;
                        return Ok(());
                    }

                    let mut users = users.lock().await;

                    if users
                        .values()
                        .any(|user| user.name == name && user.team == team)
                    {
                        let _ = responses_sender
                            .send(Response::RegisterError {
                                reason: "already registered".to_string(),
                            })
                            .await;
                        return Ok(());
                    }

                    let next_user_id = users.keys().copied().max().unwrap_or_default() + 1;

                    users.insert(next_user_id, User::new(next_user_id, name, team, password));

                    write_to_file("users.json", &users.values().collect::<Vec<_>>())
                        .await
                        .wrap_err("failed to write users.json")?;

                    let _ = updates_sender.send(Update::Users {
                        users: users
                            .iter()
                            .map(|(user_id, user)| (*user_id, user.into()))
                            .collect(),
                    });
                    let _ = responses_sender
                        .send(Response::RegisterSuccess {
                            talks: talks.lock().await.clone(),
                        })
                        .await;
                    *current_user = Some((&users[&next_user_id]).into());
                }
                Command::Login {
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
                            let _ = responses_sender
                                .send(Response::LoginSuccess {
                                    users: users
                                        .iter()
                                        .map(|(user_id, user)| (*user_id, user.into()))
                                        .collect(),
                                    talks: talks.lock().await.clone(),
                                })
                                .await;
                            *current_user = Some(user.into());
                        } else {
                            let _ = responses_sender
                                .send(Response::LoginError {
                                    reason: "wrong password".to_string(),
                                })
                                .await;
                        }
                    } else {
                        let _ = responses_sender
                            .send(Response::LoginError {
                                reason: "unknown user".to_string(),
                            })
                            .await;
                    }
                }
                Command::AddTalk {
                    title,
                    description,
                    duration,
                } => {
                    let mut talks = talks.lock().await;

                    let next_talk_id = talks.keys().copied().max().unwrap_or_default() + 1;

                    let talk = Talk {
                        id: next_talk_id,
                        title,
                        description,
                        scheduled_at: None,
                        duration,
                        nerds: vec![],
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

                    talks.remove(&talk_id);

                    write_to_file("talks.json", &talks.values().collect::<Vec<_>>())
                        .await
                        .wrap_err("failed to write talks.json")?;

                    let _ = updates_sender.send(Update::RemoveTalk { talk_id });
                }
                Command::UpdateTitle { talk_id, title } => {
                    let mut talks = talks.lock().await;

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
                Command::UpdateDuration { talk_id, duration } => {
                    let mut talks = talks.lock().await;

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

                    if let Some(index) = talk.noobs.iter().find(|&&noob_id| noob_id == user_id) {
                        talk.noobs.remove(*index);
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

                    if let Some(index) = talk.nerds.iter().find(|&&nerd_id| nerd_id == user_id) {
                        talk.nerds.remove(*index);
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

async fn handle_update(
    update: Update,
    stream: &mut WebSocketStream<TcpStream>,
) -> eyre::Result<()> {
    stream
        .send(Message::Text(
            to_string(&update).wrap_err("failed to serialize update")?,
        ))
        .await
        .wrap_err("failed to send update")
}

async fn handle_response(
    response: Response,
    stream: &mut WebSocketStream<TcpStream>,
) -> eyre::Result<()> {
    stream
        .send(Message::Text(
            to_string(&response).wrap_err("failed to serialize response")?,
        ))
        .await
        .wrap_err("failed to send response")
}

#[derive(Clone, Debug, Deserialize)]
enum Command {
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
    Teams {
        teams: BTreeSet<String>,
    },
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
enum Response {
    RegisterSuccess {
        talks: BTreeMap<usize, Talk>,
    },
    RegisterError {
        reason: String,
    },
    LoginSuccess {
        users: BTreeMap<usize, UserWithoutHash>,
        talks: BTreeMap<usize, Talk>,
    },
    LoginError {
        reason: String,
    },
}

#[derive(Clone, Debug, Deserialize, Serialize)]
struct User {
    id: usize,
    name: String,
    team: String,
    hash: String,
}

impl User {
    fn new(id: usize, name: String, team: String, password: String) -> Self {
        let salt = SaltString::generate(&mut OsRng);
        let hash = Argon2::default()
            .hash_password(password.as_bytes(), &salt)
            .unwrap();

        Self {
            id,
            name,
            team,
            hash: hash.to_string(),
        }
    }

    fn verify(&self, password: String) -> bool {
        let stored_hash = PasswordHash::new(&self.hash).unwrap();
        Argon2::default()
            .verify_password(password.as_bytes(), &stored_hash)
            .is_ok()
    }
}

#[derive(Clone, Debug, Serialize)]
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

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Talk {
    id: usize,
    title: String,
    description: String,
    scheduled_at: Option<SystemTime>,
    duration: Duration,
    nerds: Vec<usize>,
    noobs: Vec<usize>,
}