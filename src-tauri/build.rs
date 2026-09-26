fn main() {
    println!("cargo:rerun-if-env-changed=SNIPFLAG_LINEAR_CLIENT_ID");
    if let Ok(id) = std::env::var("SNIPFLAG_LINEAR_CLIENT_ID") {
        let id = id.trim();
        assert!(id.len() <= 200 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'), "Invalid public Linear client ID configuration");
    }
    println!("cargo:rerun-if-env-changed=SNIPFLAG_UPDATER_PUBKEY");
    if let Ok(key) = std::env::var("SNIPFLAG_UPDATER_PUBKEY") {
        let key = key.trim();
        assert!(key.len() <= 2000 && key.chars().all(|c| c.is_ascii_alphanumeric() || "+/=".contains(c)), "Invalid updater public key configuration");
    }
    tauri_build::build()
}
