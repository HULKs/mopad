use std::{
    net::IpAddr,
    path::{Path, PathBuf},
};

use eyre::{ensure, Context, Result};
use serde::Deserialize;
use time::{format_description::well_known::Rfc3339, OffsetDateTime};

use crate::wire::EventConfig;

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Config {
    pub address: IpAddr,
    pub port: u16,
    pub storage: PathBuf,
    pub frontend: PathBuf,
    pub event: EventConfig,
}

impl Config {
    pub fn load(path: impl AsRef<Path>) -> Result<Self> {
        let path = path.as_ref();
        let contents = std::fs::read_to_string(path).wrap_err("failed to read config")?;
        let mut config = Self::parse(&contents)?;
        let directory = path.parent().unwrap_or(Path::new("."));
        config.storage = directory.join(config.storage);
        config.frontend = directory.join(config.frontend);
        Ok(config)
    }

    fn parse(contents: &str) -> Result<Self> {
        let config: Self = toml::from_str(contents).wrap_err("invalid config.toml")?;
        ensure!(config.port > 0, "port must be between 1 and 65535");
        ensure!(
            !config.storage.as_os_str().is_empty(),
            "storage path is empty"
        );
        ensure!(
            !config.frontend.as_os_str().is_empty(),
            "frontend path is empty"
        );
        config.event.validate()?;
        Ok(config)
    }
}

fn range(name: &str, start: &str, end: &str) -> Result<(OffsetDateTime, OffsetDateTime)> {
    let parse = |value: &str| -> Result<OffsetDateTime> {
        ensure!(
            value.ends_with('Z'),
            "{name} must use UTC timestamps ending in Z"
        );
        let date = OffsetDateTime::parse(value, &Rfc3339)
            .wrap_err_with(|| format!("invalid {name} timestamp: {value}"))?;
        ensure!(
            date.unix_timestamp() >= 0,
            "{name} must be after the Unix epoch"
        );
        Ok(date)
    };
    let start = parse(start)?;
    let end = parse(end)?;
    ensure!(start < end, "{name} start must be before end");
    Ok((start, end))
}

impl EventConfig {
    fn validate(&self) -> Result<()> {
        let (start, end) = range("event", &self.start, &self.end)?;
        for (name, from, to) in self
            .opening_hours
            .iter()
            .map(|r| ("opening hours", r.start.as_str(), r.end.as_str()))
            .chain(
                self.breaks
                    .iter()
                    .map(|b| (b.label.as_str(), b.start.as_str(), b.end.as_str())),
            )
        {
            let (from, to) = range(name, from, to)?;
            ensure!(
                from >= start && to <= end,
                "{name} must be inside the event range"
            );
        }
        ensure!(
            self.breaks.iter().all(|b| !b.label.trim().is_empty()),
            "break labels must not be empty"
        );
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const VALID: &str = r#"
address = "0.0.0.0"
port = 9559
storage = "storage"
frontend = "frontend/dist"
[event]
start = "2026-11-20T08:00:00Z"
end = "2026-11-22T18:00:00Z"
[[event.opening_hours]]
start = "2026-11-20T08:00:00Z"
end = "2026-11-20T18:00:00Z"
[[event.breaks]]
label = "Lunch"
start = "2026-11-20T12:00:00Z"
end = "2026-11-20T13:00:00Z"
"#;

    #[test]
    fn parses_complete_config_and_exposes_only_event_settings() {
        let config = Config::parse(VALID).unwrap();
        assert_eq!(config.port, 9559);
        let public = serde_json::to_value(config.event).unwrap();
        assert!(public.get("storage").is_none());
        assert!(public.get("address").is_none());
        assert_eq!(public["breaks"][0]["label"], "Lunch");
        assert!(Config::parse(include_str!("../config.toml.example")).is_ok());
    }

    #[test]
    fn resolves_paths_relative_to_the_config_file() {
        let root = Path::new(env!("CARGO_MANIFEST_DIR"));
        let expected = Config::parse(include_str!("../config.toml.example")).unwrap();
        let config = Config::load(root.join("config.toml.example")).unwrap();
        assert_eq!(config.storage, root.join(expected.storage));
        assert_eq!(config.frontend, root.join(expected.frontend));
        assert!(Config::load(root.join("missing-config.toml")).is_err());
    }

    #[test]
    fn validates_launch_options_and_utc_intervals() {
        let example = VALID;
        for invalid in [
            example.replace("port = 9559", "port = 0"),
            example.replace("port = 9559", "port = 65536"),
            example.replace("address = \"0.0.0.0\"", "address = \"invalid\""),
            example.replace("2026-11-20T08:00:00Z", "not-a-dateZ"),
            example.replace("2026-11-20T08:00:00Z", "2026-11-20T08:00:00+01:00"),
            example.replace("2026-11-22T18:00:00Z", "2026-11-19T18:00:00Z"),
            example.replace("2026-11-20T13:00:00Z", "2026-11-23T13:00:00Z"),
            example.replace("label = \"Lunch\"", "label = \"\""),
            example.replace("storage = \"storage\"", "storage = \"\""),
            format!("{example}\nunknown = true"),
        ] {
            assert!(Config::parse(&invalid).is_err(), "accepted {invalid}");
        }
    }

    #[test]
    fn opening_hours_and_breaks_are_optional() {
        let event: EventConfig =
            toml::from_str("start = \"2026-11-20T08:00:00Z\"\nend = \"2026-11-22T18:00:00Z\"")
                .unwrap();
        assert!(event.validate().is_ok());
        assert!(event.opening_hours.is_empty());
        assert!(event.breaks.is_empty());
    }
}
