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
