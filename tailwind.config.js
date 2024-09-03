/** @type {import('tailwindcss').Config} */
const konstaConfig = require('konsta/config')

export default konstaConfig({
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx,vue}'],
  theme: {
    fontFamily: {
      sans: ['"Inter"', 'sans-serif']
    },
    extend: {
      fontFamily: {
        logo: ['"Quicksand"', 'sans-serif']
      },
      colors: {
        'light-purple': {
          5: '#6750A4',
          4: '#806DB3',
          3: '#9A8AC2',
          2: '#B3A7D1',
          1: '#F1F2FC'
        },
        'dark-purple': {
          5: '#151021',
          4: '#221B37',
          3: '#342852',
          2: '#45356D',
          1: '#564389'
        },
        prim: {
          5: '#BFA6CC',
          4: '#D6C7E0',
          3: '#EBE4F0',
          2: '#F3F0F7',
          1: '#FAF8FB'
        },
        chestnut: {
          4: '#E3C9BE',
          3: '#EFDFD9',
          2: '#F6EDEA',
          1: '#F6EDEA'
        },
        'pure-white': '#FFFFFF',
        slate: {
          11: '#101828',
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
        lime: {
          10: '#3F4E19',
          9: '#495C18',
          8: '#5B7417',
          7: '#789719',
          6: '#9BBE24',
          5: '#B9D843',
          4: '#D1E875',
          3: '#E4F2A4',
          2: '#F2F8CF',
          1: '#F9FCE9'
        },
        orange: {
          10: '#9C2A10',
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
        rose: {
          11: '#89123E',
          10: '#A11043',
          9: '#C01048',
          8: '#E31B54',
          7: '#F63D68',
          6: '#FD6F8E',
          5: '#FEA3B4',
          4: '#FECDD6',
          3: '#FFE4E8',
          2: '#FFF1F3',
          1: '#FFF5F6'
        },
        tomato: {
          11: '#450F0A',
          10: '#7F251D',
          9: '#99261B',
          8: '#B92A1C',
          7: '#DD3F30',
          6: '#EE5445',
          5: '#F87D71',
          4: '#FCADA5',
          3: '#FECFCA',
          2: '#FEE4E2',
          1: '#FEF3F2'
        },
        cornflower: {
          11: '#07334A',
          10: '#0B4F6F',
          9: '#066086',
          8: '#0172A3',
          7: '#0095D1',
          6: '#0CB2EB',
          5: '#36C8FA',
          4: '#7CDAFD',
          3: '#B9EAFE',
          2: '#E0F4FE',
          1: '#F0FAFF'
        },
        tulip: {
          11: '#442004',
          10: '#74400F',
          9: '#894E0A',
          8: '#A66402',
          7: '#D18D00',
          6: '#E8B100',
          5: '#FFD30D',
          4: '#FFE541',
          3: '#FFF486',
          2: '#FFFBC1',
          1: '#FFFDE7'
        },
        grass: {
          11: '#172E05',
          10: '#325314',
          9: '#396212',
          8: '#457C0F',
          7: '#5BA30D',
          6: '#71C115',
          5: '#97E635',
          4: '#B4F264',
          3: '#D3F99D',
          2: '#E9FCCB',
          1: '#F5FEE7'
        }
      }
    }
  },
  plugins: [require('@tailwindcss/forms')]
})
