use std::{net::SocketAddr, path::PathBuf, str::FromStr, sync::Arc};

use axum::{
    extract::State,
    routing::{get, get_service},
    Json, Router, Server,
};
use clap::Parser;
use client::handle_websocket;
use eyre::WrapErr;
use file_watch::refresh_files_from_disk_on_signal;
use ical::handle_icalendar;
use messages::Update;
use storage::Storage;
use tokio::{
    spawn,
    sync::{broadcast, RwLock},
};
use tower_http::services::ServeDir;
use tracing::info;

mod authentication;
mod client;
mod file_watch;
mod ical;
mod messages;
mod storage;

const INTERNAL_CHANNEL_CAPACITY: usize = 1337;
const API_ENDPOINT: &str = "/api";
const TEAM_ENDPOINT: &str = "/teams.json";
const ICAL_ENDPOINT: &str = "/talks.ics";

/// Moderated Organization PAD (powerful, agile, distributed)
///
/// Web application for managing talks (title, description, duration, scheduling).
#[derive(Debug, Parser)]
#[command(version)]
struct Arguments {
    /// Path to the storage directory.
    #[clap(long, default_value = ".")]
    storage: PathBuf,
    /// Port to listen on.
    #[clap(long, default_value = "80")]
    port: u16,
    /// Address to listen on.
    #[clap(long, default_value = "[::]")]
    address: String,
    /// Path to the frontend directory.
    #[clap(long, default_value = "./frontend")]
    frontend: String,
}

#[derive(Debug, Clone)]
struct AppState {
    storage: Arc<RwLock<Storage>>,
    updates_sender: broadcast::Sender<Update>,
}

#[tokio::main]
async fn main() -> eyre::Result<()> {
    let arguments = Arguments::parse();
    tracing_subscriber::fmt().init();

    let storage = Storage::load(&arguments.storage)
        .await
        .wrap_err("failed to load storage")?;
    let (updates_sender, _updates_receiver) = broadcast::channel(INTERNAL_CHANNEL_CAPACITY);
    let state = AppState {
        storage: Arc::new(RwLock::new(storage)),
        updates_sender,
    };

    spawn({
        let storage = state.storage.clone();
        let updates_sender = state.updates_sender.clone();
        refresh_files_from_disk_on_signal(storage, updates_sender)
    });

    let application = Router::new()
        .route(API_ENDPOINT, get(handle_websocket))
        .route(
            TEAM_ENDPOINT,
            get(move |State(state): State<AppState>| async move {
                Json(state.storage.read().await.teams.clone())
            }),
        )
        .route(ICAL_ENDPOINT, get(handle_icalendar))
        .fallback(get_service(ServeDir::new(arguments.frontend)))
        .with_state(state);

    let address = format!("{}:{}", arguments.address, arguments.port);
    let bind_address = SocketAddr::from_str(&address)
        .wrap_err_with(|| format!("failed to parse address: {address}"))?;

    info!("Listening on http://{address}");
    Server::bind(&bind_address)
        .serve(application.into_make_service())
        .await
        .wrap_err("failed to serve application")
}
