import { useState } from "react";
import { useJitterbugCompiler } from "../hooks/useJitterbugCompiler";
import { moduleRegistry } from "../lib/jitterbugCompiler";
import { deleteCartridge } from "../lib/cartridgeStore";

const MAX_SLOTS = 9;

const STATUS_COLOR: Record<string, string> = {
  idle:      "var(--skin-muted)",
  loading:   "var(--skin-secondary)",
  ready:     "var(--skin-primary)",
  compiling: "var(--skin-secondary)",
  error:     "#ef4444",
};

const EXAMPLE_JSX = `function App() {
  const [count, setCount] = React.useState(0);
  return (
    <div style={{ padding: 32, fontFamily: "monospace", color: "var(--skin-primary)" }}>
      <div style={{ fontSize: 24, marginBottom: 16 }}>⚛️ Hello, Cartridge</div>
      <button
        onClick={() => setCount(c => c + 1)}
        style={{ padding: "8px 20px", background: "transparent",
          border: "1px solid var(--skin-primary)", color: "var(--skin-primary)",
          borderRadius: 6, cursor: "pointer", fontSize: 14 }}
      >
        Clicks: {count}
      </button>
    </div>
  );
}`;

export function MakerStub() {
  const jb = useJitterbugCompiler();
  const [source, setSource] = useState(EXAMPLE_JSX);
  const [slotIndex, setSlotIndex] = useState(0);
  const [cartName, setCartName] = useState("untitled");
  const [activeSlot, setActiveSlot] = useState<number | null>(null);

  const handleCompile = () => {
    if (jb.status !== "ready") return;
    const ok = jb.compileAndMount(source, slotIndex, cartName);
    if (ok) {
      jb.persist({
        id: `slot_${slotIndex}_${Date.now()}`,
        name: cartName,
        intent: cartName,
        sourceCode: source,
        compiledCode: source,
        manifest: null,
        slot: slotIndex,
      });
      setActiveSlot(slotIndex);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteCartridge(id);
    await jb.refreshCartridges();
  };

  const SlotComponent = activeSlot !== null ? moduleRegistry.get(`SLOT_${activeSlot}`) : null;

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--skin-bg)",
      color: "var(--skin-fg)",
      fontFamily: "'DM Mono', monospace",
      padding: "40px 24px",
      boxSizing: "border-box",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--skin-muted)", letterSpacing: 4, marginBottom: 4 }}>
            CARTRIDGE DRIVE
          </div>
          <div style={{ fontSize: 18, color: "var(--skin-primary)" }}>
            Module Maker
          </div>
        </div>
        <div style={{
          fontSize: 10,
          color: STATUS_COLOR[jb.status] ?? "var(--skin-muted)",
          letterSpacing: 2,
          border: `1px solid ${STATUS_COLOR[jb.status] ?? "var(--skin-border)"}`,
          padding: "4px 10px",
          borderRadius: 4,
        }}>
          {jb.status.toUpperCase()}
          {jb.error && ` — ${jb.error.slice(0, 40)}`}
        </div>
      </div>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        {/* Editor column */}
        <div style={{ flex: "1 1 380px", minWidth: 320 }}>
          {/* Slot + Name row */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <select
              title="Target slot"
              value={slotIndex}
              onChange={e => setSlotIndex(Number(e.target.value))}
              style={{
                background: "var(--skin-surface)",
                border: "1px solid var(--skin-border)",
                color: "var(--skin-fg)",
                borderRadius: 6,
                padding: "6px 10px",
                fontFamily: "inherit",
                fontSize: 12,
              }}
            >
              {Array.from({ length: MAX_SLOTS }, (_, i) => (
                <option key={i} value={i}>SLOT_{i}</option>
              ))}
            </select>
            <input
              type="text"
              value={cartName}
              onChange={e => setCartName(e.target.value)}
              placeholder="cartridge name"
              style={{
                flex: 1,
                background: "var(--skin-surface)",
                border: "1px solid var(--skin-border)",
                color: "var(--skin-fg)",
                borderRadius: 6,
                padding: "6px 10px",
                fontFamily: "inherit",
                fontSize: 12,
              }}
            />
          </div>

          {/* Code editor */}
          <textarea
            aria-label="JSX source code"
            value={source}
            onChange={e => setSource(e.target.value)}
            rows={18}
            spellCheck={false}
            style={{
              width: "100%",
              background: "var(--skin-surface)",
              border: "1px solid var(--skin-border)",
              color: "var(--skin-primary)",
              borderRadius: 8,
              padding: 16,
              fontFamily: "'DM Mono', monospace",
              fontSize: 12,
              lineHeight: 1.6,
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />

          <button
            type="button"
            disabled={jb.status !== "ready"}
            onClick={handleCompile}
            style={{
              marginTop: 12,
              width: "100%",
              padding: "10px 0",
              background: jb.status === "ready"
                ? "color-mix(in srgb, var(--skin-primary) 15%, transparent)"
                : "var(--skin-surface)",
              border: "1px solid var(--skin-primary)",
              color: "var(--skin-primary)",
              borderRadius: 8,
              fontFamily: "inherit",
              fontSize: 13,
              cursor: jb.status === "ready" ? "pointer" : "not-allowed",
              opacity: jb.status === "ready" ? 1 : 0.4,
              letterSpacing: 2,
            }}
          >
            ⚡ COMPILE + MOUNT
          </button>

          {/* Babel status */}
          {jb.status === "loading" && (
            <div style={{ marginTop: 8, fontSize: 10, color: "var(--skin-muted)", textAlign: "center" }}>
              Loading Babel from CDN...
            </div>
          )}
        </div>

        {/* Live preview column */}
        <div style={{ flex: "1 1 340px", minWidth: 280 }}>
          {/* Slot grid */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: "var(--skin-muted)", letterSpacing: 3, marginBottom: 8 }}>
              SLOTS [{jb.mountedSlots.length}/{MAX_SLOTS}]
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
              {Array.from({ length: MAX_SLOTS }, (_, i) => {
                const mounted = jb.mountedSlots.find(s => s.slot === i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => mounted && setActiveSlot(i)}
                    style={{
                      padding: "8px 4px",
                      background: activeSlot === i
                        ? "color-mix(in srgb, var(--skin-primary) 20%, transparent)"
                        : "var(--skin-surface)",
                      border: `1px solid ${mounted ? "var(--skin-primary)" : "var(--skin-border)"}`,
                      borderRadius: 6,
                      color: mounted ? "var(--skin-primary)" : "var(--skin-muted)",
                      fontFamily: "inherit",
                      fontSize: 9,
                      cursor: mounted ? "pointer" : "default",
                      letterSpacing: 1,
                    }}
                  >
                    {mounted ? mounted.name.slice(0, 8) : `[${i}]`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live render */}
          <div style={{
            border: "1px solid var(--skin-border)",
            borderRadius: 8,
            minHeight: 200,
            overflow: "hidden",
            background: "var(--skin-surface)",
          }}>
            {SlotComponent ? (
              <SlotComponent />
            ) : (
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 200,
                color: "var(--skin-muted)",
                fontSize: 11,
                letterSpacing: 2,
              }}>
                COMPILE A CARTRIDGE TO PREVIEW
              </div>
            )}
          </div>

          {/* Saved cartridges */}
          {jb.cartridges.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 10, color: "var(--skin-muted)", letterSpacing: 3, marginBottom: 8 }}>
                LIBRARY [{jb.cartridges.length}]
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {jb.cartridges.map(c => (
                  <div key={c.id} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "6px 10px",
                    background: "var(--skin-surface)",
                    border: "1px solid var(--skin-border)",
                    borderRadius: 6,
                  }}>
                    <span style={{ fontSize: 11, color: "var(--skin-fg)" }}>
                      {c.name} <span style={{ color: "var(--skin-muted)", fontSize: 9 }}>SLOT_{c.slot}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--skin-muted)",
                        cursor: "pointer",
                        fontSize: 12,
                        padding: "0 4px",
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Telemetry */}
          {jb.telemetry.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 10, color: "var(--skin-muted)", letterSpacing: 3, marginBottom: 6 }}>
                TELEMETRY
              </div>
              <div style={{
                background: "var(--skin-surface)",
                border: "1px solid var(--skin-border)",
                borderRadius: 6,
                padding: 8,
                maxHeight: 100,
                overflowY: "auto",
                fontSize: 10,
                color: "var(--skin-muted)",
                fontFamily: "'DM Mono', monospace",
              }}>
                {jb.telemetry.slice(-10).map((t, i) => (
                  <div key={i} style={{
                    color: t.type === "error" ? "#ef4444" : t.type === "warn" ? "#f59e0b" : "var(--skin-muted)",
                  }}>
                    [{t.type}] {t.payload}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
