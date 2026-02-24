/**
 * Cognitive load dial — 0–100%. Every room reads it.
 * isMinimal: hide stats. isFull: show formula, mass, valence. isCrisis: one button only.
 */

import { createContext, useContext, useState, type ReactNode } from "react";

interface CognitiveLoadState {
  level: number;
  setLevel: (n: number) => void;
  isMinimal: boolean;
  isFull: boolean;
  isCrisis: boolean;
}

const CognitiveLoadContext = createContext<CognitiveLoadState>({
  level: 70,
  setLevel: () => {},
  isMinimal: false,
  isFull: false,
  isCrisis: false,
});

export function CognitiveLoadProvider({ children }: { children: ReactNode }) {
  const [level, setLevel] = useState(70);
  return (
    <CognitiveLoadContext.Provider
      value={{
        level,
        setLevel,
        isMinimal: level < 30,
        isFull: level > 70,
        isCrisis: level === 0,
      }}
    >
      {children}
    </CognitiveLoadContext.Provider>
  );
}

export function useCognitiveLoad() {
  const ctx = useContext(CognitiveLoadContext);
  if (!ctx) throw new Error("useCognitiveLoad must be used within CognitiveLoadProvider");
  return ctx;
}
