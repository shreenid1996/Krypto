import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/popup/**/*.{ts,tsx,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0f0f14',
          card: '#1a1a24',
          elevated: '#22222f',
          border: '#2e2e3e',
        },
        brand: {
          DEFAULT: '#7c5cfc',
          hover: '#9b82fd',
          muted: '#3d2e7c',
        },
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
        muted: '#6b7280',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        card: '12px',
        btn: '8px',
      },
      width: {
        popup: '400px',
      },
      minHeight: {
        popup: '580px',
      },
    },
  },
  plugins: [],
};

export default config;
