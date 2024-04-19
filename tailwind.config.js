/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx,vue}'],
  theme: {
    fontFamily: {
      logo: ['"Quicksand"', 'sans-serif'],
      sans: ['"Roboto"', 'sans-serif']
    },
    extend: {
      colors: {
        // brand
        'light-purple': {
          DEFAULT: '#6750A4',
          4: '#806DB3',
          3: '#9A8AC2',
          2: '#B3A7D1',
          1: '#E7E0EC'
        },
        'dark-purple': {
          DEFAULT: '#151021',
          4: '#221B37',
          3: '#342852',
          2: '#45356D',
          1: '#564389'
        },
        // greyscale
        grey: {
          DEFAULT: '#363636',
          4: '#707070',
          3: '#A0A0A0',
          2: '#E4E4E4',
          1: '#FBFBFB'
        },
        white: '#FCFCFD',
        'pure-white': '#FFFFFF',
        'hover-state': '#F6F6F6',
        // greyscale v2
        slate: {
          DEFAULT: '#101828',
          10: '#1D2939',
          9: '#344054',
          8: '#475467',
          7: '#667085',
          6: '#98A2B3',
          5: '#D0D5DD',
          4: '#EAECF0',
          3: '#F2F4F7',
          2: '#F9FAFB',
          1: '#FCFCFD'
        },
        // semantic
        success: {
          DEFAULT: '#4B810E',
          4: '#71C115',
          3: '#A0D663',
          2: '#D0EAB1',
          1: '#F2FFE3'
        },
        error: {
          DEFAULT: '#932A20',
          4: '#DD3F30',
          3: '#E87F75',
          2: '#F4BFBA',
          1: '#F8D9D6'
        },
        pending: {
          DEFAULT: '#9B76',
          4: '#E8B1',
          3: '#F0CB55',
          2: '#F7E5AA',
          1: '#FAEFCC'
        },
        info: {
          DEFAULT: '#00638B',
          4: '#0095D1',
          3: '#55B8E0',
          2: '#AADCF0',
          1: '#CCEAF6'
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
          9: '#C4320A',
          8: '#EC4A0A',
          7: '#FB6514',
          6: '#FD853A',
          5: '#FEB273',
          4: '#FDDCAB',
          3: '#FFEAD5',
          2: '#FFF6ED',
          1: '#FFFAF5'
        },
        lime: {
          DEFAULT: '#3F4E19',
          9: '#495C18',
          8: '#5B7417',
          7: '#789719',
          6: '#9BBE24',
          5: '#B9D843',
          4: '#D1E875',
          3: '#E4F2A4',
          2: '#F2F8CF',
          1: '#F9FCE9'
        }
      }
    }
  },
  plugins: []
}
