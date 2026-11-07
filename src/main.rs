use std::{net::SocketAddr, sync::Arc};

use axum::{
    extract::State,
    routing::{get, get_service},
    Json, Router,
};
use client::handle_websocket;
use eyre::{bail, WrapErr};
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

mod bindings;
mod client;
mod config;
mod file_watch;
mod ical;
mod mirrored_to_disk;
mod service;
mod storage;
mod wire;

const INTERNAL_CHANNEL_CAPACITY: usize = 1337;
const API_ENDPOINT: &str = "/api";
const TEAM_ENDPOINT: &str = "/teams.json";
const LOCATION_ENDPOINT: &str = "/locations.json";
const ICAL_ENDPOINT: &str = "/talks.ics";

#[tokio::main]
async fn main() -> eyre::Result<()> {
    tracing_subscriber::fmt().init();
    let Some(config) = std::env::args_os().nth(1) else {
        bail!("pass the config.toml as the only argument!");
    };
    eyre::ensure!(
        std::env::args_os().len() == 2,
        "pass only the config file path"
    );

    let config = config::Config::load(config)?;

    let storage = Storage::load(&config.storage)
        .await
        .wrap_err("failed to load storage")?;
    let (updates_sender, _updates_receiver) = broadcast::channel(INTERNAL_CHANNEL_CAPACITY);
    let service = Service {
        storage: Arc::new(RwLock::new(storage)),
        updates_sender,
        event: config.event.clone(),
    };

    spawn({
        let storage = service.storage.clone();
        let updates_sender = service.updates_sender.clone();
        refresh_files_from_disk_on_signal(storage, updates_sender)
    });

    let event = config.event;
    let application = Router::new()
        .route("/config.json", get(move || async move { Json(event) }))
        .route(API_ENDPOINT, get(handle_websocket))
        .route(
            TEAM_ENDPOINT,
            get(move |State(state): State<Service>| async move {
                Json(state.storage.read().await.teams.clone())
            }),
        )
        .route(
            LOCATION_ENDPOINT,
            get(move |State(state): State<Service>| async move {
                Json(state.storage.read().await.locations.clone())
            }),
        )
        .route(ICAL_ENDPOINT, get(handle_icalendar))
        .fallback(get_service(ServeDir::new(config.frontend)))
        .with_state(service);

    let bind_address = SocketAddr::new(config.address, config.port);

    info!("Listening on http://{bind_address}");
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
