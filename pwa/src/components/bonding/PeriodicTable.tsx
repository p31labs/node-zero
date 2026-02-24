import { useRef } from "react";
import { useCognitiveLoad } from "../../context/CognitiveLoadContext";
import type { Element } from "../../lib/bonding/elements";

interface Props {
  elements: Element[];
  selected: Element | null;
  onSelect: (el: Element) => void;
  disabled: boolean;
  waitingName?: string;
}

export function PeriodicTable({ elements, selected, onSelect, disabled, waitingName }: Props) {
  const { isMinimal } = useCognitiveLoad();
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.getAttribute("data-element-index") == null) return;
    const index = parseInt(target.getAttribute("data-element-index") ?? "0", 10);
    const selectable = elements.filter((_, i) => elements[i]!.valence > 0);
    const selectableIndex = selectable.findIndex((el) => el.symbol === elements[index]?.symbol);
    if (e.key === "ArrowRight" && selectableIndex < selectable.length - 1) {
      e.preventDefault();
      const next = selectable[selectableIndex + 1];
      const nextIdx = elements.findIndex((el) => el.symbol === next?.symbol);
      (containerRef.current?.querySelectorAll("[data-element-index]")[nextIdx] as HTMLElement)?.focus();
    } else if (e.key === "ArrowLeft" && selectableIndex > 0) {
      e.preventDefault();
      const prev = selectable[selectableIndex - 1];
      const prevIdx = elements.findIndex((el) => el.symbol === prev?.symbol);
      (containerRef.current?.querySelectorAll("[data-element-index]")[prevIdx] as HTMLElement)?.focus();
    }
  };

  return (
    <div
      style={{
        padding: 12,
        background: "#0c0c18",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        position: "relative",
      }}
    >
      {disabled && waitingName && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            color: "#888",
            zIndex: 2,
          }}
        >
          Waiting for {waitingName}...
        </div>
      )}
      <div
        ref={containerRef}
        role="group"
        aria-label="Periodic table elements"
        onKeyDown={handleKeyDown}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          overflowX: "auto",
          paddingBottom: 8,
          minHeight: 48,
        }}
      >
        {elements.map((el, i) => {
          const isSelected = selected?.symbol === el.symbol;
          const isNoble = el.valence === 0;
          return (
            <button
              key={el.symbol}
              type="button"
              data-element-index={i}
              disabled={disabled || isNoble}
              onClick={() => !isNoble && onSelect(el)}
              aria-label={`${el.name}, ${el.valence} bond${el.valence !== 1 ? "s" : ""}. ${isSelected ? "Selected" : ""}`}
              style={{
                position: "relative",
                minWidth: 48,
                minHeight: 48,
                padding: "6px 8px",
                background: `${el.color}14`,
                border: `1px solid ${isSelected ? el.color : `${el.color}40`}`,
                borderRadius: 8,
                color: isNoble ? "#555" : "#e2e8f0",
                fontSize: 14,
                fontWeight: 700,
                fontFamily: "'DM Mono', monospace",
                cursor: isNoble || disabled ? "not-allowed" : "pointer",
                opacity: isNoble ? 0.5 : 1,
                boxShadow: isSelected ? `0 0 12px ${el.color}40` : undefined,
                transition: "box-shadow 0.2s",
              }}
            >
              <span style={{ position: "absolute", top: 4, right: 6, fontSize: 9, opacity: 0.5 }}>{el.number}</span>
              {el.symbol}
              {isNoble && " 🔒"}
            </button>
          );
        })}
      </div>
      {!isMinimal && selected && (
        <div
          style={{
            fontSize: 12,
            color: "#888",
            marginTop: 8,
            fontStyle: "italic",
          }}
        >
          <strong style={{ color: selected.color }}>{selected.name}</strong> · {selected.valence} bond
          {selected.valence !== 1 ? "s" : ""}. {selected.fact}
        </div>
      )}
    </div>
  );
}
