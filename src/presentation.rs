use std::{
    path::Path,
    sync::Arc,
    task::{Context, Poll},
};

use axum::{
    extract::State, response::IntoResponse, routing::get, serve::IncomingStream, Json, Router,
};
use tower_http::services::ServeDir;
use tower_service::Service;

use crate::application::teams::TeamsService;

pub struct ProductionController {
    router: Router,
}

impl ProductionController {
    pub fn new(
        frontend: impl AsRef<Path>,
        teams_service: impl TeamsService + Send + Sync + 'static,
    ) -> Self {
        Self {
            router: Router::new()
                // .route("/talks.ws", get(Self::talks_ws))
                // .route("/talks.ics", get(Self::talks_ics))
                .route("/teams.json", get(Self::teams_json))
                .with_state(Arc::new(teams_service))
                .fallback_service(ServeDir::new(frontend)),
        }
    }

    // fn talks_ws() {}

    // fn talks_ics(
    //     parameters: Query<ICalendarParameters>,
    //     users: Arc<Mutex<BTreeMap<usize, User>>>,
    //     talks: Arc<Mutex<BTreeMap<usize, Talk>>>,
    // ) -> impl IntoResponse {}

    async fn teams_json(State(teams_service): State<Arc<impl TeamsService>>) -> impl IntoResponse {
        teams_service
            .get_teams()
            .await
            .map(|teams| Json(teams))
            .map_err(|error| error.to_string())
    }
}

impl<'stream> Service<IncomingStream<'stream>> for ProductionController {
    type Response = <Router as Service<IncomingStream<'stream>>>::Response;
    type Error = <Router as Service<IncomingStream<'stream>>>::Error;
    type Future = <Router as Service<IncomingStream<'stream>>>::Future;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        <Router as Service<IncomingStream<'stream>>>::poll_ready(&mut self.router, cx)
    }

    fn call(&mut self, req: IncomingStream<'stream>) -> Self::Future {
        self.router.call(req)
    }
}
