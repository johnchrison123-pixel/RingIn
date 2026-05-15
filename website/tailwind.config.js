/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Background colors
        bg: '#09090E',
        'bg-2': '#111117',
        'bg-3': '#17171F',
        'bg-4': '#1E1E28',
        // Text colors
        text: '#EEEEF8',
        't-2': '#8F8FAA',
        't-3': '#52526A',
        // Border
        border: '#28283A',
        'border-2': '#343448',
        // Accent colors
        ac: '#7B6EFF',
        'ac-2': '#5d50e0',
        accent: '#7B6EFF',
        acg: 'rgba(123,110,255,0.14)',
        // Status colors
        green: '#27C96A',
        amber: '#F5A623',
        red: '#EF4747',
        pink: '#E84D9A',
      },
      fontFamily: {
        syne: ['Syne', 'sans-serif'],
        sans: ['DM Sans', 'sans-serif'],
      },
      fontSize: {
        xs: '11px',
        sm: '12px',
        base: '14px',
        lg: '15px',
        xl: '16px',
        '2xl': '22px',
        '3xl': '26px',
        '4xl': '32px',
      },
      spacing: {
        'nav-h': '60px',
        'rail-l': '280px',
        'rail-r': '320px',
      },
      backgroundImage: {
        grad: 'linear-gradient(135deg, #7B6EFF, #E84D9A)',
      },
      borderRadius: {
        'brand': '14px',
        'btn': '10px',
        'chip': '20px',
      },
      boxShadow: {
        'orb': '0 3px 10px rgba(232, 77, 154, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
        'orb-hover': '0 5px 16px rgba(232, 77, 154, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
      },
      animation: {
        blink: 'blink 1s infinite',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
      },
    },
  },
  plugins: [],
}

