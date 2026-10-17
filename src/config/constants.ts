import type { CatalogProduct, TShirtSize } from '../types/configurator'

// Chemin configurable vers le fichier .glb du t-shirt (modèle 3D scanné avec plis et AO cuite)
export const TSHIRT_MODEL_PATH =
  import.meta.env.VITE_TSHIRT_MODEL_PATH || '/models/tshirt.glb'

// Chemin du décodeur Draco pour décompresser les modèles .glb en moins de 3 secondes
export const DRACO_DECODER_PATH =
  'https://www.gstatic.com/draco/versioned/decoders/1.5.7/'

// Prix de base d'un t-shirt personnalisé (en euros)
export const BASE_TSHIRT_PRICE = 29.0

// Contraintes d'import d'image
export const IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 Mo maximum
export const IMAGE_MIN_WIDTH = 500 // Résolution minimale en largeur (px)
export const IMAGE_MIN_HEIGHT = 500 // Résolution minimale en hauteur (px)
export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg']

// Palette de couleurs coton réalistes (inspirée des teintures textiles lourdes 240g/m²)
export const TSHIRT_COLOR_PALETTE = [
  { name: 'Noir Carbone', hex: '#18181B' },
  { name: 'Blanc Craie', hex: '#F4F4F0' },
  { name: 'Gris Bruyère', hex: '#71717A' },
  { name: 'Bleu Nuit', hex: '#1E293B' },
  { name: 'Vert Sauge', hex: '#2D4A3E' },
  { name: 'Terracotta', hex: '#9A3412' },
  { name: 'Sable Désert', hex: '#D6C7B2' },
  { name: 'Bordeaux', hex: '#4C1D24' },
  { name: 'Ocre Solaire', hex: '#CA8A04' },
  { name: 'Bleu Cobalt', hex: '#1D4ED8' },
] as const

// Tailles disponibles
export const TSHIRT_SIZES: Array<TShirtSize> = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

// Polices disponibles pour la personnalisation texte
export const AVAILABLE_FONTS = [
  { label: 'Sans-Serif Moderne (Inter)', value: 'Inter, system-ui, sans-serif' },
  { label: 'Impact Sport (Impact)', value: 'Impact, Haettenschweiler, sans-serif' },
  { label: 'Éditorial Serif (Georgia)', value: 'Georgia, Cambria, serif' },
  { label: 'Monospace Tech (Courier)', value: '"Courier New", Courier, monospace' },
  { label: 'Urbain Bold (Trebuchet)', value: '"Trebuchet MS", sans-serif' },
] as const

// Catalogue de t-shirts déjà faits (calibrés sur le maillage 3D scanné T_Shirt_male)
export const CATALOG_PRODUCTS: Array<CatalogProduct> = [
  {
    id: 'faso-heritage',
    name: 'Édition Faso Héritage',
    description:
      'Coton peigné lourd 240g/m² avec typographie poitrine haute densité et signature minimaliste au dos.',
    price: 34.0,
    defaultColor: '#18181B',
    defaultSize: 'L',
    elements: [
      {
        id: 'preset-1-front',
        type: 'text',
        side: 'front',
        position: [0, 0.04, 0.15],
        rotation: 0,
        scale: 0.18,
        text: 'FASO STUDIO',
        fontFamily: 'Impact, Haettenschweiler, sans-serif',
        fontSize: 64,
        textColor: '#F4F4F0',
        strokeColor: '#CA8A04',
        strokeWidth: 2,
      },
      {
        id: 'preset-1-back',
        type: 'text',
        side: 'back',
        position: [0, 0.06, -0.13],
        rotation: 0,
        scale: 0.17,
        text: 'ATELIER 01 • 240GSM',
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: 48,
        textColor: '#CA8A04',
        strokeColor: '#000000',
        strokeWidth: 0,
      },
    ],
  },
  {
    id: 'atelier-terracotta',
    name: 'Atelier Terracotta Solar',
    description:
      'Teinte terre cuite naturelle inspirée du Sahel, lettrage poitrine contrasté et grand motif dorsal.',
    price: 32.0,
    defaultColor: '#9A3412',
    defaultSize: 'M',
    elements: [
      {
        id: 'preset-2-front',
        type: 'text',
        side: 'front',
        position: [0, 0.05, 0.15],
        rotation: 0,
        scale: 0.17,
        text: 'SOLAR CLUB',
        fontFamily: 'Georgia, Cambria, serif',
        fontSize: 58,
        textColor: '#F4F4F0',
        strokeColor: '#18181B',
        strokeWidth: 1,
      },
      {
        id: 'preset-2-back',
        type: 'text',
        side: 'back',
        position: [0, 0.03, -0.13],
        rotation: 0,
        scale: 0.2,
        text: 'HORIZON 2026',
        fontFamily: 'Impact, Haettenschweiler, sans-serif',
        fontSize: 64,
        textColor: '#F4F4F0',
        strokeColor: '#4C1D24',
        strokeWidth: 3,
      },
    ],
  },
  {
    id: 'minimal-botanique',
    name: 'Essentiel Vert Sauge',
    description:
      'Coupe droite structurée en coton biologique tissé serré, marquage artisanal haute densité.',
    price: 31.0,
    defaultColor: '#2D4A3E',
    defaultSize: 'M',
    elements: [
      {
        id: 'preset-3-front',
        type: 'text',
        side: 'front',
        position: [0, 0.05, 0.15],
        rotation: 0,
        scale: 0.17,
        text: 'BOTANICA',
        fontFamily: 'Georgia, Cambria, serif',
        fontSize: 60,
        textColor: '#D6C7B2',
        strokeColor: '#18181B',
        strokeWidth: 1,
      },
    ],
  },
  {
    id: 'cobalt-kinetic',
    name: 'Kinetic Bleu Cobalt',
    description:
      'T-shirt graphique haute visibilité avec typographie dynamique et finition coton brossé.',
    price: 35.0,
    defaultColor: '#1D4ED8',
    defaultSize: 'XL',
    elements: [
      {
        id: 'preset-4-front',
        type: 'text',
        side: 'front',
        position: [0, 0.04, 0.15],
        rotation: 0,
        scale: 0.19,
        text: 'KINETIC WAVE',
        fontFamily: 'Impact, Haettenschweiler, sans-serif',
        fontSize: 62,
        textColor: '#FFFFFF',
        strokeColor: '#1E293B',
        strokeWidth: 3,
      },
      {
        id: 'preset-4-back',
        type: 'text',
        side: 'back',
        position: [0, 0.05, -0.13],
        rotation: 0,
        scale: 0.16,
        text: 'PURE COTTON',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 50,
        textColor: '#FDE047',
        strokeColor: '#000000',
        strokeWidth: 0,
      },
    ],
  },
]
