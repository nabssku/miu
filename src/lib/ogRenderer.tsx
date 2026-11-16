import React from 'react';
import { ImageResponse } from 'next/og';

export const OG_IMAGE_SIZE = {
  width: 1200,
  height: 630
};

export const OG_IMAGE_ALT =
  'Miu Workspace — Dynamic Ambient Workspace untuk Fokus, Catatan, Kanban & Kalender AI';

export function buildMiuSocialImage(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '54px 64px',
          background:
            'linear-gradient(135deg, #0B1120 0%, #0F172A 48%, #0C2340 100%)',
          color: '#F8FAFC',
          fontFamily: 'sans-serif',
          position: 'relative'
        }}
      >
        {/* Top Ambient Dynamic Island Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '12px 24px',
              borderRadius: '9999px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.35)'
            }}
          >
            <div
              style={{
                width: '14px',
                height: '14px',
                borderRadius: '9999px',
                background: '#38BDF8'
              }}
            />
            <span
              style={{
                fontSize: '20px',
                fontWeight: 700,
                letterSpacing: '0.02em',
                color: '#E0F2FE'
              }}
            >
              MIU WORKSPACE • DYNAMIC ISLAND
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 20px',
              borderRadius: '9999px',
              background: 'rgba(16, 185, 129, 0.14)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              fontSize: '18px',
              fontWeight: 600,
              color: '#6EE7B7'
            }}
          >
            miu.kodelokal.store
          </div>
        </div>

        {/* Center Headline & Description */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            maxWidth: '980px'
          }}
        >
          <div
            style={{
              fontSize: '60px',
              fontWeight: 800,
              lineHeight: 1.12,
              letterSpacing: '-0.03em',
              color: '#FFFFFF'
            }}
          >
            Satu Notch untuk Mencatat, Fokus, dan Tenang.
          </div>

          <div
            style={{
              fontSize: '26px',
              lineHeight: 1.4,
              color: '#94A3B8'
            }}
          >
            Workspace local-first dengan Catatan Blok &amp; LaTeX, Kanban, Kalender Google,
            Pomodoro, Musik Fokus, serta Voice AI ElevenLabs.
          </div>
        </div>

        {/* Bottom Feature Pills */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            flexWrap: 'wrap'
          }}
        >
          {[
            'Editor Blok & KaTeX',
            'Kanban & Kalender',
            'Pomodoro + White Noise',
            'AI & ElevenLabs Voice',
            '100% Gratis & Local-First'
          ].map((label) => (
            <div
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 18px',
                borderRadius: '9999px',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.28)',
                color: '#BAE6FD',
                fontSize: '18px',
                fontWeight: 600
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    OG_IMAGE_SIZE
  );
}

export function buildMiuIconImage(sizePx: number): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: `${Math.round(sizePx * 0.26)}px`,
          background: '#0F172A'
        }}
      >
        <div
          style={{
            width: `${Math.round(sizePx * 0.62)}px`,
            height: `${Math.round(sizePx * 0.54)}px`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: `${Math.round(sizePx * 0.08)}px`,
            borderRadius: `${Math.round(sizePx * 0.24)}px`,
            background: '#EBF5FF',
            border: `${Math.max(2, Math.round(sizePx * 0.03))}px solid #38BDF8`
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: `${Math.round(sizePx * 0.16)}px`
            }}
          >
            <div
              style={{
                width: `${Math.max(4, Math.round(sizePx * 0.08))}px`,
                height: `${Math.max(4, Math.round(sizePx * 0.08))}px`,
                borderRadius: '9999px',
                background: '#0F172A'
              }}
            />
            <div
              style={{
                width: `${Math.max(4, Math.round(sizePx * 0.08))}px`,
                height: `${Math.max(4, Math.round(sizePx * 0.08))}px`,
                borderRadius: '9999px',
                background: '#0F172A'
              }}
            />
          </div>
          <div
            style={{
              width: `${Math.round(sizePx * 0.12)}px`,
              height: `${Math.max(3, Math.round(sizePx * 0.04))}px`,
              borderRadius: '9999px',
              background: '#0284C7'
            }}
          />
        </div>
      </div>
    ),
    { width: sizePx, height: sizePx }
  );
}
