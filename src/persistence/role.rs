use async_trait::async_trait;
use sqlx::Error;

#[async_trait]
pub trait RoleRepository {
    async fn get_roles_by_id(&self, user_id: i64) -> Result<Option<Vec<Role>>, Error>;
}

pub enum Role {
    Editor,
    Scheduler,
}
