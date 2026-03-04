/**
 * serial.ts — Node One hardware interface stub
 * In production, wraps Web Serial API for ESP32-S3 communication.
 * Stub provides the API surface DeepLockOverlay.tsx expects.
 */

const NodeOne = {
  isConnected: false,

  async requestTotemAuth(prompt: string): Promise<boolean> {
    // In production: send prompt to ESP32, wait for physical button press (Thick Click)
    console.log('[NodeOne] Totem auth requested:', prompt);
    return false;
  },

  async connect(): Promise<boolean> {
    if (!('serial' in navigator)) return false;
    console.log('[NodeOne] Serial connection requested');
    return false;
  },

  async sendHaptic(pattern: string): Promise<void> {
    console.log('[NodeOne] Haptic:', pattern);
  },

  async sendDisplay(text: string): Promise<void> {
    console.log('[NodeOne] Display:', text);
  },
};

export default NodeOne;
