import { useState, useEffect } from 'react';

export type Skin = 'OPERATOR' | 'GRAY_ROCK' | 'KIDS';

const TOKENS: Record<Skin, Record<string, string>> = {
  OPERATOR: {
    '--skin-bg':       '#050510',
    '--skin-fg':       '#e2e8f0',
    '--skin-primary':  '#31ffa3',
    '--skin-secondary':'#38bdf8',
    '--skin-accent':   '#6366f1',
    '--skin-muted':    '#555',
    '--skin-surface':  '#0d1117',
    '--skin-border':   '#1a1a2e',
  },
  GRAY_ROCK: {
    '--skin-bg':       '#0a0a0a',
    '--skin-fg':       '#aaaaaa',
    '--skin-primary':  '#888888',
    '--skin-secondary':'#666666',
    '--skin-accent':   '#555555',
    '--skin-muted':    '#444444',
    '--skin-surface':  '#111111',
    '--skin-border':   '#222222',
  },
  KIDS: {
    '--skin-bg':       '#0a0520',
    '--skin-fg':       '#f0e8ff',
    '--skin-primary':  '#ff79c6',
    '--skin-secondary':'#bd93f9',
    '--skin-accent':   '#50fa7b',
    '--skin-muted':    '#8888aa',
    '--skin-surface':  '#1a0a30',
    '--skin-border':   '#3a1a50',
  },
};

function applyCSS(skin: Skin) {
  const vars = TOKENS[skin];
  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v);
  }
}

let _current: Skin = (localStorage.getItem('p31-skin') as Skin) || 'OPERATOR';
const _listeners = new Set<() => void>();

export function initSkin(): void {
  applyCSS(_current);
}

export function getSkin(): Skin {
  return _current;
}

export function setSkin(skin: Skin): void {
  _current = skin;
  localStorage.setItem('p31-skin', skin);
  applyCSS(skin);
  _listeners.forEach(fn => fn());
}

export function useSkin(): [Skin, (s: Skin) => void] {
  const [skin, setState] = useState<Skin>(_current);
  useEffect(() => {
    const notify = () => setState(_current);
    _listeners.add(notify);
    return () => { _listeners.delete(notify); };
  }, []);
  return [skin, setSkin];
}
