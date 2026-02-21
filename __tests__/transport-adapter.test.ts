import { describe, it, expect, beforeEach, vi } from "vitest";
import { TransportAdapter } from "../src/primitives/transport-adapter.js";
import { TransportError } from "../src/interfaces/transport.js";

describe("TransportAdapter", () => {
  let transport: TransportAdapter;

  beforeEach(() => {
    transport = new TransportAdapter();
  });

  describe("transmit()", () => {
    it("should throw MEDIUM_UNAVAILABLE when no medium configured", async () => {
      await expect(transport.transmit(new Uint8Array(10))).rejects.toThrow(
        TransportError
      );
    });

    it("should transmit data within MTU without fragmentation", async () => {
      await transport.configure({ medium: "WEBSOCKET", mtu: 65535 });
      // TODO: Mock actual WebSocket transmission
    });

    it("should fragment data exceeding MTU using SCHC", async () => {
      await transport.configure({ medium: "LORA_SUB_GHZ", mtu: 252 });
      const largeData = new Uint8Array(500);
      await expect(transport.transmit(largeData)).rejects.toThrow(
        TransportError
      );
    });

    it("should emit TRANSMIT_COMPLETE on success", async () => {
      // TODO
    });

    it("should respect LoRa duty-cycle limits", async () => {
      // TODO
    });
  });

  describe("onReceive()", () => {
    it("should return an unsubscribe function", () => {
      const unsub = transport.onReceive(() => {});
      expect(typeof unsub).toBe("function");
    });

    it("should deliver reassembled data to listeners", async () => {
      // TODO
    });
  });

  describe("discover()", () => {
    it("should throw MEDIUM_UNAVAILABLE when no medium configured", async () => {
      await expect(transport.discover()).rejects.toThrow(TransportError);
    });

    it("should emit PEER_DISCOVERED events", async () => {
      // TODO
    });
  });

  describe("onPeerDiscovered()", () => {
    it("should return an unsubscribe function", () => {
      const unsub = transport.onPeerDiscovered(() => {});
      expect(typeof unsub).toBe("function");
    });
  });

  describe("configure()", () => {
    it("should set the active medium", async () => {
      await transport.configure({ medium: "BLE", mtu: 247 });
      expect(transport.getActiveMedium()).toBe("BLE");
    });

    it("should set the MTU for the medium", async () => {
      await transport.configure({ medium: "LORA_SUB_GHZ", mtu: 252 });
      expect(transport.getMTU()).toBe(252);
    });
  });

  describe("getMTU()", () => {
    it("should return 0 when no medium configured", () => {
      expect(transport.getMTU()).toBe(0);
    });
  });

  describe("canTransmit()", () => {
    it("should return false when no medium configured", () => {
      expect(transport.canTransmit(100)).toBe(false);
    });

    it("should return true for payloads within fragment capacity", async () => {
      await transport.configure({ medium: "LORA_SUB_GHZ", mtu: 252 });
      expect(transport.canTransmit(100)).toBe(true);
    });
  });

  describe("getActiveMedium()", () => {
    it("should return null when no medium configured", () => {
      expect(transport.getActiveMedium()).toBeNull();
    });
  });

  describe("getDiscoveredPeers()", () => {
    it("should return empty array initially", () => {
      expect(transport.getDiscoveredPeers()).toEqual([]);
    });
  });
});
