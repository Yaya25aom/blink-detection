use serde::Serialize;
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

static STATUS: OnceLock<RwLock<BridgeStatus>> = OnceLock::new();

fn status() -> &'static RwLock<BridgeStatus> {
  STATUS.get_or_init(|| RwLock::new(BridgeStatus::default()))
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

  let (status_line, body) = if is_options {
    ("HTTP/1.1 204 No Content", String::new())
  } else if is_status {
    let snapshot = status().read().map(|value| value.clone()).unwrap_or_default();
    ("HTTP/1.1 200 OK", serde_json::to_string(&snapshot).unwrap_or_else(|_| "{}".into()))
  } else {
    ("HTTP/1.1 404 Not Found", "{\"error\":\"Not found\"}".into())
  };

  let response = format!(
    "{status_line}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Private-Network: true\r\nAccess-Control-Allow-Methods: GET, OPTIONS\r\nConnection: close\r\n\r\n{body}",
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
