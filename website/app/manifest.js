export default function manifest() {
  return {
    name: 'RingIn — Talk to Experts Instantly',
    short_name: 'RingIn',
    description: 'Connect with verified domain experts instantly. Pay per minute.',
    start_url: '/',
    display: 'standalone',
    background_color: '#09090E',
    theme_color: '#09090E',
    orientation: 'portrait',
    icons: [
      { src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' },
    ],
    categories: ['social', 'business', 'productivity'],
  }
}
