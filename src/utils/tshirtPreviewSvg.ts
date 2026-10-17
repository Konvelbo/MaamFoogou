// Générateur d'aperçus vectoriels épurés (Face, Dos, Variantes de couleur) inspirés du studio BZB
// Fond studio gris neutre (#E6E6E6), zéro arrondi > 4px, optimisé pour connexions mobiles

export function generateTShirtSvgUrl(params: {
  tshirtColor: string
  view: 'front' | 'back'
  headline: string
  subline?: string
  accentColor?: string
  badgeText?: string
}): string {
  const {
    tshirtColor,
    view,
    headline,
    subline = 'MAAMFOOGOU',
    accentColor = '#111111',
  } = params

  const isLightShirt =
    tshirtColor.toLowerCase() === '#f4f4f0' ||
    tshirtColor.toLowerCase() === '#f5f2eb' ||
    tshirtColor.toLowerCase() === '#ffffff' ||
    tshirtColor.toLowerCase() === '#d6c7b2'

  const textColor = isLightShirt ? '#111111' : '#FFFFFF'
  const collarShadow = isLightShirt ? '#D4D4D4' : '#0A0A0A'
  const viewLabel = view === 'front' ? 'FACE' : 'DOS'

  const collarPath =
    view === 'front'
      ? 'M 155 72 Q 200 108 245 72 Q 235 88 200 92 Q 165 88 155 72 Z'
      : 'M 155 72 Q 200 84 245 72 Q 238 80 200 82 Q 162 80 155 72 Z'

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 520" width="400" height="520">
    <defs>
      <filter id="softShadow" x="-10%" y="-10%" width="120%" height="125%">
        <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000000" flood-opacity="0.08"/>
      </filter>
    </defs>

    <!-- Fond Studio Gris Neutre épuré style BZB -->
    <rect width="400" height="520" fill="#E5E5E5"/>

    <!-- Silhouette T-Shirt Coton -->
    <g filter="url(#softShadow)">
      <path d="M 148 74 L 252 74 L 344 130 L 314 198 L 274 176 L 274 442 Q 200 448 126 442 L 126 176 L 86 198 L 56 130 Z"
        fill="${tshirtColor}" stroke="${isLightShirt ? '#D0D0D0' : '#222222'}" stroke-width="1" stroke-linejoin="miter"/>
      <path d="${collarPath}" fill="${collarShadow}" opacity="0.7"/>
      <path d="M 136 180 Q 154 265 142 400" stroke="${collarShadow}" stroke-width="1" fill="none" opacity="0.15"/>
      <path d="M 264 180 Q 246 265 258 400" stroke="${collarShadow}" stroke-width="1" fill="none" opacity="0.15"/>
    </g>

    <!-- Marquage minimaliste -->
    <g transform="translate(200, ${view === 'front' ? 200 : 190})">
      <rect x="-58" y="-26" width="116" height="56" rx="2" fill="none" stroke="${accentColor}" stroke-width="1.2" opacity="0.75"/>
      <text x="0" y="-2" text-anchor="middle" fill="${textColor}" font-family="Inter, Helvetica, Arial, sans-serif" font-weight="700" font-size="14" letter-spacing="1.5">${headline}</text>
      <text x="0" y="16" text-anchor="middle" fill="${textColor}" opacity="0.75" font-family="Inter, Helvetica, Arial, sans-serif" font-weight="500" font-size="8.5" letter-spacing="2">${subline}</text>
    </g>

    <!-- Étiquette discrète angle de vue (rx=2 max) -->
    <rect x="336" y="484" width="48" height="20" rx="2" fill="#FFFFFF" opacity="0.85"/>
    <text x="360" y="497" text-anchor="middle" fill="#111111" font-family="Inter, sans-serif" font-weight="600" font-size="8.5" letter-spacing="1">${viewLabel}</text>
  </svg>`

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
