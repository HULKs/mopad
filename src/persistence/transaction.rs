use std::sync::Arc;

use async_trait::async_trait;
use sqlx::{Error, Pool, Sqlite, Transaction as SqlxTransaction};

#[async_trait]
pub trait Transaction<'transaction> {
    type TransactionGuard;

    async fn lock(&'transaction self) -> Result<Self::TransactionGuard, Error>;
}

pub struct ProductionTransaction {
    pool: Arc<Pool<Sqlite>>,
}

impl ProductionTransaction {
    pub fn new(pool: Arc<Pool<Sqlite>>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl<'transaction> Transaction<'transaction> for ProductionTransaction {
    type TransactionGuard = ProductionTransactionGuard<'transaction>;

    async fn lock(&'transaction self) -> Result<Self::TransactionGuard, Error> {
        Ok(Self::TransactionGuard {
            transaction: self.pool.begin().await?,
        })
    }
}

pub struct ProductionTransactionGuard<'transaction> {
    transaction: SqlxTransaction<'transaction, Sqlite>,
}

impl<'transaction> ProductionTransactionGuard<'transaction> {
    pub async fn commit(self) -> Result<(), Error> {
        self.transaction.commit().await
    }
}
