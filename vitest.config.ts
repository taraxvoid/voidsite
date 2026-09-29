import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        passWithNoTests: true,
        include: ['test/{unit,pages}/**/*.test.ts'],
        isolate: false,
    },
})
