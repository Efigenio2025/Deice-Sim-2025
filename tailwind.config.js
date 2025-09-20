/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './app/**/*.{js,jsx,ts,tsx}',
    './lib/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'polar-void': '#0b1726',
      },
      keyframes: {
        frostpulse: {
          '0%, 100%': { opacity: 0.45 },
          '50%': { opacity: 0.8 },
        },
      },
      animation: {
        frostpulse: 'frostpulse 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
