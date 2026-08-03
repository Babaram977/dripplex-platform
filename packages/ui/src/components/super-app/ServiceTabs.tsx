import { useSuperAppFonts } from './fonts';

export interface SuperAppServiceTab {
  key: string;
  icon: string;
  label: string;
}

/** Marketplace/Ride/Wallet segmented control shown at the top of Home's scroll area. */
export function SuperAppServiceTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: SuperAppServiceTab[];
  active: string;
  onChange?: ((key: string) => void) | undefined;
}): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <div
      className="flex gap-1 rounded-2xl p-1"
      style={{ background: 'rgba(255,255,255,.05)', border: '1.5px solid rgba(255,255,255,.07)' }}
    >
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            onClick={
              onChange
                ? () => {
                    onChange(t.key);
                  }
                : undefined
            }
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl"
            style={{
              background: on ? 'rgba(255,255,255,.10)' : 'transparent',
              border: on ? '1px solid rgba(255,255,255,.12)' : '1px solid transparent',
              boxShadow: on ? '0 2px 12px rgba(0,0,0,.28)' : 'none',
            }}
          >
            <span style={{ fontSize: 15 }}>{t.icon}</span>
            <span
              className={`text-[11.5px] font-semibold ${body}`}
              style={{ color: on ? '#FFF' : 'rgba(255,255,255,.35)' }}
            >
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
