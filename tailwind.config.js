/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#00FEFF',
          hover: '#00E5E6',
          muted: 'rgba(0, 254, 255, 0.15)',
        },
        surface: {
          DEFAULT: 'hsl(222 25% 11%)',
          2: 'hsl(222 22% 14%)',
          3: 'hsl(222 20% 17%)',
        },
        border: {
          DEFAULT: 'hsl(220 18% 22%)',
          focus: '#00FEFF',
        },
      },
      borderRadius: {
        'app': '8px',
        'app-lg': '8px',
        'app-xl': '8px',
        'xl': '8px',
        '2xl': '8px',
        '3xl': '8px',
      },
      boxShadow: {
        'card': '0 4px 24px rgba(0, 0, 0, 0.25)',
        'focus': '0 0 0 3px rgba(0, 254, 255, 0.15)',
      },
    },
  },
  plugins: [],
};
