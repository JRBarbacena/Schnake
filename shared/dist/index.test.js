import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
describe('Monorepo Setup', () => {
    it('should have vitest working', () => {
        expect(1 + 1).toBe(2);
    });
    it('should have fast-check available', () => {
        fc.assert(fc.property(fc.integer(), fc.integer(), (a, b) => {
            return a + b === b + a;
        }));
    });
});
//# sourceMappingURL=index.test.js.map