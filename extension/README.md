# BlinkCare Chrome Extension

## Build

```bash
npm install
npm run build
```

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select the generated `extension/dist` directory.
5. Click the BlinkCare toolbar icon to start or stop monitoring.

The badge displays `ON` while monitoring. Camera frames stay on the device and
are used only by the offscreen detection document.

## Production

The extension syncs the signed-in account from either
`https://blink-detection-two.vercel.app` or `https://blinkcare.website`, then
uses `https://api.blinkcare.website/api` for detection sessions, blink records,
plans, and notification events. Blink Helper remains local at
`http://127.0.0.1:17321` so the active desktop application never passes through
a public bridge.
