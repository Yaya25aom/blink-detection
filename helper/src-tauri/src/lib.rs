mod platform;
mod tracker;

use tauri::tray::TrayIconBuilder;

pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      let _tray = TrayIconBuilder::new()
        .tooltip("Blink Helper")
        .build(app)?;

      tauri::async_runtime::spawn(tracker::run_tracker());

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("failed to run Blink Helper");
}
