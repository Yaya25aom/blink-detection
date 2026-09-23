use chrono::{DateTime, Utc};
use reqwest::Client;
use serde::Serialize;
use std::time::Duration;

use crate::platform::get_frontmost_app;
use crate::local_bridge;

#[cfg(debug_assertions)]
const DEFAULT_API_BASE_URL: &str = "http://localhost:3000/api";

#[cfg(not(debug_assertions))]
const DEFAULT_API_BASE_URL: &str = "https://api.blinkcare.website/api";

#[derive(Debug, Serialize)]
struct CreateUsageRequest<'a> {
  session_id: &'a str,
  app_name: &'a str,
  started_at: String,
}

#[derive(Debug, Serialize)]
struct CloseUsageRequest<'a> {
  session_id: &'a str,
  ended_at: String,
}

#[derive(Debug, Default)]
struct TrackerState {
  current_session_id: Option<String>,
  tracking: bool,
  last_app: Option<String>,
  last_started_at: Option<DateTime<Utc>>,
}

impl TrackerState {
  fn reset_app(&mut self) {
    self.last_app = None;
    self.last_started_at = None;
  }
}

pub async fn run_tracker() {
  let api_base_url =
    std::env::var("BLINK_API_BASE_URL").unwrap_or_else(|_| DEFAULT_API_BASE_URL.to_string());
  let client = Client::new();
  let mut state = TrackerState::default();

  loop {
    if let Err(error) = tick(&client, &api_base_url, &mut state).await {
      eprintln!("helper tick error: {error}");
    }

    tokio::time::sleep(Duration::from_millis(250)).await;
  }
}

async fn tick(
  client: &Client,
  api_base_url: &str,
  state: &mut TrackerState,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
  let previous_session_id = state.current_session_id.clone();
  let previous_tracking = state.tracking;

  refresh_session(client, api_base_url, state).await?;

  if previous_session_id.is_some() && state.current_session_id.is_none() {
    state.reset_app();
    local_bridge::update(false, None);
    return Ok(());
  }

  if previous_session_id != state.current_session_id {
    state.reset_app();
    local_bridge::update(false, None);
  }

  if previous_tracking && !state.tracking {
    if let Some(session_id) = state.current_session_id.clone() {
      let command = local_bridge::tracking_command();
      let effective_api_base_url = command.api_base_url.as_deref().unwrap_or(api_base_url);
      close_current_app(client, effective_api_base_url, state, &session_id).await?;
    }

    state.reset_app();
    return Ok(());
  }

  sync_frontmost_app(client, api_base_url, state).await
}

async fn refresh_session(
  _client: &Client,
  _api_base_url: &str,
  state: &mut TrackerState,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
  let command = local_bridge::tracking_command();
  state.current_session_id = command.session_id;
  state.tracking = command.tracking;

  Ok(())
}

async fn sync_frontmost_app(
  client: &Client,
  api_base_url: &str,
  state: &mut TrackerState,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
  if !state.tracking {
    local_bridge::update(false, None);
    return Ok(());
  }

  let Some(session_id) = state.current_session_id.clone() else {
    return Ok(());
  };

  let command = local_bridge::tracking_command();
  let api_base_url = command.api_base_url.as_deref().unwrap_or(api_base_url);

  let Some(app_name) = get_frontmost_app() else {
    return Ok(());
  };

  if state.last_app.as_deref() == Some(app_name.as_str()) {
    local_bridge::update(true, Some(app_name));
    return Ok(());
  }

  if state.last_app.is_some() {
    close_current_app(client, api_base_url, state, &session_id).await?;
  }

  let now = Utc::now();
  save_current_app(client, api_base_url, &session_id, &app_name, now).await?;

  state.last_app = Some(app_name);
  state.last_started_at = Some(now);
  local_bridge::update(true, state.last_app.clone());

  Ok(())
}

async fn save_current_app(
  client: &Client,
  api_base_url: &str,
  session_id: &str,
  app_name: &str,
  started_at: DateTime<Utc>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
  let response = client
    .post(format!("{api_base_url}/app-usage"))
    .json(&CreateUsageRequest {
      session_id,
      app_name,
      started_at: started_at.to_rfc3339(),
    })
    .timeout(Duration::from_secs(2))
    .send()
    .await?;

  if !response.status().is_success() {
    eprintln!("save app failed: {}", response.text().await?);
  }

  Ok(())
}

async fn close_current_app(
  client: &Client,
  api_base_url: &str,
  state: &TrackerState,
  session_id: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
  if state.last_app.is_none() {
    return Ok(());
  }

  let response = client
    .post(format!("{api_base_url}/app-usage/update"))
    .json(&CloseUsageRequest {
      session_id,
      ended_at: Utc::now().to_rfc3339(),
    })
    .timeout(Duration::from_secs(2))
    .send()
    .await?;

  if !response.status().is_success() {
    eprintln!("close app failed: {}", response.text().await?);
  }

  Ok(())
}
