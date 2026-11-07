use std::{env, fs, path::PathBuf};
use ts_rs::TS;

#[allow(dead_code)]
#[path = "src/bindings.rs"]
mod bindings;
#[allow(dead_code)]
#[path = "src/wire.rs"]
mod wire;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    for path in [
        "build.rs",
        "src/wire.rs",
        "src/bindings.rs",
        "frontend/src/generated",
    ] {
        println!("cargo:rerun-if-changed={path}");
    }
    let output = PathBuf::from(env::var_os("OUT_DIR").unwrap()).join("bindings");
    let config = ts_rs::Config::default()
        .with_large_int("number")
        .with_out_dir(&output);
    wire::AuthenticationCommand::export_all(&config)?;
    wire::AuthenticationResponse::export_all(&config)?;
    wire::CommandRequest::export_all(&config)?;
    wire::Update::export_all(&config)?;
    wire::Location::export_all(&config)?;
    wire::EventConfig::export_all(&config)?;

    let destination =
        PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").unwrap()).join("frontend/src/generated");
    fs::create_dir_all(&destination)?;
    for entry in fs::read_dir(output)? {
        let entry = entry?;
        let contents = fs::read(entry.path())?;
        let path = destination.join(entry.file_name());
        // Keep unchanged files untouched so builds do not trigger Vite or each other.
        if fs::read(&path).ok().as_deref() != Some(contents.as_slice()) {
            fs::write(path, contents)?;
        }
    }
    Ok(())
}
