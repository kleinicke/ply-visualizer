/**
 * Lets a Node-side spec import engine modules that touch `*.svelte.js` state.
 * Outside the Svelte compiler `$state(...)` is an undefined global; as plain
 * identity the state objects behave like ordinary objects, which is all a
 * logic test needs. Import this before the module under test.
 */
const runes = globalThis as typeof globalThis & { $state?: <T>(value: T) => T };
runes.$state ??= value => value;
