use async_trait::async_trait;
use sqlx::Error;

use crate::persistence::TeamRepository;

#[async_trait]
pub trait TeamsService {
    async fn get_teams(&self) -> Result<Vec<String>, Error>;
}

pub struct ConcreteTeamsService<Repository> {
    repository: Repository,
}

impl<Repository: TeamRepository> ConcreteTeamsService<Repository> {
    pub fn new(repository: Repository) -> Self {
        Self { repository }
    }
}

#[async_trait]
impl<Repository: TeamRepository + Send + Sync> TeamsService for ConcreteTeamsService<Repository> {
    async fn get_teams(&self) -> Result<Vec<String>, Error> {
        self.repository
            .get_all()
            .await
            .map(|teams| teams.into_iter().map(|team| team.name).collect())
    }
}
