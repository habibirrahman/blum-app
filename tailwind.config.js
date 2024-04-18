/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx,vue}'],
  theme: {
    fontFamily: {
      logo: ['"Quicksand"', 'sans-serif'],
      body: ['"Roboto"', 'sans-serif'],
      sans: [
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        '"Helvetica Neue"',
        'Arial',
        '"Noto Sans"',
        'sans-serif',
        '"Apple Color Emoji"',
        '"Segoe UI Emoji"',
        '"Segoe UI Symbol"',
        '"Noto Color Emoji"'
      ],
      serif: ['Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'],
      mono: ['Menlo', 'Monaco', 'Consolas', '"Liberation Mono"', '"Courier New"', 'monospace']
    },
    extend: {
      colors: {
        // brand
        'light-purple': {
          DEFAULT: '#6750A4',
          400: '#806DB3',
          300: '#9A8AC2',
          200: '#B3A7D1',
          100: '#E7E0EC'
        },
        'dark-purple': {
          DEFAULT: '#151021',
          400: '#221B37',
          300: '#342852',
          200: '#45356D',
          100: '#564389'
        },
        // greyscale
        grey: {
          DEFAULT: '#363636',
          400: '#707070',
          300: '#A0A0A0',
          200: '#E4E4E4',
          100: '#FBFBFB'
        },
        white: '#FCFCFD',
        'pure-white': '#FFFFFF',
        'hover-state': '#F6F6F6',
        // greyscale v2
        slate: {
          DEFAULT: '#101828',
          1000: '#1D2939',
          900: '#344054',
          800: '#475467',
          700: '#667085',
          600: '#98A2B3',
          500: '#D0D5DD',
          400: '#EAECF0',
          300: '#F2F4F7',
          200: '#F9FAFB',
          100: '#FCFCFD'
        },
        // semantic
        success: {
          DEFAULT: '#4B810E',
          400: '#71C115',
          300: '#A0D663',
          200: '#D0EAB1',
          100: '#F2FFE3'
        },
        error: {
          DEFAULT: '#932A20',
          400: '#DD3F30',
          300: '#E87F75',
          200: '#F4BFBA',
          100: '#F8D9D6'
        },
        pending: {
          DEFAULT: '#9B7600',
          400: '#E8B100',
          300: '#F0CB55',
          200: '#F7E5AA',
          100: '#FAEFCC'
        },
        info: {
          DEFAULT: '#00638B',
          400: '#0095D1',
          300: '#55B8E0',
          200: '#AADCF0',
          100: '#CCEAF6'
        },
        // accent color
        'green-lime': '#D1E875',
        'green-moss': '#A7C957',
        'green-pear': '#D3E4AB',
        'green-lake': '#2AB1A8',
        'green-mint': '#B8E5E2',
        'red-salmon': '#F4855D',
        'red-coral': '#F9B69E',
        'red-cherry': '#FF4447',
        'red-blush': '#FFC1C2',
        'yellow-gold': '#F4D430',
        'yellow-daffodil': '#FBEEAC',
        'yellow-highlighter': '#DCFF00',
        'yellow-butter': '#F3FFAA',
        'blue-sky': '#487ADF',
        'blue-hydrangeas': '#D3DFF7',
        'violet-lavender': '#A533FF',
        'violet-lilac': '#E1BBFF',
        'orange-tangerine': '#F57E00',
        'orange-apricot': '#FCD4AA',
        orange: {
          DEFAULT: '#9C2A10',
          900: '#C4320A',
          800: '#EC4A0A',
          700: '#FB6514',
          600: '#FD853A',
          500: '#FEB273',
          400: '#FDDCAB',
          300: '#FFEAD5',
          200: '#FFF6ED',
          100: '#FFFAF5'
        },
        lime: {
          DEFAULT: '#3F4E19',
          900: '#495C18',
          800: '#5B7417',
          700: '#789719',
          600: '#9BBE24',
          500: '#B9D843',
          400: '#D1E875',
          300: '#E4F2A4',
          200: '#F2F8CF',
          100: '#F9FCE9'
        }
      }
    }
  },
  plugins: []
}
