import { useState, useEffect } from 'react';
import { GENSYNC_PROFILES, type HumanOS } from '../lib/gensync-profiles';

export function useGenSync() {
  const [os, setOs] = useState<HumanOS>('TECHNICAL');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('p31:gensync:os') as HumanOS | null;
      if (saved && GENSYNC_PROFILES[saved]) setOs(saved);
    } catch {
      // localStorage unavailable — stay on default
    }
  }, []);

  const switchOS = (newOS: HumanOS) => {
    setOs(newOS);
    try { localStorage.setItem('p31:gensync:os', newOS); } catch {}
  };

  return { os, profile: GENSYNC_PROFILES[os], switchOS };
}
