use std::sync::Arc;

use async_trait::async_trait;
use sqlx::{query, query_as, Error, Pool, Sqlite};

#[async_trait]
pub trait RoleRepository {
    async fn get_roles_by_id(&self, user_id: i64) -> Result<Vec<Role>, Error>;
    async fn clear(&self) -> Result<(), Error>;
    async fn import(&self, roles: Vec<UserRole>) -> Result<(), Error>;
}

pub struct UserRole {
    pub user: i64,
    pub role: Role,
}

pub enum Role {
    Editor,
    Scheduler,
}

pub struct SqliteRoleRepository {
    pool: Arc<Pool<Sqlite>>,
}

impl SqliteRoleRepository {
    pub fn new(pool: Arc<Pool<Sqlite>>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl RoleRepository for SqliteRoleRepository {
    async fn get_roles_by_id(&self, user_id: i64) -> Result<Vec<Role>, Error> {
        let roles = query_as("SELECT role FROM roles WHERE user = ?")
            .bind(user_id)
            .fetch_all(self.pool.as_ref())
            .await?;
        roles
            .into_iter()
            .map(|(role,)| match role {
                0 => Ok(Role::Editor),
                1 => Ok(Role::Scheduler),
                _ => Err(Error::Decode(format!("unknown role {role}").into())),
            })
            .collect()
    }

    async fn clear(&self) -> Result<(), Error> {
        query("DELETE FROM roles")
            .execute(self.pool.as_ref())
            .await
            .map(|_| ())
    }

    async fn import(&self, roles: Vec<UserRole>) -> Result<(), Error> {
        for role in roles {
            query("INSERT INTO roles (user, role) VALUES (?, ?)")
                .bind(role.user)
                .bind(match role.role {
                    Role::Editor => 0,
                    Role::Scheduler => 1,
                })
                .execute(self.pool.as_ref())
                .await
                .map(|_| ())?;
        }

        Ok(())
    }
}
