import { ConvexHttpClient } from 'convex/browser'
import fs from 'node:fs'
import path from 'node:path'

// 8 illustrations 100% SANS FOND (fond totalement transparent) pour les thèmes :
// - Marques connues : Celine, Palm Angels, Gucci
// - Animé : Akatsuki Cloud, Mangekyou Sharingan
// - Guerre : Tactical Winged Skull
// - Joie : Emoji Dopamine Composition
// - Rap : Hip-Hop Crown & Parental Advisory
const TRANSPARENT_GRAPHICS = {
  celineTriomphe: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none">
    <!-- Emblème Triomphe Celine (Double C entrelacé doré & blanc, 0% background) -->
    <g stroke="#D4AF37" stroke-width="26" stroke-linecap="round" stroke-linejoin="round">
      <path d="M 235 145 C 140 145, 85 200, 85 256 C 85 312, 140 367, 235 367" />
      <path d="M 277 145 C 372 145, 427 200, 427 256 C 427 312, 372 367, 277 367" />
      <path d="M 210 195 C 160 195, 135 222, 135 256 C 135 290, 160 317, 210 317" stroke="#FFFFFF" stroke-width="14"/>
      <path d="M 302 195 C 352 195, 377 222, 377 256 C 377 290, 352 317, 302 317" stroke="#FFFFFF" stroke-width="14"/>
      <line x1="256" y1="115" x2="256" y2="397" stroke="#D4AF37" stroke-width="22"/>
      <circle cx="256" cy="256" r="24" fill="#D4AF37" stroke="#FFFFFF" stroke-width="8"/>
    </g>
  </svg>`,

  palmAngelsLogo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none">
    <!-- Palmier gothique & ailes Palm Angels (100% sans fond) -->
    <g fill="#111111">
      <!-- Tronc élancé -->
      <path d="M246 440 C248 340, 252 250, 256 175 C260 250, 264 340, 266 440 Z" />
      <!-- Palmes rayonnantes -->
      <path d="M256 185 C200 130, 120 125, 65 165 C130 160, 195 175, 256 205 Z" />
      <path d="M256 185 C312 130, 392 125, 447 165 C382 160, 317 175, 256 205 Z" />
      <path d="M256 175 C185 95, 95 80, 45 110 C115 112, 185 140, 256 190 Z" />
      <path d="M256 175 C327 95, 417 80, 467 110 C397 112, 327 140, 256 190 Z" />
      <path d="M256 168 C220 90, 165 55, 110 60 C165 82, 215 122, 256 180 Z" />
      <path d="M256 168 C292 90, 347 55, 402 60 C347 82, 297 122, 256 180 Z" />
      <path d="M256 200 C190 185, 120 205, 80 250 C135 228, 195 220, 256 218 Z" />
      <path d="M256 200 C322 185, 392 205, 432 250 C377 228, 317 220, 256 218 Z" />
      <!-- Halo angélique doré -->
      <ellipse cx="256" cy="52" rx="74" ry="18" fill="none" stroke="#D4AF37" stroke-width="14"/>
    </g>
  </svg>`,

  gucciCrest: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none">
    <!-- Bande Web Gucci Vert-Rouge-Vert + Double G entrelacé (100% sans fond) -->
    <g>
      <rect x="76" y="196" width="360" height="36" fill="#14532D" />
      <rect x="76" y="238" width="360" height="36" fill="#B91C1C" />
      <rect x="76" y="280" width="360" height="36" fill="#14532D" />
      <!-- Double G entrelacé Or -->
      <circle cx="216" cy="256" r="96" stroke="#D4AF37" stroke-width="26" stroke-dasharray="470 140" fill="none"/>
      <line x1="216" y1="256" x2="292" y2="256" stroke="#D4AF37" stroke-width="26" stroke-linecap="square"/>
      <circle cx="296" cy="256" r="96" stroke="#D4AF37" stroke-width="26" stroke-dasharray="470 140" transform="rotate(180 296 256)" fill="none"/>
      <line x1="296" y1="256" x2="220" y2="256" stroke="#D4AF37" stroke-width="26" stroke-linecap="square"/>
    </g>
  </svg>`,

  akatsukiCloud: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none">
    <!-- Nuage Rouge Akatsuki (Animé) avec contour blanc net, 0% background -->
    <g>
      <path d="M126 332 C72 332, 42 292, 58 244 C70 206, 112 192, 144 206 C158 148, 224 122, 278 152 C314 114, 384 124, 408 174 C454 182, 476 232, 452 276 C434 312, 392 332, 344 332 Z"
        fill="#DC2626" stroke="#FFFFFF" stroke-width="18" stroke-linejoin="round"/>
      <path d="M168 268 C196 244, 238 248, 256 276" stroke="#FFFFFF" stroke-width="14" stroke-linecap="round" fill="none"/>
      <path d="M292 232 C324 214, 362 224, 376 252" stroke="#FFFFFF" stroke-width="14" stroke-linecap="round" fill="none"/>
    </g>
  </svg>`,

  sharingan: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none">
    <!-- Mangekyou Sharingan (Animé) 100% détouré sans fond -->
    <g>
      <circle cx="256" cy="256" r="196" fill="#DC2626" stroke="#111111" stroke-width="22"/>
      <circle cx="256" cy="256" r="118" fill="none" stroke="#111111" stroke-width="10" stroke-dasharray="28 18"/>
      <!-- 3 Tomoe / Lames Mangekyou -->
      <path d="M256 68 C320 130, 336 210, 256 256 C198 205, 210 125, 256 68 Z" fill="#111111"/>
      <path d="M418 350 C332 374, 260 340, 256 256 C328 232, 392 284, 418 350 Z" fill="#111111"/>
      <path d="M94 350 C140 272, 206 226, 256 256 C242 332, 166 372, 94 350 Z" fill="#111111"/>
      <circle cx="256" cy="256" r="34" fill="#DC2626" stroke="#111111" stroke-width="14"/>
    </g>
  </svg>`,

  tacticalSkull: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none">
    <!-- Emblème Guerre / Forces Spéciales : Crâne Ailé & Épées croisées (100% sans fond) -->
    <g>
      <!-- Ailes tactiques -->
      <path d="M168 230 L34 150 L68 210 L28 235 L84 268 L54 295 L168 295 Z" fill="#FACC15" stroke="#111111" stroke-width="10" stroke-linejoin="round"/>
      <path d="M344 230 L478 150 L444 210 L484 235 L428 268 L458 295 L344 295 Z" fill="#FACC15" stroke="#111111" stroke-width="10" stroke-linejoin="round"/>
      <!-- Lames croisées -->
      <line x1="92" y1="410" x2="420" y2="96" stroke="#FFFFFF" stroke-width="20" stroke-linecap="round"/>
      <line x1="420" y1="410" x2="92" y2="96" stroke="#FFFFFF" stroke-width="20" stroke-linecap="round"/>
      <!-- Crâne central -->
      <path d="M172 220 C172 152, 340 152, 340 220 C340 264, 320 294, 304 312 L304 364 L208 364 L208 312 C192 294, 172 264, 172 220 Z"
        fill="#FFFFFF" stroke="#111111" stroke-width="16" stroke-linejoin="round"/>
      <!-- Orbites & nez -->
      <polygon points="204,228 242,218 236,258 198,254" fill="#111111"/>
      <polygon points="308,228 270,218 276,258 314,254" fill="#111111"/>
      <polygon points="256,266 242,296 270,296" fill="#111111"/>
      <!-- Dents -->
      <line x1="228" y1="324" x2="228" y2="360" stroke="#111111" stroke-width="10"/>
      <line x1="256" y1="324" x2="256" y2="360" stroke="#111111" stroke-width="10"/>
      <line x1="284" y1="324" x2="284" y2="360" stroke="#111111" stroke-width="10"/>
    </g>
  </svg>`,

  emojiJoy: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none">
    <!-- Thème La Joie : Emoji Souriant Pop + Lunettes + Étincelles (100% sans fond) -->
    <g>
      <!-- Étincelles autour -->
      <polygon points="90,70 102,102 134,114 102,126 90,158 78,126 46,114 78,102" fill="#EA580C"/>
      <polygon points="428,84 438,112 466,122 438,132 428,160 418,132 390,122 418,112" fill="#FACC15"/>
      <polygon points="84,380 94,406 120,416 94,426 84,452 74,426 48,416 74,406" fill="#10B981"/>
      <!-- Sphère Emoji Jaune Or -->
      <circle cx="256" cy="264" r="164" fill="#FACC15" stroke="#111111" stroke-width="18"/>
      <!-- Lunettes de soleil Streetwear -->
      <rect x="132" y="200" width="108" height="58" fill="#111111"/>
      <rect x="272" y="200" width="108" height="58" fill="#111111"/>
      <line x1="240" y1="216" x2="272" y2="216" stroke="#111111" stroke-width="16"/>
      <line x1="96" y1="214" x2="132" y2="214" stroke="#111111" stroke-width="16"/>
      <line x1="380" y1="214" x2="416" y2="214" stroke="#111111" stroke-width="16"/>
      <!-- Reflet blanc sur les verres -->
      <line x1="152" y1="214" x2="178" y2="242" stroke="#FFFFFF" stroke-width="10" stroke-linecap="round"/>
      <line x1="292" y1="214" x2="318" y2="242" stroke="#FFFFFF" stroke-width="10" stroke-linecap="round"/>
      <!-- Grand Sourire Joie -->
      <path d="M168 308 C192 374, 320 374, 344 308 Z" fill="#111111"/>
      <path d="M206 338 C228 362, 284 362, 306 338" stroke="#EF4444" stroke-width="18" stroke-linecap="round" fill="none"/>
    </g>
  </svg>`,

  hipHopCrown: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none">
    <!-- Thème Le Rap : Couronne Hip-Hop Or + Bandeau Parental Advisory (100% sans fond) -->
    <g>
      <!-- Couronne royale à 5 pointes -->
      <polygon points="84,300 64,136 164,212 256,96 348,212 448,136 428,300"
        fill="#F59E0B" stroke="#FFFFFF" stroke-width="16" stroke-linejoin="round"/>
      <!-- Joyaux sur la couronne -->
      <circle cx="64" cy="122" r="16" fill="#EF4444" stroke="#FFFFFF" stroke-width="6"/>
      <circle cx="256" cy="80" r="20" fill="#EF4444" stroke="#FFFFFF" stroke-width="6"/>
      <circle cx="448" cy="122" r="16" fill="#EF4444" stroke="#FFFFFF" stroke-width="6"/>
      <!-- Cartouche PARENTAL ADVISORY EXPLICIT RAP -->
      <rect x="76" y="330" width="360" height="92" fill="#FFFFFF" stroke="#111111" stroke-width="12"/>
      <rect x="76" y="330" width="360" height="32" fill="#111111"/>
      <text x="256" y="352" text-anchor="middle" fill="#FFFFFF" font-family="Arial Black, Impact, sans-serif" font-size="20" font-weight="900" letter-spacing="4">PARENTAL ADVISORY</text>
      <text x="256" y="394" text-anchor="middle" fill="#111111" font-family="Arial Black, Impact, sans-serif" font-size="30" font-weight="900" letter-spacing="3">EXPLICIT RAP</text>
      <text x="256" y="414" text-anchor="middle" fill="#111111" font-family="Arial, sans-serif" font-size="13" font-weight="700" letter-spacing="5">226 UNDERGROUND</text>
    </g>
  </svg>`,
}

