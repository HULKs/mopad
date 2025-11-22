use std::fmt::Write;

use axum::{
    extract::{Query, State},
    http::{header::CONTENT_TYPE, StatusCode},
    response::IntoResponse,
};
use serde::Deserialize;
use time::{format_description::parse, OffsetDateTime};

use crate::service::Service;

#[derive(Deserialize)]
pub struct ICalendarParameters {
    user_id: Option<usize>,
}

pub async fn handle_icalendar(
    State(service): State<Service>,
    parameters: Query<ICalendarParameters>,
) -> impl IntoResponse {
    let mut response = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//HULKs//mopad//EN\r\nNAME:MOPAD\r\nX-WR-CALNAME:MOPAD\r\nX-WR-CALDESC:Moderated Organization PAD (powerful, agile, distributed)\r\n".to_string();
    let format = parse("[year][month][day]T[hour][minute][second]Z").unwrap();
    let now = OffsetDateTime::now_utc();
    let storage = service.storage.read().await;
    for talk in storage.talks.values() {
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
                talk.title.replace(['\r', '\n'], ""),
                talk.description.replace(['\r', '\n'], ""),
            )
            .unwrap();
            if let Some(location_id) = &talk.location {
                let location = storage.locations.get(location_id).unwrap();
                write!(
                    response,
                    "LOCATION:{}\r\n",
                    location.name.replace(['\r', ';'], "")
                )
                .unwrap();
            }
            for nerd in talk.nerds.iter() {
                if let Some(user) = storage.users.get(nerd) {
                    write!(
                        response,
                        "ATTENDEE;ROLE=CHAIR;PARTSTAT=ACCEPTED;CN={} ({}):MAILTO:user{}@mopad\r\n",
                        user.name.replace([';', '\r', '\n'], ""),
                        user.team.replace([';', '\r', '\n'], ""),
                        user.id,
                    )
                    .unwrap();
                }
            }
            for noob in talk.noobs.iter() {
                let user = storage.users.get(noob).unwrap();
                write!(
                    response,
                    "ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN={} ({}):MAILTO:user{}@mopad\r\n",
                    user.name.replace([';', '\r', '\n'], ""),
                    user.team.replace([';', '\r', '\n'], ""),
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
