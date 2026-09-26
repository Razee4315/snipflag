fn main() {
    println!("cargo:rerun-if-env-changed=SNIPFLAG_LINEAR_CLIENT_ID");
    if let Ok(id) = std::env::var("SNIPFLAG_LINEAR_CLIENT_ID") {
        let id = id.trim();
        assert!(id.len() <= 200 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'), "Invalid public Linear client ID configuration");
    }
    tauri_build::build()
}
