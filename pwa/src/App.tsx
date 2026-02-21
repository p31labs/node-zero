import { useState, useEffect } from "react";
import { P31 } from "./views/P31";
import { Shelter } from "./views/Shelter";

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

export default function App() {
  const [tab, setTab] = useState<"p31" | "shelter">("p31");
  const [showInstall, setShowInstall] = useState(false);
  const online = useOnline();

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
        <div
          className={`tab ${tab === "p31" ? " on" : ""}`}
          onClick={() => setTab("p31")}
        >
          P31
        </div>
        <div
          className={`tab ${tab === "shelter" ? " on" : ""}`}
          onClick={() => setTab("shelter")}
        >
          SHELTER
        </div>
        <div className="nr">
          <span className={`ns ${online ? " on" : ""}`}>
            {online ? "CONNECTED" : "OFFLINE"}
          </span>
        </div>
      </nav>
      <main className="main">
        {tab === "p31" ? <P31 /> : <Shelter />}
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
