use std::{net::SocketAddr, path::PathBuf, str::FromStr, sync::Arc};

use axum::{
    extract::State,
    routing::{get, get_service},
    Json, Router,
};
use clap::Parser;
use client::handle_websocket;
use eyre::WrapErr;
use file_watch::refresh_files_from_disk_on_signal;
use ical::handle_icalendar;
use storage::Storage;
use tokio::{
    signal, spawn,
    sync::{broadcast, RwLock},
};
use tower_http::services::ServeDir;
use tracing::info;

use crate::service::Service;

mod client;
mod file_watch;
mod ical;
mod messages;
mod mirrored_to_disk;
mod service;
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
    #[clap(long, default_value = "storage/")]
    storage: PathBuf,
    /// Port to listen on.
    #[clap(long, default_value = "9559")]
    port: u16,
    /// Address to listen on.
    #[clap(long, default_value = "[::]")]
    address: String,
    /// Path to the frontend directory.
    #[clap(long, default_value = "frontend/")]
    frontend: String,
}

#[tokio::main]
async fn main() -> eyre::Result<()> {
    let arguments = Arguments::parse();
    tracing_subscriber::fmt().init();

    let storage = Storage::load(&arguments.storage)
        .await
        .wrap_err("failed to load storage")?;
    let (updates_sender, _updates_receiver) = broadcast::channel(INTERNAL_CHANNEL_CAPACITY);
    let service = Service {
        storage: Arc::new(RwLock::new(storage)),
        updates_sender,
    };

    spawn({
        let storage = service.storage.clone();
        let updates_sender = service.updates_sender.clone();
        refresh_files_from_disk_on_signal(storage, updates_sender)
    });

    let application = Router::new()
        .route(API_ENDPOINT, get(handle_websocket))
        .route(
            TEAM_ENDPOINT,
            get(move |State(state): State<Service>| async move {
                Json(state.storage.read().await.teams.clone())
            }),
        )
        .route(ICAL_ENDPOINT, get(handle_icalendar))
        .fallback(get_service(ServeDir::new(arguments.frontend)))
        .with_state(service);

    let address = format!("{}:{}", arguments.address, arguments.port);
    let bind_address = SocketAddr::from_str(&address)
        .wrap_err_with(|| format!("failed to parse address: {address}"))?;

    info!("Listening on http://{address}");
    let listener = tokio::net::TcpListener::bind(bind_address)
        .await
        .wrap_err("failed to bind to address")?;
    axum::serve(listener, application.into_make_service())
        .with_graceful_shutdown(shutdown_signal())
        .await
        .wrap_err("failed to serve application")
}

async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}
