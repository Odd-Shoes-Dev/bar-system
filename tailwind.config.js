/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#2563EB',      // Blue Ox blue
          'primary-light': '#DBEAFE',
          'primary-dark': '#1E40AF',
          secondary: '#F59E0B',    // Accent gold
          charcoal: '#2C2C2C',
          'charcoal-light': '#3E3E3E',
          slate: '#64748B',
          success: '#10B981',
          danger: '#EF4444',
          warning: '#F59E0B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      fontSize: {
        'pos': '1.125rem', // 18px for POS
        'pos-lg': '1.5rem', // 24px for POS headers
        'pos-xl': '2rem', // 32px for totals
      },
      spacing: {
        'touch': '48px', // Minimum touch target
      },
    },
  },
  plugins: [],
};
