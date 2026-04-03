import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Fiume Street Week 2026',
    short_name: 'FSW 2026',
    description: 'App ufficiale del torneo Fiume Street Week',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f172a', // Il blu scuro del tuo sfondo
    theme_color: '#f97316',      // L'arancione dei tuoi titoli
    icons: [
      {
        src: '/icon.png',
        sizes: 'any',
        type: 'image/png',
      },
    ],
  }
}