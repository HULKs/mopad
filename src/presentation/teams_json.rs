use std::sync::Arc;

use axum::{extract::State, response::IntoResponse, Json};

use crate::application::{
    authentication::AuthenticationService, calendar::CalendarService, talks::TalksService,
    teams::TeamsService,
};

use super::Services;

pub async fn teams_json(
    State(services): State<
        Arc<
            Services<
                impl AuthenticationService,
                impl CalendarService,
                impl TalksService,
                impl TeamsService,
            >,
        >,
    >,
) -> impl IntoResponse {
    services
        .teams
        .get_teams()
        .await
        .map(|teams| Json(teams))
        .map_err(|error| error.to_string())
}
