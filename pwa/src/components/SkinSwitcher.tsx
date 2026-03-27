import { useSkin, type Skin } from '../lib/skinStore';

const OPTIONS: { id: Skin; label: string; title: string }[] = [
  { id: 'OPERATOR', label: '◈', title: 'Operator' },
  { id: 'GRAY_ROCK', label: '◫', title: 'Gray Rock' },
  { id: 'KIDS', label: '✦', title: 'Kids' },
];

export function SkinSwitcher() {
  const [skin, setSkin] = useSkin();

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        display: 'flex',
        gap: 6,
        zIndex: 999,
      }}
    >
      {OPTIONS.map(o => (
        <button
          key={o.id}
          title={o.title}
          onClick={() => setSkin(o.id)}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            border: skin === o.id
              ? '1px solid var(--skin-primary)'
              : '1px solid var(--skin-border)',
            background: skin === o.id
              ? 'var(--skin-primary)22'
              : 'var(--skin-surface)',
            color: skin === o.id ? 'var(--skin-primary)' : 'var(--skin-muted)',
            fontSize: 12,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
