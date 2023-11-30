mod talks_ws;
mod teams_json;

use std::{
    path::Path,
    sync::Arc,
    task::{Context, Poll},
};

use axum::{routing::get, serve::IncomingStream, Router};
use tower_http::services::ServeDir;
use tower_service::Service;

use crate::application::{
    authentication::AuthenticationService, calendar::CalendarService, talks::TalksService,
    teams::TeamsService,
};
use talks_ws::talks_ws;
use teams_json::teams_json;

pub struct ProductionController {
    router: Router,
}

impl ProductionController {
    pub fn new(
        frontend: impl AsRef<Path>,
        authentication_service: impl AuthenticationService + Send + Sync + 'static,
        calendar_service: impl CalendarService + Send + Sync + 'static,
        talks_service: impl TalksService + Send + Sync + 'static,
        teams_service: impl TeamsService + Send + Sync + 'static,
    ) -> Self {
        Self {
            router: Router::new()
                .route("/talks.ws", get(talks_ws))
                // .route("/talks.ics", get(Self::talks_ics))
                .route("/teams.json", get(teams_json))
                .with_state(Arc::new(Services {
                    authentication: authentication_service,
                    calendar: calendar_service,
                    talks: talks_service,
                    teams: teams_service,
                }))
                .fallback_service(ServeDir::new(frontend)),
        }
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

pub struct Services<Authentication, Calendar, Talks, Teams> {
    authentication: Authentication,
    calendar: Calendar,
    talks: Talks,
    teams: Teams,
}
