/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/utils/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      colors: {
        canvas: 'var(--bg-canvas)',
        'canvas-end': 'var(--bg-canvas-end)',
        surface: 'var(--bg-surface)',
        subtle: 'var(--bg-subtle)',
        'border-subtle': 'var(--border-subtle)',
        'accent-primary': 'var(--accent-primary)',
        'accent-strong': 'var(--accent-strong)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'island-bg': 'var(--island-bg)',
        'island-text': 'var(--island-text)',
        'island-border': 'var(--island-border)',
        pomodoro: 'var(--accent-pomodoro)',
        spotify: 'var(--accent-spotify)'
      },
      borderRadius: {
        'island-pill': '9999px',
        'island-popover': '26px',
        'editor-card': '20px',
        widget: '12px'
      },
      boxShadow: {
        island: '0 18px 48px -12px rgba(15, 23, 42, 0.36), 0 0 0 1px var(--island-border)',
        card: '0 12px 36px -16px rgba(15, 23, 42, 0.12), 0 1px 3px rgba(15, 23, 42, 0.04)',
        'card-dark': '0 16px 42px -18px rgba(0, 0, 0, 0.55), 0 1px 2px rgba(0, 0, 0, 0.35)'
      }
    }
  },
  plugins: []
};
