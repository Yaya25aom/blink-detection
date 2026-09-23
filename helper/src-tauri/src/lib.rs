mod local_bridge;
mod platform;
mod tracker;

use tauri::tray::TrayIconBuilder;

pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      let _tray = TrayIconBuilder::new()
        .tooltip("Blink Helper")
        .build(app)?;

      std::thread::spawn(local_bridge::run);
      tauri::async_runtime::spawn(tracker::run_tracker());

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("failed to run Blink Helper");
}
