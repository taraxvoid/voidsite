import { createServer } from 'node:net'
import { defineConfig, devices } from '@playwright/test'

// Worktrees run tests concurrently, so a fixed port would collide (or reuse
// another worktree's server). Outside CI, ask the OS for a free port. The
// result is cached in the env because the config is reloaded in every worker.
async function getFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const srv = createServer()
        srv.unref()
        srv.on('error', reject)
        srv.listen(0, () => {
            const address = srv.address()
            const port =
                typeof address === 'object' && address ? address.port : 0
            srv.close(() => resolve(port))
        })
    })
}

if (!process.env.CI && !process.env.PLAYWRIGHT_TEST_PORT) {
    process.env.PLAYWRIGHT_TEST_PORT = String(await getFreePort())
}
// Outside CI a free port was picked above; CI (or a caller) can fix one.
const PORT = process.env.PLAYWRIGHT_TEST_PORT ?? 4242
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`

export default defineConfig({
    testDir: './test/e2e',
    timeout: 30_000,
    fullyParallel: true,
    use: { baseURL, serviceWorkers: 'block' },
    // Set PLAYWRIGHT_BASE_URL to test a deployed site or preview instead.
    webServer: process.env.PLAYWRIGHT_BASE_URL
        ? undefined
        : {
              command: `aube run preview --port ${PORT}`,
              url: baseURL,
              reuseExistingServer: !process.env.CI,
              timeout: 60_000,
              // Astro backgrounds `astro preview` in agentic environments,
              // which makes Playwright think the server exited early.
              env: { ASTRO_PREVIEW_BACKGROUND: 'false' },
          },
    projects: [
        { name: 'mobile-chrome', use: devices['Pixel 7'] },
        { name: 'desktop-chrome', use: devices['Desktop Chrome'] },
    ],
})
