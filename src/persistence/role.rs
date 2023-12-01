use std::sync::Arc;

use async_trait::async_trait;
use sqlx::{query, query_as, Error, Pool, Sqlite};

#[async_trait]
pub trait RoleRepository {
    async fn provision(&self) -> Result<(), Error>;
    async fn get_roles_by_id(&self, user_id: i64) -> Result<Vec<Role>, Error>;
    async fn get_all(&self) -> Result<Vec<UserRole>, Error>;
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
    async fn provision(&self) -> Result<(), Error> {
        query("DROP TABLE IF EXISTS roles")
            .execute(self.pool.as_ref())
            .await?;
        query(
            "CREATE TABLE roles (
                user INTEGER REFERENCES users(id) NOT NULL,
                role INTEGER NOT NULL
            )",
        )
        .execute(self.pool.as_ref())
        .await?;
        Ok(())
    }

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

    async fn get_all(&self) -> Result<Vec<UserRole>, Error> {
        query_as("SELECT user, role FROM roles")
            .fetch_all(self.pool.as_ref())
            .await
            .and_then(|roles| {
                roles
                    .into_iter()
                    .map(|(user, role)| {
                        Ok(UserRole {
                            user,
                            role: match role {
                                0 => Role::Editor,
                                1 => Role::Scheduler,
                                _ => {
                                    return Err(Error::Decode(
                                        format!("unknown role {role}").into(),
                                    ))
                                }
                            },
                        })
                    })
                    .collect()
            })
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
