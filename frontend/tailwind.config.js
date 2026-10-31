/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: {
          950: '#050B08',
          900: '#080D0B',
          850: '#0D1C16',
          800: '#0F1412',
          700: '#171D1A',
          600: '#262B29',
          500: '#313633',
        },
        emerald: {
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#00C982',
          700: '#00855B',
          800: '#005236',
        },
        mint: {
          200: '#C6F6D5',
          300: '#A7F3D0',
          400: '#6EE7B7',
          500: '#8CF5C2',
          600: '#5FFEB1',
        },
        surface: {
          DEFAULT: '#090E0C',
          card: '#0D1713',
          cardHover: '#13211B',
          container: '#111A16',
          border: '#192E24',
          borderLight: '#244033',
          text: '#DFE4E0',
          textMuted: '#899E92',
          subtle: '#3A4B42',
        },
      },
      fontFamily: {
        heading: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        sans: ['Inter', '"Plus Jakarta Sans"', 'sans-serif'],
      },
      boxShadow: {
        'glow-emerald': '0 0 24px -4px rgba(0, 201, 130, 0.25)',
        'glow-mint': '0 0 32px -4px rgba(140, 245, 194, 0.35)',
        'card': '0 8px 30px rgba(0, 0, 0, 0.35)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
      },
    },
  },
  plugins: [],
};

