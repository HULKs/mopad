use std::{fmt::Write, sync::Arc};

use axum::{
    extract::{Query, State},
    http::{header::CONTENT_TYPE, StatusCode},
    response::IntoResponse,
};
use serde::Deserialize;
use time::{format_description::parse, OffsetDateTime};

use crate::application::{
    authentication::AuthenticationService, calendar::CalendarService, talks::TalksService,
    teams::TeamsService,
};

use super::Services;

pub async fn talks_ics(
    parameters: Query<ICalendarParameters>,
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
    let mut response = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//HULKs//mopad//EN\r\nNAME:MOPAD\r\nX-WR-CALNAME:MOPAD\r\nX-WR-CALDESC:Moderated Organization PAD (powerful, agile, distributed)\r\n".to_string();
    let format = parse("[year][month][day]T[hour][minute][second]Z").unwrap();
    let now = OffsetDateTime::now_utc();

    let talks = match services.calendar.get_talks(parameters.user_id).await {
        Ok(talks) => talks,
        Err(error) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                [(CONTENT_TYPE, "text/plain; charset=utf-8")],
                error.to_string(),
            )
        }
    };

    for talk in talks {
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
            if let Some(location) = &talk.location {
                write!(
                    response,
                    "LOCATION:{}\r\n",
                    location.replace('\r', "").replace(';', "")
                )
                .unwrap();
            }
            for nerd in talk.nerds {
                write!(
                    response,
                    "ATTENDEE;ROLE=CHAIR;PARTSTAT=ACCEPTED;CN={} ({}):MAILTO:user{}@mopad\r\n",
                    nerd.name
                        .replace(';', "")
                        .replace('\r', "")
                        .replace('\n', ""),
                    nerd.team
                        .replace(';', "")
                        .replace('\r', "")
                        .replace('\n', ""),
                    nerd.id,
                )
                .unwrap();
            }
            for noob in talk.noobs {
                write!(
                    response,
                    "ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN={} ({}):MAILTO:user{}@mopad\r\n",
                    noob.name.replace(';', "").replace('\r', "").replace('\n', ""),
                    noob.team.replace(';', "").replace('\r', "").replace('\n', ""),
                    noob.id,
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

#[derive(Deserialize)]
pub struct ICalendarParameters {
    user_id: Option<i64>,
}
