/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--color-background) / <alpha-value>)',
        surface: {
          subtle: 'rgb(var(--color-surface-subtle) / <alpha-value>)',
          DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
          elevated: 'rgb(var(--color-surface-elevated) / <alpha-value>)',
        },
        border: 'rgb(var(--color-border) / <alpha-value>)',
        brand: {
          light: 'rgb(var(--color-brand-light) / <alpha-value>)',
          DEFAULT: 'rgb(var(--color-brand) / <alpha-value>)',
          dark: 'rgb(var(--color-brand-dark) / <alpha-value>)',
        },
        premium: 'rgb(var(--color-premium) / <alpha-value>)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(110deg, rgb(var(--color-brand-dark)), rgb(var(--color-brand)))',
        'app-glow': 'radial-gradient(circle at top, rgb(var(--color-brand) / 0.13), transparent 38%)',
      },
      boxShadow: {
        brand: '0 10px 30px rgb(var(--color-brand-dark) / 0.3)',
        panel: '0 24px 70px rgb(0 0 0 / 0.28)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
