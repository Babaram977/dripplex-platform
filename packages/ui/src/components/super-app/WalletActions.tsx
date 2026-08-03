import { useSuperAppFonts } from './fonts';

export interface SuperAppWalletAction {
  key: string;
  icon: string;
  label: string;
}

/**
 * Send/Receive/Top Up/Pay action row, ported out of Home's `BalanceCard`
 * so a dedicated Wallet screen can reuse it without the balance display.
 */
export function SuperAppWalletActions({
  actions,
  onAction,
}: {
  actions: SuperAppWalletAction[];
  onAction?: ((key: string) => void) | undefined;
}): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <div className="flex gap-2">
      {actions.map((a) => (
        <button
          key={a.key}
          type="button"
          onClick={
            onAction
              ? () => {
                  onAction(a.key);
                }
              : undefined
          }
          className="flex flex-1 flex-col items-center gap-1 rounded-2xl py-2"
          style={{ background: 'rgba(255,255,255,.10)' }}
        >
          <span className="text-[15px] font-bold" style={{ color: '#FFF' }}>
            {a.icon}
          </span>
          <p
            className={`text-[9px] font-semibold ${body}`}
            style={{ color: 'rgba(255,255,255,.65)' }}
          >
            {a.label}
          </p>
        </button>
      ))}
    </div>
  );
}
