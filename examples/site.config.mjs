// Copy this file, point `content` at your vault, run: node bin/vellum.mjs build examples/site.config.mjs
export default {
  name: 'example',
  title: 'Example',
  description: 'The vellum example vault.',
  baseUrl: 'example.org',
  content: './vault',
  icon: { text: 'E', bg: '#3C5A73', fg: '#F7F4EC' },
  lists: { numericNoDot: false },
  theme: {
    fonts: { header: 'EB Garamond', body: 'Noto Sans', code: 'Roboto Mono' },
    colors: {
      light: { light: '#F7F4EC', lightgray: '#DAD4C6', gray: '#8A8272', darkgray: '#3A3733', dark: '#211F1B', secondary: '#3C5A73', tertiary: '#6A8AA6', highlight: 'rgba(60,90,115,.08)', textHighlight: '#E4D08A88', customCallout: 'rgba(60,90,115,.1)', searchBackground: '#ECE7DB' },
      dark: { light: '#1A1917', lightgray: '#33312D', gray: '#9A9384', darkgray: '#D8D3C8', dark: '#F0ECE2', secondary: '#8FB0CC', tertiary: '#A9C4DB', highlight: 'rgba(143,176,204,.1)', textHighlight: '#B39A4088', customCallout: 'rgba(143,176,204,.12)', searchBackground: '#242220' },
    },
  },
  // deploy: { host: 'user@server', dir: '/var/www/example', check: 'https://example.org/' },
}
