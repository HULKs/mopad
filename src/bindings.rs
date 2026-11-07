//! Serde's standard-library time representations, which ts-rs does not implement.
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Deserialize, Serialize, TS)]
pub struct Duration {
    secs: u64,
    nanos: u32,
}

#[derive(Deserialize, Serialize, TS)]
pub struct SystemTime {
    secs_since_epoch: u64,
    nanos_since_epoch: u32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn time_bindings_match_serde() {
        let duration = std::time::Duration::new(123, 456);
        let value = serde_json::to_value(duration).unwrap();
        let binding: Duration = serde_json::from_value(value.clone()).unwrap();
        assert_eq!(serde_json::to_value(binding).unwrap(), value);
        let value = serde_json::to_value(std::time::UNIX_EPOCH + duration).unwrap();
        let binding: SystemTime = serde_json::from_value(value.clone()).unwrap();
        assert_eq!(serde_json::to_value(binding).unwrap(), value);
    }
}
