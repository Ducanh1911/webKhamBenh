/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50:'#f0fdfa',100:'#ccfbf1',600:'#0d9488',700:'#0f766e',800:'#115e59',900:'#134e4a' },
        ink: { 900:'#0f172a', 700:'#334155', 500:'#64748b' }
      },
      fontFamily: { sans: ['Inter','system-ui','-apple-system','sans-serif'] },
      boxShadow: { card: '0 1px 3px rgba(15,23,42,.06), 0 1px 2px rgba(15,23,42,.04)' }
    }
  },
  plugins: []
}
