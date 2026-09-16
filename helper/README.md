# Blink Helper

Small Tauri desktop helper that replaces `src/app_tracker.py`.

The helper runs in the background, checks the active detection session from the
backend, detects the foreground app on macOS/Windows, and sends app usage events
to the existing API.

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

By default the helper sends requests to:

```text
http://localhost:3000/api
```

For a deployed backend, run with:

```bash
BLINK_API_BASE_URL=https://your-api.example.com/api npm run dev
```

## API Used

- `GET /api/app-usage/session`
- `POST /api/app-usage`
- `POST /api/app-usage/update`

## Notes

This first version keeps the same backend contract as the Python helper. Before
shipping to multiple cloud users, change the backend session lookup from a
global in-memory `currentSessionId` to a per-user helper token or pairing-code
flow.
