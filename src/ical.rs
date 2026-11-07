use crate::{service::Service, storage::Storage};
use axum::{
    extract::{Query, State},
    http::{header::CONTENT_TYPE, StatusCode},
    response::IntoResponse,
};
use serde::Deserialize;
use std::{fmt::Write, time::UNIX_EPOCH};
use time::{format_description::parse_borrowed, OffsetDateTime};

#[derive(Deserialize)]
pub struct ICalendarParameters {
    user_id: Option<usize>,
}

pub async fn handle_icalendar(
    State(service): State<Service>,
    Query(parameters): Query<ICalendarParameters>,
) -> impl IntoResponse {
    match calendar(&*service.storage.read().await, parameters.user_id) {
        Ok(body) => (
            StatusCode::OK,
            [(CONTENT_TYPE, "text/calendar; charset=utf-8")],
            body,
        ),
        Err(error) => {
            tracing::error!("Could not export calendar: {error:#}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                [(CONTENT_TYPE, "text/plain; charset=utf-8")],
                "Could not export calendar. Check the server's stored talk dates.".into(),
            )
        }
    }
}

fn text(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace("\r\n", "\n")
        .replace('\r', "\n")
        .replace('\n', "\\n")
        .replace(';', "\\;")
        .replace(',', "\\,")
}

fn parameter(value: &str) -> String {
    format!(
        "\"{}\"",
        value
            .replace('^', "^^")
            .replace("\r\n", "\n")
            .replace('\r', "\n")
            .replace('\n', "^n")
            .replace('"', "^'")
    )
}

fn fold_lines(value: &str) -> String {
    let mut result = String::new();
    for mut line in value.split_terminator("\r\n") {
        let mut limit = 75;
        while line.len() > limit {
            let mut end = limit;
            while !line.is_char_boundary(end) {
                end -= 1;
            }
            result.push_str(&line[..end]);
            result.push_str("\r\n ");
            line = &line[end..];
            limit = 74;
        }
        result.push_str(line);
        result.push_str("\r\n");
    }
    result
}

fn calendar(storage: &Storage, user_id: Option<usize>) -> eyre::Result<String> {
    let mut response = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//HULKs//mopad//EN\r\nNAME:MOPAD\r\nX-WR-CALNAME:MOPAD\r\n".to_string();
    let format = parse_borrowed::<1>("[year][month][day]T[hour][minute][second]Z")?;
    let now = OffsetDateTime::now_utc().format(&format)?;
    for talk in storage.talks.values() {
        if user_id.is_some_and(|id| !talk.noobs.contains(&id) && !talk.nerds.contains(&id)) {
            continue;
        }
        let Some(at) = talk.scheduled_at else {
            continue;
        };
        let elapsed = at.duration_since(UNIX_EPOCH)?;
        let start = OffsetDateTime::from_unix_timestamp_nanos(elapsed.as_nanos().try_into()?)?;
        let end_nanos = elapsed
            .as_nanos()
            .checked_add(talk.duration.as_nanos())
            .ok_or_else(|| eyre::eyre!("talk end overflow"))?;
        let end = OffsetDateTime::from_unix_timestamp_nanos(end_nanos.try_into()?)?;
        write!(response, "BEGIN:VEVENT\r\nUID:{}\r\nDTSTAMP:{}\r\nDTSTART:{}\r\nDTEND:{}\r\nSUMMARY:{}\r\nDESCRIPTION:{}\r\n", talk.id, now, start.format(&format)?, end.format(&format)?, text(&talk.title), text(&talk.description))?;
        if let Some(room) = talk.location.and_then(|id| storage.locations.get(&id)) {
            write!(response, "LOCATION:{}\r\n", text(&room.name))?;
        }
        for (ids, role) in [(&talk.nerds, "CHAIR"), (&talk.noobs, "REQ-PARTICIPANT")] {
            for id in ids {
                if let Some(user) = storage.users.get(id) {
                    write!(
                        response,
                        "ATTENDEE;ROLE={role};PARTSTAT=ACCEPTED;CN={}:MAILTO:user{}@mopad\r\n",
                        parameter(&format!("{} ({})", user.name, user.team)),
                        user.id
                    )?;
                }
            }
        }
        response.push_str("END:VEVENT\r\n");
    }
    response.push_str("END:VCALENDAR\r\n");
    Ok(fold_lines(&response))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn escapes_and_folds_calendar_values_without_splitting_utf8() {
        assert_eq!(text("a,b;c\\d\r\nnext"), "a\\,b\\;c\\\\d\\nnext");
        assert_eq!(parameter("a;\"b\"\n^"), "\"a;^'b^'^n^^\"");
        let line = format!("DESCRIPTION:{}\r\n", "é".repeat(100));
        let folded = fold_lines(&line);
        assert!(folded.split_terminator("\r\n").all(|line| line.len() <= 75));
        assert_eq!(folded.replace("\r\n ", ""), line);
    }

    #[tokio::test]
    async fn damaged_references_and_extreme_dates_do_not_panic() {
        let path = std::env::temp_dir().join(format!(
            "mopad-calendar-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let mut storage = Storage::load(&path).await.unwrap();
        let talk = serde_json::from_str(r#"{"id":1,"creator":0,"title":"Talk","description":"","scheduled_at":{"secs_since_epoch":1000,"nanos_since_epoch":0},"duration":{"secs":1800,"nanos":0},"location":999,"nerds":[123],"noobs":[456]}"#).unwrap();
        storage.talks.insert(1, talk);
        assert!(calendar(&storage, None).unwrap().contains("SUMMARY:Talk"));
        storage.talks.get_mut(&1).unwrap().duration = std::time::Duration::MAX;
        assert!(calendar(&storage, None).is_err());
        storage.talks.get_mut(&1).unwrap().scheduled_at =
            UNIX_EPOCH.checked_add(std::time::Duration::from_secs(i64::MAX as u64));
        assert!(calendar(&storage, None).is_err());
        tokio::fs::remove_dir_all(path).await.unwrap();
    }
}
