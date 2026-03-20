/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      colors: {
        violet: {
          50: '#f3e8ff',
          100: '#ede7f6',
          200: '#d1c4e9',
          300: '#b39ddb',
          400: '#9575cd',
          500: '#7e57c2',
          600: '#673ab7',
          700: '#5e35b1',
          800: '#4527a0',
          900: '#311b92',
          950: '#1a0a3e',
        },
        amber: {
          50: '#fff8e1',
          100: '#ffecb3',
          200: '#ffe082',
          300: '#ffd54f',
          400: '#ffca28',
          500: '#ffb300',
          600: '#ffa000',
          700: '#ff8f00',
          800: '#ff6f00',
          900: '#e65100',
        },
        slate: {
          850: '#1a1d23',
          950: '#0f1117',
        },
      },
      typography: ({ theme }) => ({
        DEFAULT: {
          css: {
            '--tw-prose-body': theme('colors.slate.700'),
            '--tw-prose-headings': theme('colors.slate.900'),
            '--tw-prose-links': theme('colors.violet.600'),
            '--tw-prose-code': theme('colors.violet.700'),
            'h1, h2, h3, h4': {
              fontFamily: theme('fontFamily.display').join(', '),
              fontWeight: '600',
            },
            code: {
              fontFamily: theme('fontFamily.mono').join(', '),
              fontSize: '0.875em',
            },
            'code::before': { content: '""' },
            'code::after': { content: '""' },
            a: {
              textDecorationStyle: 'dotted',
              textUnderlineOffset: '3px',
              '&:hover': {
                textDecorationStyle: 'solid',
              },
            },
          },
        },
        invert: {
          css: {
            '--tw-prose-body': theme('colors.slate.300'),
            '--tw-prose-headings': theme('colors.slate.100'),
            '--tw-prose-links': theme('colors.violet.300'),
            '--tw-prose-code': theme('colors.violet.300'),
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
