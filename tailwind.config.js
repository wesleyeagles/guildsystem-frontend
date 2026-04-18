/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'var(--brand)',
          hover: 'var(--brand-hover)',
          muted: 'var(--brand-muted)',
        },
        surface: {
          DEFAULT: 'var(--surface)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
        },
        border: {
          DEFAULT: 'var(--border)',
          focus: 'var(--border-focus)',
        },
      },
      borderRadius: {
        app: '8px',
        'app-lg': '8px',
        'app-xl': '8px',
        xl: '8px',
        '2xl': '8px',
        '3xl': '8px',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        focus: 'var(--shadow-focus)',
      },
    },
  },
  plugins: [],
};
