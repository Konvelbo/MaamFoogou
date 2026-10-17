import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  page.on('console', (msg) => console.log('BROWSER_LOG:', msg.type(), msg.text()))
  page.on('pageerror', (err) => console.error('PAGE_ERROR:', err.message))

  console.log('Loading page...')
  await page.goto('http://localhost:3000', { waitUntil: 'load' })

  for (let i = 0; i <= 8; i++) {
    await page.waitForTimeout(3000)
    const count = await page.locator('article').count()
    const visibleCards = await page.locator('article:visible').count()
    const canvasCount = await page.locator('canvas').count()
    const headingText = await page.locator('#featured-heading').textContent().catch(() => 'NOT FOUND')
    console.log(`Time: ${i * 3}s - Cards: ${count}, Visible: ${visibleCards}, Canvases: ${canvasCount}, Heading: ${headingText}`)
  }

  await browser.close()
}

main().catch(console.error)
