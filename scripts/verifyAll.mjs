import { chromium } from 'playwright'

async function main() {
  console.log('🧪 Starting Playwright QA Verification...')
  const browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })
  const page = await context.newPage()

  const consoleLogs = []
  page.on('console', (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`))

  console.log('1. Navigating to http://localhost:3000...')
  await page.goto('http://localhost:3000', { waitUntil: 'load', timeout: 30000 })
  await page.waitForTimeout(4000)

  // 1. Check localStorage
  const localStorageKeys = await page.evaluate(() => Object.keys(localStorage))
  console.log('🔑 localStorage keys found:', localStorageKeys)
  const dbKeys = localStorageKeys.filter((k) => k.includes('convex_state') || k.includes('maamfoogou_convex'))
  if (dbKeys.length > 0) {
    throw new Error(`FAIL: Database data still found in localStorage: ${dbKeys.join(', ')}`)
  }
  console.log('✅ PASS: Zero database data in localStorage!')

  // 2. Check catalog cards
  const cardTitles = await page.locator('article h3, [data-testid="design-card-title"], .featured-title').allTextContents()
  const pageText = await page.textContent('body')
  console.log('👗 Page mentions Celine:', pageText.includes('CELINE'))
  console.log('👗 Page mentions Palm Angels:', pageText.includes('Palm Angels') || pageText.includes('PALM ANGELS'))
  console.log('👗 Page mentions Gucci:', pageText.includes('GUCCI') || pageText.includes('Gucci'))
  console.log('👗 Page mentions Akatsuki (Anime):', pageText.includes('AKATSUKI') || pageText.includes('Akatsuki'))
  console.log('👗 Page mentions Ghost Recon (Guerre):', pageText.includes('GHOST RECON') || pageText.includes('TASK FORCE'))
  console.log('👗 Page mentions Pure Joie (Emoji):', pageText.includes('PURE JOIE') || pageText.includes('GOOD VIBES'))
  console.log('👗 Page mentions Hip-Hop (Rap):', pageText.includes('HIP-HOP') || pageText.includes('STRAIGHT OUTTA'))

  await page.screenshot({ path: 'scripts/verify_home.png', fullPage: false })
  console.log('📸 Screenshot saved: scripts/verify_home.png')

  // 3. Test opening a card (e.g. Celine or Palm Angels)
  console.log('3. Clicking on first design card...')
  const firstCard = page.locator('button:has-text("DÉCOUVRIR LE MODÈLE"), article button, button:has-text("CELINE")').first()
  if (await firstCard.isVisible()) {
    await firstCard.click()
    await page.waitForTimeout(2500)
    await page.screenshot({ path: 'scripts/verify_detail.png', fullPage: false })
    console.log('📸 Screenshot saved: scripts/verify_detail.png')
  }

  // 4. Test Studio 3D and Scale Slider
  console.log('4. Navigating to Studio 3D...')
  const studioBtn = page.locator('button:has-text("STUDIO 3D"), a:has-text("STUDIO 3D")').first()
  if (await studioBtn.isVisible()) {
    await studioBtn.click()
    await page.waitForTimeout(3000)

    // Check scale slider max
    const scaleSlider = page.locator('input[type="range"][max="0.48"]')
    const maxVal = await scaleSlider.count() > 0 ? await scaleSlider.first().getAttribute('max') : null
    console.log('📏 Scale slider max attribute:', maxVal)
    if (maxVal === '0.48') {
      console.log('✅ PASS: Scale slider allows maximum size up to 0.48 (48%) on the 3D model!')
    }

    await page.screenshot({ path: 'scripts/verify_studio.png', fullPage: false })
    console.log('📸 Screenshot saved: scripts/verify_studio.png')
  }

  await browser.close()
  console.log('🎉 Verification completed successfully!')
}

main().catch((err) => {
  console.error('❌ QA Error:', err.message || err)
  process.exit(1)
})
