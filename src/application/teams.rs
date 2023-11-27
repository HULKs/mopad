use async_trait::async_trait;
use sqlx::Error;

use crate::persistence::team::TeamRepository;

#[async_trait]
pub trait TeamsService {
    async fn get_teams(&self) -> Result<Vec<String>, Error>;
}

pub struct ProductionTeamsService<TeamRepo> {
    team_repository: TeamRepo,
}

impl<TeamRepo: TeamRepository> ProductionTeamsService<TeamRepo> {
    pub fn new(team_repository: TeamRepo) -> Self {
        Self { team_repository }
    }
}

#[async_trait]
impl<TeamRepo: TeamRepository + Send + Sync> TeamsService for ProductionTeamsService<TeamRepo> {
    async fn get_teams(&self) -> Result<Vec<String>, Error> {
        self.team_repository.get_all().await
    }
}
