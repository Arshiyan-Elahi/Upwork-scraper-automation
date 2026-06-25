/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#6366f1',
          light: '#818cf8',
          dark: '#4f46e5',
          muted: '#eef2ff',
          'muted-dark': '#1e1b4b',
        },
        semantic: {
          success: {
            DEFAULT: '#10b981',
            light: '#d1fae5',
            dark: '#065f46',
          },
          warning: {
            DEFAULT: '#f59e0b',
            light: '#fef3c7',
            dark: '#92400e',
          },
          danger: {
            DEFAULT: '#ef4444',
            light: '#fee2e2',
            dark: '#991b1b',
          },
          info: {
            DEFAULT: '#3b82f6',
            light: '#dbeafe',
            dark: '#1e40af',
          },
        },
        surface: {
          DEFAULT: '#ffffff',
          secondary: '#f8fafc',
          tertiary: '#f1f5f9',
          'dark-default': '#0f172a',
          'dark-secondary': '#1e293b',
          'dark-tertiary': '#334155',
        },
        content: {
          DEFAULT: '#0f172a',
          secondary: '#475569',
          muted: '#94a3b8',
          'dark-default': '#f8fafc',
          'dark-secondary': '#cbd5e1',
          'dark-muted': '#64748b',
        },
        border: {
          DEFAULT: '#e2e8f0',
          dark: '#334155',
        },
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
        'gradient-brand-subtle':
          'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.08) 100%)',
      },
      borderRadius: {
        sm: '0.375rem',
        DEFAULT: '0.5rem',
        md: '0.625rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        soft: '0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.06)',
        card: '0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.05)',
        elevated:
          '0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.05)',
        glow: '0 0 20px rgba(99, 102, 241, 0.25)',
        'glow-dark': '0 0 24px rgba(129, 140, 248, 0.15)',
      },
      backdropBlur: {
        glass: '12px',
      },
    },
  },
  plugins: [],
}
