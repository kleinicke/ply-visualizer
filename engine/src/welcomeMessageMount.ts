import { mount } from 'svelte';
import WelcomeMessage from './components/WelcomeMessage.svelte';

/**
 * Phase 2 leaf island (docs/SVELTE_MIGRATION_PLAN.md): the welcome message is
 * driven entirely by state/ui.svelte.ts's showWelcomeMessage field now.
 */
export function mountWelcomeMessage(onAddCloud: () => void): void {
  const target = document.getElementById('welcome-message-mount');
  if (!target) {
    return;
  }
  mount(WelcomeMessage, { target, props: { onAddCloud } });
}
