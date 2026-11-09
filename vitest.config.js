import { defineConfig } from 'vitest/config';
import path from 'path';
export default defineConfig({
    test: {
        globals: true,
        include: ['shared/**/*.test.ts', 'server/**/*.test.ts', 'client/**/*.test.ts'],
    },
    resolve: {
        alias: {
            '@snake-king/shared': path.resolve(__dirname, 'shared/src'),
        },
    },
});
//# sourceMappingURL=vitest.config.js.map