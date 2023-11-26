pub mod concrete;

use async_trait::async_trait;
use sqlx::Error;

#[async_trait]
pub trait TeamsService {
    async fn get_teams(&self) -> Result<Vec<String>, Error>;
}
