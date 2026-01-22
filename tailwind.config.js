/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    // Ensure all preset accent colors are included
    'bg-emerald-600', 'hover:bg-emerald-500', 'text-emerald-400', 'focus:border-emerald-500', 'hover:text-emerald-300', 'focus:ring-emerald-500/20',
    'bg-blue-600', 'hover:bg-blue-500', 'text-blue-400', 'focus:border-blue-500', 'hover:text-blue-300', 'focus:ring-blue-500/20',
    'bg-purple-600', 'hover:bg-purple-500', 'text-purple-400', 'focus:border-purple-500', 'hover:text-purple-300', 'focus:ring-purple-500/20',
    'bg-orange-600', 'hover:bg-orange-500', 'text-orange-400', 'focus:border-orange-500', 'hover:text-orange-300', 'focus:ring-orange-500/20',
    'bg-rose-600', 'hover:bg-rose-500', 'text-rose-400', 'focus:border-rose-500', 'hover:text-rose-300', 'focus:ring-rose-500/20',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

