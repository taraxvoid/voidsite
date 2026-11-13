import cloudflare from '@astrojs/cloudflare'
import react from '@astrojs/react'
import { d1, r2 } from '@emdash-cms/cloudflare'
import { cloudflareEmail } from '@emdash-cms/cloudflare/plugins'
import { defineConfig } from 'astro/config'
import emdash from 'emdash/astro'
import pkg from './package.json' with { type: 'json' }
import { siteConfig } from './src/site.config.ts'

export default defineConfig({
    output: 'server',
    adapter: cloudflare(),
    image: {
        layout: 'constrained',
        responsiveStyles: true,
    },
    integrations: [
        react(),
        emdash({
            database: d1({ binding: 'DB', session: 'auto' }),
            storage: r2({ binding: 'MEDIA' }),
            // Sign-in links and invites, over the EMAIL send_email binding.
            plugins: [
                cloudflareEmail({
                    from: { email: siteConfig.mailFrom, name: siteConfig.name },
                    replyTo: siteConfig.contactEmail,
                }),
            ],
        }),
    ],
    devToolbar: { enabled: false },
    vite: {
        // Shown on the legal pages. CI sets GIT_SHA; local builds say 'dev'.
        define: {
            __BUILD_VERSION__: JSON.stringify(pkg.version),
            __BUILD_DATE__: JSON.stringify(
                new Date().toISOString().slice(0, 10),
            ),
            __BUILD_SHA__: JSON.stringify(
                (process.env.GIT_SHA ?? 'dev').slice(0, 7),
            ),
        },
    },
})
