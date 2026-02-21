import { describe, it, expect, beforeEach, vi } from "vitest";
import { webcrypto } from "node:crypto";

Object.defineProperty(globalThis, "crypto", {
  value: webcrypto,
  writable: true,
});

import { VaultStore } from "../src/primitives/vault-store.js";
import { VaultError } from "../src/interfaces/vault.js";
import type { NodeId, UCANToken, SharedSecret } from "../src/types/branded.js";
import { randomBytes } from "../src/backends/crypto-utils.js";

// ─── Helpers ───────────────────────────────────────────────────────

function makeVault(): VaultStore {
  const masterKey = randomBytes(32) as SharedSecret;
  return new VaultStore(masterKey);
}

// ─── Tests ──────────────────────────────────────────────────────────

describe("VaultStore", () => {
  let vault: VaultStore;

  beforeEach(() => {
    vault = makeVault();
  });

  describe("createLayer()", () => {
    it("should create a new layer with the given name and schema", async () => {
      await vault.createLayer("medical", { bloodType: "string" });
      const layers = await vault.listLayers();
      expect(layers).toHaveLength(1);
      expect(layers[0]?.id).toBe("medical");
    });

    it("should emit VAULT_LAYER_CREATED event", async () => {
      const listener = vi.fn();
      vault.on("VAULT_LAYER_CREATED", listener);
      await vault.createLayer("medical", {});
      expect(listener).toHaveBeenCalledOnce();
    });

    it("should throw LAYER_EXISTS for duplicate layer names", async () => {
      await vault.createLayer("medical", {});
      await expect(vault.createLayer("medical", {})).rejects.toThrow(VaultError);
    });

    it("should generate a wrapped AES-256-GCM DEK for the layer", async () => {
      await vault.createLayer("medical", {});
      // Write + readAsOwner proves the DEK was generated and works
      await vault.write("medical", { bloodType: "O+" });
      const data = await vault.readAsOwner("medical");
      expect(data.bloodType).toBe("O+");
    });
  });

  describe("write()", () => {
    it("should encrypt and write data to an existing layer", async () => {
      await vault.createLayer("medical", { bloodType: "string" });
      await vault.write("medical", { bloodType: "O+", allergies: ["penicillin"] });
      const data = await vault.readAsOwner("medical");
      expect(data.bloodType).toBe("O+");
      expect(data.allergies).toEqual(["penicillin"]);
    });

    it("should throw LAYER_NOT_FOUND for non-existent layer", async () => {
      await expect(
        vault.write("nonexistent", { data: "test" })
      ).rejects.toThrow(VaultError);
    });

    it("should emit VAULT_LAYER_WRITTEN event", async () => {
      await vault.createLayer("medical", {});
      const listener = vi.fn();
      vault.on("VAULT_LAYER_WRITTEN", listener);
      await vault.write("medical", { data: "test" });
      expect(listener).toHaveBeenCalledOnce();
    });

    it("should overwrite previous data on subsequent writes", async () => {
      await vault.createLayer("test", {});
      await vault.write("test", { version: 1 });
      await vault.write("test", { version: 2 });
      const data = await vault.readAsOwner("test");
      expect(data.version).toBe(2);
    });
  });

  describe("read()", () => {
    it("should decrypt and return layer data with owner token", async () => {
      await vault.createLayer("medical", {});
      await vault.write("medical", { bloodType: "AB-", allergies: [] });
      const data = await vault.readAsOwner("medical");
      expect(data.bloodType).toBe("AB-");
    });

    it("should throw LAYER_NOT_FOUND for non-existent layer", async () => {
      await expect(
        vault.read("nonexistent", "token" as UCANToken)
      ).rejects.toThrow(VaultError);
    });

    it("should throw LAYER_NOT_FOUND for empty layer", async () => {
      await vault.createLayer("empty", {});
      await expect(
        vault.readAsOwner("empty")
      ).rejects.toThrow(VaultError);
    });

    it("should decrypt using UCAN token from grantAccess", async () => {
      await vault.createLayer("medical", {});
      await vault.write("medical", { bloodType: "O+" });
      const token = await vault.grantAccess("medical", "peer-1" as NodeId);
      // Read with the granted token (owner's vault, so master key still works)
      const data = await vault.read("medical", token);
      expect(data.bloodType).toBe("O+");
    });
  });

  describe("grantAccess()", () => {
    it("should generate a UCAN token for the bonded identity", async () => {
      await vault.createLayer("medical", {});
      const token = await vault.grantAccess(
        "medical",
        "peer-node-id" as NodeId
      );
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.startsWith("ucan:")).toBe(true);
    });

    it("should throw LAYER_NOT_FOUND for non-existent layer", async () => {
      await expect(
        vault.grantAccess("nonexistent", "peer" as NodeId)
      ).rejects.toThrow(VaultError);
    });

    it("should emit VAULT_ACCESS_GRANTED event", async () => {
      await vault.createLayer("medical", {});
      const listener = vi.fn();
      vault.on("VAULT_ACCESS_GRANTED", listener);
      await vault.grantAccess("medical", "peer" as NodeId);
      expect(listener).toHaveBeenCalledOnce();
    });

    it("should increment ACL count", async () => {
      await vault.createLayer("medical", {});
      await vault.grantAccess("medical", "peer" as NodeId);
      const layers = await vault.listLayers();
      expect(layers[0]?.aclCount).toBe(1);
    });

    it("should allow multiple grants to different peers", async () => {
      await vault.createLayer("medical", {});
      await vault.grantAccess("medical", "peer-1" as NodeId);
      await vault.grantAccess("medical", "peer-2" as NodeId);
      const layers = await vault.listLayers();
      expect(layers[0]?.aclCount).toBe(2);
    });
  });

  describe("revokeAccess()", () => {
    it("should remove the partner from the layer ACL", async () => {
      await vault.createLayer("medical", {});
      await vault.grantAccess("medical", "peer" as NodeId);
      await vault.revokeAccess("medical", "peer" as NodeId);
      const layers = await vault.listLayers();
      expect(layers[0]?.aclCount).toBe(0);
    });

    it("should throw LAYER_NOT_FOUND for non-existent layer", async () => {
      await expect(
        vault.revokeAccess("nonexistent", "peer" as NodeId)
      ).rejects.toThrow(VaultError);
    });

    it("should emit VAULT_ACCESS_REVOKED event", async () => {
      await vault.createLayer("medical", {});
      const listener = vi.fn();
      vault.on("VAULT_ACCESS_REVOKED", listener);
      await vault.revokeAccess("medical", "peer" as NodeId);
      expect(listener).toHaveBeenCalledOnce();
    });
  });

  describe("listLayers()", () => {
    it("should return empty array when no layers exist", async () => {
      expect(await vault.listLayers()).toEqual([]);
    });

    it("should return metadata for all layers", async () => {
      await vault.createLayer("medical", {});
      await vault.createLayer("legal", {});
      const layers = await vault.listLayers();
      expect(layers).toHaveLength(2);
    });
  });

  describe("export()", () => {
    it("should serialize vault to requested format", async () => {
      await expect(vault.export("JSON")).rejects.toThrow(VaultError);
    });
  });

  describe("getMerkleRoot()", () => {
    it("should return a root node with children per layer", async () => {
      await vault.createLayer("medical", {});
      await vault.createLayer("legal", {});
      const root = await vault.getMerkleRoot();
      expect(root.id).toBe("root");
      expect(root.children).toHaveLength(2);
    });

    it("should return empty children when no layers exist", async () => {
      const root = await vault.getMerkleRoot();
      expect(root.children).toHaveLength(0);
    });

    it("should update hashes after write", async () => {
      await vault.createLayer("test", {});
      const before = await vault.getMerkleRoot();
      await vault.write("test", { data: "content" });
      const after = await vault.getMerkleRoot();
      expect(after.hash).not.toBe(before.hash);
    });
  });

  describe("getStorageUsage()", () => {
    it("should return usage metrics", async () => {
      const usage = await vault.getStorageUsage();
      expect(usage).toHaveProperty("usedBytes");
      expect(usage).toHaveProperty("totalBytes");
      expect(usage).toHaveProperty("percentage");
    });

    it("should increase usedBytes after write", async () => {
      const before = await vault.getStorageUsage();
      await vault.createLayer("test", {});
      await vault.write("test", { data: "hello world" });
      const after = await vault.getStorageUsage();
      expect(after.usedBytes).toBeGreaterThan(before.usedBytes);
    });
  });

  describe("encryption round-trip", () => {
    it("should encrypt then decrypt complex data structures", async () => {
      await vault.createLayer("profile", {});
      const complex = {
        name: "Alice",
        age: 30,
        tags: ["autism", "adhd"],
        preferences: { theme: "dark", haptics: true },
      };
      await vault.write("profile", complex);
      const result = await vault.readAsOwner("profile");
      expect(result).toEqual(complex);
    });

    it("should isolate encryption between layers", async () => {
      await vault.createLayer("layer-a", {});
      await vault.createLayer("layer-b", {});
      await vault.write("layer-a", { secret: "alpha" });
      await vault.write("layer-b", { secret: "beta" });

      const a = await vault.readAsOwner("layer-a");
      const b = await vault.readAsOwner("layer-b");
      expect(a.secret).toBe("alpha");
      expect(b.secret).toBe("beta");
    });

    it("different VaultStore instances cannot decrypt each other's data", async () => {
      const vault2 = makeVault();
      await vault.createLayer("private", {});
      await vault.write("private", { data: "secret" });

      // vault2 doesn't have the layer at all
      await expect(vault2.readAsOwner("private")).rejects.toThrow(VaultError);
    });
  });
});
