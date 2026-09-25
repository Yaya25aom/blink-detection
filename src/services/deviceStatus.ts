export type DeviceStatus = {
  installed: boolean;
  connected: boolean;
  helperConnected: boolean;
  monitoring: boolean;
  activeApp: string | null;
  version: string | null;
};

export const emptyDeviceStatus: DeviceStatus = {
  installed: false,
  connected: false,
  helperConnected: false,
  monitoring: false,
  activeApp: null,
  version: null,
};

export const requestDeviceStatus = (timeoutMs = 1_500) =>
  new Promise<DeviceStatus>((resolve) => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<Partial<DeviceStatus>>).detail ?? {};
      window.clearTimeout(timeout);
      window.removeEventListener("blinkcare:device-status-response", receive);
      resolve({
        installed: detail.installed === true,
        connected: detail.connected === true,
        helperConnected: detail.helperConnected === true,
        monitoring: detail.monitoring === true,
        activeApp: typeof detail.activeApp === "string" ? detail.activeApp : null,
        version: typeof detail.version === "string" ? detail.version : null,
      });
    };

    const timeout = window.setTimeout(() => {
      window.removeEventListener("blinkcare:device-status-response", receive);
      resolve(emptyDeviceStatus);
    }, timeoutMs);

    window.addEventListener("blinkcare:device-status-response", receive);
    window.dispatchEvent(new Event("blinkcare:device-status-request"));
  });
