/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--bg-canvas)',
        surface: 'var(--bg-surface)',
        accent: 'var(--color-accent)',
      },
      borderColor: { subtle: 'var(--border-subtle)' },
      borderRadius: { app: 'var(--radius-app)' },
    },
  },
}
