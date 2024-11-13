use std::{collections::BTreeSet, net::SocketAddr, str::FromStr, sync::Arc};

use axum::{
    routing::{get, get_service},
    Json, Router, Server,
};
use client::handle_websocket;
use eyre::WrapErr;
use file_watch::refresh_files_from_disk_on_signal;
use ical::handle_icalendar;
use storage::Storage;
use tokio::{
    spawn,
    sync::{broadcast, Mutex},
};
use tower_http::services::ServeDir;

mod authentication;
mod client;
mod file_watch;
mod ical;
mod messages;
mod storage;

#[tokio::main]
async fn main() -> eyre::Result<()> {
    let path = ".";
    let storage = Arc::new(Mutex::new(
        Storage::load(path)
            .await
            .wrap_err("failed to load storage")?,
    ));

    let (updates_sender, _updates_receiver) = broadcast::channel(1337);
    let application = Router::new()
        .route(
            "/api",
            get({
                let storage = storage.clone();
                let updates_sender = updates_sender.clone();
                move |upgrade| handle_websocket(upgrade, storage, updates_sender)
            }),
        )
        .route(
            "/teams.json",
            get({
                let storage = storage.clone();
                move || handle_teams(storage)
            }),
        )
        .route(
            "/talks.ics",
            get({
                let storage = storage.clone();
                move |parameters| handle_icalendar(parameters, storage)
            }),
        )
        .fallback(get_service(ServeDir::new("./frontend")));

    spawn({
        let storage = storage.clone();
        let updates_sender = updates_sender.clone();
        refresh_files_from_disk_on_signal(storage, updates_sender)
    });

    Server::bind(&SocketAddr::from_str("[::]:1337").unwrap())
        .serve(application.into_make_service())
        .await
        .wrap_err("failed to server")
}

async fn handle_teams(storage: Arc<Mutex<Storage>>) -> Json<BTreeSet<String>> {
    Json(storage.lock().await.teams.clone())
}
