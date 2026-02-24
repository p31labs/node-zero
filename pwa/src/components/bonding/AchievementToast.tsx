import { useEffect } from "react";
import { ACHIEVEMENTS } from "../../lib/bonding/achievements";

interface Props {
  achievementIds: string[];
  onDismiss: () => void;
}

export function AchievementToast({ achievementIds, onDismiss }: Props) {
  const firstId = achievementIds[0];
  const achievement = firstId ? ACHIEVEMENTS.find((a) => a.id === firstId) : null;

  useEffect(() => {
    if (!firstId) return;
    const t = setTimeout(() => onDismiss(), 2500);
    return () => clearTimeout(t);
  }, [firstId, onDismiss]);

  if (achievementIds.length === 0 || !achievement) return null;

  return (
    <div
      className="achievement-toast"
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        width: "calc(100% - 32px)",
        maxWidth: 320,
        padding: "16px 24px",
        background: "#0c0c18",
        border: "1px solid #31ffa340",
        borderLeft: "4px solid #39FF14",
        borderRadius: 8,
        fontFamily: "system-ui, sans-serif",
        color: "#31ffa3",
        zIndex: 1000,
        animation: "toastSlide 2.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      }}
    >
      <style>{`
        @keyframes toastSlide {
          0% { transform: translate(-50%, 100%); opacity: 0; }
          10% { transform: translate(-50%, 0); opacity: 1; }
          85% { transform: translate(-50%, 0); opacity: 1; }
          100% { transform: translate(-50%, 100%); opacity: 0; }
        }
      `}</style>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{achievement.name}</div>
      <div style={{ fontSize: 12, opacity: 0.6 }}>{achievement.desc}</div>
    </div>
  );
}
