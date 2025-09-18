const plugin = require('tailwindcss/plugin');

const frostPlugin = plugin(({ addUtilities, addVariant }) => {
  addVariant('supports-backdrop', "@supports ((-webkit-backdrop-filter: none) or (backdrop-filter: none))");

  addUtilities({
    '.bg-frost-radial': {
      backgroundColor: '#080b14',
      backgroundImage:
        'radial-gradient(1400px 800px at 70% -20%, rgba(32,45,82,0.92) 0%, rgba(11,15,26,0.96) 60%, rgba(8,11,20,1) 100%)',
      backgroundAttachment: 'fixed',
      backgroundRepeat: 'no-repeat',
    },
    '.bg-frost-panel': {
      backgroundImage: 'linear-gradient(135deg, rgba(67, 89, 139, 0.28), rgba(26, 36, 65, 0.8))',
      backgroundColor: 'rgba(15, 20, 33, 0.85)',
    },
    '.frost-glass': {
      backdropFilter: 'blur(22px)',
      WebkitBackdropFilter: 'blur(22px)',
    },
    '.frost-border': {
      borderColor: 'rgba(148, 163, 184, 0.18)',
    },
  });

  addUtilities({
    '.frost-divider': {
      backgroundImage: 'linear-gradient(to right, transparent, rgba(148, 163, 184, 0.35), transparent)',
      height: '1px',
    },
  });
});

module.exports = {
  content: ['./pages/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}', './lib/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        frost: {
          sky: '#38bdf8',
          ice: '#67e8f9',
          midnight: '#0b0f1a',
          abyss: '#080b14',
          slate: '#1a2442',
        },
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'frost-wipe': {
          '0%': { transform: 'translateX(-140%) skewX(-18deg)', opacity: 0 },
          '50%': { opacity: 0.65 },
          '100%': { transform: 'translateX(120%) skewX(-18deg)', opacity: 0 },
        },
        'float-gentle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        'frost-wipe': 'frost-wipe 1.25s ease-out forwards',
        'float-gentle': 'float-gentle 6s ease-in-out infinite',
      },
      boxShadow: {
        frost: '0 12px 40px rgba(15, 23, 42, 0.45)',
        'frost-ring': '0 0 0 1px rgba(34,211,238,0.35)',
      },
    },
  },
  plugins: [frostPlugin],
};
