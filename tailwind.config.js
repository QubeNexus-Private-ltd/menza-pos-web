/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        menza: {
          bg: '#FAF7F2',
          card: '#FFFFFF',
          darkBg: '#121212',
          darkCard: '#1E1E1E',
          primary: '#DE8626',
          primaryHover: '#C4721C',
          primaryLight: '#FFF4E5',
          gold: '#C98A2C',
          text: '#1E2930',
          textSecondary: '#667085',
          border: '#E7E1DA',
          darkBorder: '#2E2E2E',
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444',
          info: '#0284C7',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
