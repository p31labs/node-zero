import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { SessionProvider } from "./context/SessionContext";
import { CognitiveLoadProvider, useCognitiveLoad } from "./context/CognitiveLoadContext";
import { P31 } from "./views/P31";
import { Shelter } from "./views/Shelter";
import { MeshView } from "./views/MeshView";
import { BondingView } from "./views/BondingView";
import { SoupStub } from "./views/SoupStub";
import { MakerStub } from "./views/MakerStub";

let deferredPrompt: { prompt: () => void; userChoice: Promise<{ outcome: string }> } | null = null;
window.addEventListener("beforeinstallprompt", (e: Event) => {
  e.preventDefault();
  deferredPrompt = e as unknown as typeof deferredPrompt;
});

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

function AppContent() {
  const [showInstall, setShowInstall] = useState(false);
  const online = useOnline();
  const { level, setLevel } = useCognitiveLoad();

  useEffect(() => {
    if (deferredPrompt) setShowInstall(true);
  }, []);

  const doInstall = () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => {
      deferredPrompt = null;
      setShowInstall(false);
    });
  };

  return (
    <>
      <nav className="nav">
        <NavLink
          to="/"
          className={({ isActive }) => `tab${isActive ? " on" : ""}`}
          end
        >
          P31
        </NavLink>
        <NavLink
          to="/shelter"
          className={({ isActive }) => `tab${isActive ? " on" : ""}`}
        >
          SHELTER
        </NavLink>
        <NavLink
          to="/mesh"
          className={({ isActive }) => `tab${isActive ? " on" : ""}`}
        >
          MESH
        </NavLink>
        <NavLink
          to="/bonding"
          className={({ isActive }) => `tab${isActive ? " on" : ""}`}
        >
          BONDING
        </NavLink>
        <div className="nr" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 10, color: "#555" }}>
            <input
              type="range"
              min={0}
              max={100}
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              style={{ width: 48, accentColor: level > 70 ? "#31ffa3" : level > 30 ? "#f59e0b" : "#ec4899" }}
              title="Cognitive load"
            />
          </label>
          <span className={`ns ${online ? " on" : ""}`}>
            {online ? "CONNECTED" : "OFFLINE"}
          </span>
        </div>
      </nav>
      <main className="main">
        <Routes>
          <Route path="/" element={<P31 />} />
          <Route path="/shelter" element={<Shelter />} />
          <Route path="/mesh" element={<MeshView />} />
          <Route path="/bonding" element={<BondingView />} />
          <Route path="/soup" element={<SoupStub />} />
          <Route path="/maker" element={<MakerStub />} />
          <Route path="*" element={<P31 />} />
        </Routes>
      </main>
      <div id="ib" className={`ib ${showInstall ? " vis" : ""}`}>
        <span style={{ color: "#888" }}>
          <strong style={{ color: "#31ffa3" }}>P31</strong> — Install on your device
        </span>
        <div style={{ display: "flex", alignItems: "center" }}>
          <button onClick={doInstall}>INSTALL</button>
          <button className="x" onClick={() => setShowInstall(false)}>×</button>
        </div>
      </div>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <CognitiveLoadProvider>
          <AppContent />
        </CognitiveLoadProvider>
      </SessionProvider>
    </BrowserRouter>
  );
}
