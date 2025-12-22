/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        myway: {
          primary: '#0f766e', // Teal-700
          secondary: '#14b8a6', // Teal-500
          bg: '#f8fafc', // Slate-50
          surface: '#ffffff',
          text: '#334155', // Slate-700
          muted: '#94a3b8', // Slate-400
          accent: '#f59e0b', // Amber-500 for warm highlights
          danger: '#e11d48', // Rose-600 for critical alerts
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
      }
    },
  },
  plugins: [],
}
