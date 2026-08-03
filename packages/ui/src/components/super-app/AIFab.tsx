import { G0, G2 } from '../../tokens/colors';

/**
 * Floating "Ask Drip" AI-assistant button, ported from `FAB` in the locked
 * Figma Make export. Source renders a non-interactive `<div>`; this uses a
 * real `<button>` since every screen needs it to actually open the AI
 * sheet.
 */
export function SuperAppAIFab({ onPress }: { onPress: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onPress}
      className="absolute z-40"
      style={{ bottom: 94, right: 18 }}
      aria-label="AI Assistant"
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: `linear-gradient(135deg,${G0},${G2})`,
          boxShadow: '0 6px 28px rgba(43,172,82,.5), 0 0 0 1.5px rgba(43,172,82,.32)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'avatar-pulse 3s ease-in-out infinite',
        }}
      >
        <span style={{ fontSize: 22 }}>✨</span>
      </div>
    </button>
  );
}
