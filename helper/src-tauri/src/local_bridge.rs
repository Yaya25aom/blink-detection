use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{OnceLock, RwLock};

const BRIDGE_ADDRESS: &str = "127.0.0.1:17321";

#[derive(Clone, Default, Serialize)]
struct BridgeStatus {
  connected: bool,
  tracking: bool,
  active_app: Option<String>,
}

#[derive(Clone, Default)]
pub struct TrackingCommand {
  pub session_id: Option<String>,
  pub api_base_url: Option<String>,
  pub tracking: bool,
}

#[derive(Deserialize)]
struct StartTrackingRequest {
  session_id: String,
  api_base_url: String,
}

static STATUS: OnceLock<RwLock<BridgeStatus>> = OnceLock::new();
static COMMAND: OnceLock<RwLock<TrackingCommand>> = OnceLock::new();

fn status() -> &'static RwLock<BridgeStatus> {
  STATUS.get_or_init(|| RwLock::new(BridgeStatus::default()))
}

fn command() -> &'static RwLock<TrackingCommand> {
  COMMAND.get_or_init(|| RwLock::new(TrackingCommand::default()))
}

pub fn tracking_command() -> TrackingCommand {
  command().read().map(|value| value.clone()).unwrap_or_default()
}

pub fn update(tracking: bool, active_app: Option<String>) {
  if let Ok(mut current) = status().write() {
    current.connected = true;
    current.tracking = tracking;
    current.active_app = active_app;
  }
}

fn respond(mut stream: TcpStream) {
  let mut request = [0_u8; 2048];
  let size = stream.read(&mut request).unwrap_or(0);
  let request = String::from_utf8_lossy(&request[..size]);
  let is_options = request.starts_with("OPTIONS ");
  let is_status = request.starts_with("GET /status ");
  let is_start = request.starts_with("POST /session ");
  let is_stop = request.starts_with("POST /session/stop ");
  let is_pause = request.starts_with("POST /session/pause ");
  let is_resume = request.starts_with("POST /session/resume ");

  let (status_line, body) = if is_options {
    ("HTTP/1.1 204 No Content", String::new())
  } else if is_status {
    let snapshot = status().read().map(|value| value.clone()).unwrap_or_default();
    ("HTTP/1.1 200 OK", serde_json::to_string(&snapshot).unwrap_or_else(|_| "{}".into()))
  } else if is_start {
    let payload = request.split("\r\n\r\n").nth(1).unwrap_or("");
    match serde_json::from_str::<StartTrackingRequest>(payload) {
      Ok(payload)
        if !payload.session_id.is_empty()
          && matches!(
            payload.api_base_url.as_str(),
            "http://localhost:3000/api" | "https://api.blinkcare.website/api"
          ) => {
        if let Ok(mut current) = command().write() {
          current.session_id = Some(payload.session_id);
          current.api_base_url = Some(payload.api_base_url);
          current.tracking = true;
        }
        ("HTTP/1.1 200 OK", "{\"success\":true}".into())
      }
      _ => ("HTTP/1.1 400 Bad Request", "{\"success\":false}".into()),
    }
  } else if is_stop || is_pause {
    if let Ok(mut current) = command().write() {
      current.tracking = false;
    }
    ("HTTP/1.1 200 OK", "{\"success\":true}".into())
  } else if is_resume {
    if let Ok(mut current) = command().write() {
      current.tracking = current.session_id.is_some();
    }
    ("HTTP/1.1 200 OK", "{\"success\":true}".into())
  } else {
    ("HTTP/1.1 404 Not Found", "{\"error\":\"Not found\"}".into())
  };

  let response = format!(
    "{status_line}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Private-Network: true\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\nConnection: close\r\n\r\n{body}",
    body.len(),
  );
  let _ = stream.write_all(response.as_bytes());
}

pub fn run() {
  let listener = match TcpListener::bind(BRIDGE_ADDRESS) {
    Ok(listener) => listener,
    Err(error) => {
      eprintln!("local extension bridge could not bind {BRIDGE_ADDRESS}: {error}");
      return;
    }
  };

  for stream in listener.incoming() {
    match stream {
      Ok(stream) => respond(stream),
      Err(error) => eprintln!("local extension bridge error: {error}"),
    }
  }
}
