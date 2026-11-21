/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './shared/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
    './utils/**/*.{js,ts,jsx,tsx,mdx}',
    './services/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        menza: {
          bg: '#FAF8F5',
          card: '#FFFFFF',
          darkBg: '#0E1217',
          darkCard: '#161B22',
          primary: '#DE8626',
          primaryHover: '#C4721C',
          primaryLight: '#FFF4E5',
          gold: '#C98A2C',
          text: '#162028',
          textSecondary: '#64748B',
          border: '#E8E2D9',
          darkBorder: '#26323E',
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444',
          info: '#0284C7',
        },
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.025)',
        'card-hover': '0 10px 25px -4px rgba(222, 134, 38, 0.18), 0 2px 8px rgba(0, 0, 0, 0.04)',
        'glow-primary': '0 0 20px rgba(222, 134, 38, 0.28)',
      },
      fontFamily: {
        sans: ['var(--font-jakarta)', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
