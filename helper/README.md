# Blink Helper

Small Tauri desktop helper that replaces `src/app_tracker.py`.

The helper runs in the background, checks the active detection session from the
backend, detects the foreground app on macOS/Windows, and sends app usage events
to the existing API.

It also exposes the current foreground application to the BlinkCare Chrome
Extension at `http://127.0.0.1:17321/status`. The bridge only returns the helper
status and application name; it does not expose blink measurements.

## Requirements

- Node.js
- Rust and Cargo
- Tauri system dependencies for your OS

## Development

```bash
cd helper
npm install
npm run dev
```

In development (`npm run dev`), the helper sends requests to:

```text
http://localhost:3000/api
```

Release builds use `https://api.blinkcare.website/api`. To override either
environment, run with:

```bash
BLINK_API_BASE_URL=https://your-api.example.com/api npm run dev
```

## API Used

- `GET /api/app-usage/session`
- `POST /api/app-usage`
- `POST /api/app-usage/update`

## Chrome Extension Bridge

Open Blink Helper once after installation. It registers itself to start with the
operating system and remains in the system tray when its window is closed. The
extension sends its own detection session to the local-only bridge, so app usage
is attached to the signed-in account instead of a global backend session.

## Notes

This first version keeps the same backend contract as the Python helper. Before
shipping to multiple cloud users, change the backend session lookup from a
global in-memory `currentSessionId` to a per-user helper token or pairing-code
flow.
