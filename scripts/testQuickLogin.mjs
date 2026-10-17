import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' })

  console.log('1. Clicking like on first card...')
  await page.locator('article button[aria-label*="Liker"]').first().click()
  await page.waitForTimeout(800)

  console.log('2. Clicking Admin Atelier quick demo login...')
  await page.locator('button:has-text("Admin Atelier")').click()
  await page.waitForTimeout(3000)

  const modalVisible = await page.locator('h3:has-text("CONNEXION")').isVisible()
  console.log('Modal visible after Admin Atelier login:', modalVisible)

  const bodyText = await page.textContent('body')
  console.log('Page mentions Atelier Maamfoogou:', bodyText.includes('Atelier') || bodyText.includes('Maamfoogou'))
  console.log('Page mentions COMPTE:', bodyText.includes('Compte') || bodyText.includes('COMPTE'))

  await page.screenshot({ path: 'scripts/verify_login_and_like_success.png' })
  await browser.close()
  console.log('🎉 Quick login test finished successfully!')
}

main().catch(console.error)
