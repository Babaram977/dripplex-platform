import React from 'react';
import { G0, G2, G3, BORDER } from '../../tokens/colors';
import { FONT_BODY, TYPE } from '../../tokens/typography';
import { R_INPUT } from '../../tokens/radius';

interface SearchBarProps {
  placeholder?: string;
  onPress?: () => void;
  onMic?: () => void;
  onFilter?: () => void;
  showMic?: boolean;
  showFilter?: boolean;
  // Optional: controlled value for future text input support
  value?: string;
  style?: React.CSSProperties;
}

export function SearchBar({
  placeholder = 'Search…',
  onPress,
  onMic,
  onFilter,
  showMic = true,
  showFilter = false,
  value,
  style,
}: SearchBarProps) {
  return (
    <button
      onClick={onPress}
      className="flex w-full items-center gap-3"
      style={{
        height: 50,
        borderRadius: R_INPUT,
        background: 'rgba(255,255,255,.08)',
        border: `1.5px solid ${BORDER}`,
        paddingLeft: 16,
        paddingRight: 12,
        textAlign: 'left',
        ...style,
      }}
    >
      {/* Brand search icon */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 10,
          flexShrink: 0,
          background: `linear-gradient(135deg,${G0},${G2})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#FFF"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      </div>

      {/* Placeholder / value */}
      <p
        style={{
          flex: 1,
          fontSize: TYPE.base,
          fontFamily: FONT_BODY,
          color: value ? '#FFF' : 'rgba(255,255,255,.30)',
        }}
      >
        {value || placeholder}
      </p>

      {/* Mic */}
      {showMic && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMic?.();
          }}
          className="flex h-7 w-7 items-center justify-center rounded-lg active:scale-90"
          style={{ background: 'rgba(255,255,255,.06)', flexShrink: 0 }}
          aria-label="Voice search"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,.5)"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <rect x="9" y="2" width="6" height="11" rx="3" />
            <path d="M5 10a7 7 0 0014 0M12 19v3M9 22h6" />
          </svg>
        </button>
      )}

      {/* Filter */}
      {showFilter && (
        <>
          <div style={{ width: 1, height: 16, background: BORDER, flexShrink: 0 }} />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFilter?.();
            }}
            className="flex flex-shrink-0 items-center gap-1 px-1.5 active:opacity-70"
            aria-label="Filter"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke={G3}
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="8" y1="12" x2="20" y2="12" />
              <line x1="12" y1="18" x2="20" y2="18" />
            </svg>
            <p style={{ fontSize: TYPE.sm, fontWeight: 600, color: G3, fontFamily: FONT_BODY }}>
              Filter
            </p>
          </button>
        </>
      )}
    </button>
  );
}