async function seedTarget(convexUrl) {
  console.log(`\n🚀 Connexion à Convex : ${convexUrl}`)
  const client = new ConvexHttpClient(convexUrl)

  const storageIds = {}
  for (const [key, svgContent] of Object.entries(TRANSPARENT_GRAPHICS)) {
    const uploadUrl = await client.mutation('seed:generateSeedUploadUrl', {})
    // Si le backend local renvoie une URL sur 127.0.0.1, on garde l'hôte cible
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'image/svg+xml' },
      body: svgContent,
    })
    if (!uploadRes.ok) {
      throw new Error(`Échec upload ${key}: HTTP ${uploadRes.status}`)
    }
    const { storageId } = await uploadRes.json()
    storageIds[key] = storageId
    console.log(`  ✓ Image sans fond [${key}] uploadée dans Convex _storage -> ${storageId}`)
  }

  const result = await client.mutation('seed:seedDatabase', { storageIds })
  console.log(`✅ Base Convex peuplée avec succès (${result.designsCount} modèles 3D créés) !`)
}

async function main() {
  const targetUrl = process.argv[2] || process.env.VITE_CONVEX_URL || 'https://careful-fly-771.convex.cloud'
  await seedTarget(targetUrl)
}

main().catch((err) => {
  console.error('❌ Erreur lors du seed Convex:', err.message || err)
  process.exit(1)
})
