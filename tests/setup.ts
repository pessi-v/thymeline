/**
 * Vitest setup file
 * Makes Temporal available in the test environment via polyfill
 */

import { Temporal } from '@js-temporal/polyfill';

// Make Temporal available globally for tests
// In production, native Temporal will be used
(globalThis as any).Temporal = Temporal;
