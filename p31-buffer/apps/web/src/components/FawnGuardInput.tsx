import { useState, useCallback } from 'react';
import { analyzeOutgoing, type FawnAnalysis } from '../lib/fawnGuard';
import { COLORS, FONTS, SPACE, BORDER, PATTERNS } from '../lib/design-tokens';

interface FawnGuardInputProps {
  onSubmit: (text: string) => void;
  placeholder?: string;
}

export function FawnGuardInput({ onSubmit, placeholder = "Type your message..." }: FawnGuardInputProps) {
  const [text, setText] = useState('');
  const [analysis, setAnalysis] = useState<FawnAnalysis | null>(null);
  const [bypassed, setBypassed] = useState(false);

  const handleSubmit = useCallback(() => {
    if (!text.trim()) return;

    if (bypassed) {
      onSubmit(text);
      setText('');
      setAnalysis(null);
      setBypassed(false);
      return;
    }

    const result = analyzeOutgoing(text);
    if (!result.isFawning) {
      onSubmit(text);
      setText('');
      setAnalysis(null);
    } else {
      setAnalysis(result);
    }
  }, [text, bypassed, onSubmit]);

  const handleBypass = useCallback(() => {
    setBypassed(true);
    onSubmit(text);
    setText('');
    setAnalysis(null);
    setBypassed(false);
  }, [text, onSubmit]);

  const handleDismiss = useCallback(() => {
    setAnalysis(null);
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setAnalysis(null); setBypassed(false); }}
        placeholder={placeholder}
        style={{
          ...PATTERNS.input,
          minHeight: '80px',
          resize: 'vertical',
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSubmit();
          }
        }}
      />

      {/* Fawn Guard Warning */}
      {analysis?.isFawning && (
        <div style={{
          marginTop: SPACE[2],
          padding: SPACE[3],
          background: COLORS.state.orange,
          border: `${BORDER.width.thin} solid ${COLORS.state.orange}`,
          borderRadius: BORDER.radius.md,
          fontFamily: FONTS.mono,
        }}>
          <div style={{
            fontSize: FONTS.size.xs,
            fontWeight: FONTS.weight.bold,
            letterSpacing: FONTS.tracking.wider,
            color: COLORS.text.inverse,
            marginBottom: SPACE[2],
          }}>
            ⚠ FAWN GUARD
          </div>

          {analysis.flags.map((flag, i) => (
            <div key={i} style={{
              fontSize: FONTS.size.sm,
              color: COLORS.text.secondary,
              marginBottom: SPACE[1],
              paddingLeft: SPACE[2],
            }}>
              • {flag}
            </div>
          ))}

          <div style={{
            fontSize: FONTS.size.base,
            color: COLORS.text.inverse,
            marginTop: SPACE[3],
            fontStyle: 'italic',
          }}>
            {analysis.advice}
          </div>

          <div style={{ display: 'flex', gap: SPACE[2], marginTop: SPACE[3] }}>
            <button
              onClick={handleDismiss}
              style={{
                ...PATTERNS.filterButton,
                flex: 1,
              }}
            >
              REVISE
            </button>
            <button
              onClick={handleBypass}
              style={{
                ...PATTERNS.filterButton,
                flex: 1,
                borderColor: COLORS.state.orange,
                color: COLORS.text.primary,
              }}
            >
              I AM GENUINE — TRANSMIT
            </button>
          </div>
        </div>
      )}

      {/* Submit button */}
      {!analysis?.isFawning && (
        <button
          onClick={handleSubmit}
          style={{
            ...PATTERNS.filterButton,
            marginTop: SPACE[2],
            width: '100%',
            ...( text.trim() ? PATTERNS.filterButtonActive : {}),
          }}
        >
          TRANSMIT (Ctrl+Enter)
        </button>
      )}
    </div>
  );
}
