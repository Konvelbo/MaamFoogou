import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  page.on('console', (msg) => console.log('LOG:', msg.text()))
  page.on('pageerror', (err) => console.error('ERROR:', err.message))

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' })

  console.log('1. Click Les plus likés...')
  await page.locator('button:has-text("Les plus likés")').click()
  await page.waitForTimeout(1000)
  let cards = await page.locator('article').count()
  console.log('Cards after Les plus likés:', cards)

  console.log('2. Click Collection équipe...')
  await page.locator('button:has-text("COLLECTION ÉQUIPE")').first().click()
  await page.waitForTimeout(1000)
  cards = await page.locator('article').count()
  console.log('Cards after Collection équipe:', cards)

  console.log('3. Click Créateurs du Faso...')
  await page.locator('button:has-text("CRÉATEURS DU FASO")').first().click()
  await page.waitForTimeout(1000)
  cards = await page.locator('article').count()
  console.log('Cards after Créateurs du Faso:', cards)

  console.log('4. Click Prix croissant...')
  await page.locator('button:has-text("Prix croissant")').click()
  await page.waitForTimeout(1000)
  cards = await page.locator('article').count()
  console.log('Cards after Prix croissant:', cards)

  console.log('5. Waiting 10 seconds to see if anything disappears...')
  await page.waitForTimeout(10000)
  cards = await page.locator('article').count()
  console.log('Cards after 10s wait:', cards)

  await browser.close()
}

main().catch(console.error)
