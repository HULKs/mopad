mod application;
mod persistence;

use std::sync::Arc;

use sqlx::SqlitePool;

#[tokio::main]
async fn main() {
    println!("Yo");
    let _pool = Arc::new(
        SqlitePool::connect("sqlite:persistence.sqlite3")
            .await
            .unwrap(),
    );
}
