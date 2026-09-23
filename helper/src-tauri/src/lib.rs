mod local_bridge;
mod platform;
mod tracker;

use tauri::tray::TrayIconBuilder;
use tauri::Manager;
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      app.handle().plugin(tauri_plugin_autostart::init(
        MacosLauncher::LaunchAgent,
        None,
      ))?;
      let _ = app.autolaunch().enable();

      let _tray = TrayIconBuilder::new()
        .tooltip("Blink Helper")
        .build(app)?;

      if let Some(window) = app.get_webview_window("main") {
        let window_to_hide = window.clone();
        window.on_window_event(move |event| {
          if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = window_to_hide.hide();
          }
        });
      }

      std::thread::spawn(local_bridge::run);
      tauri::async_runtime::spawn(tracker::run_tracker());

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("failed to run Blink Helper");
}
