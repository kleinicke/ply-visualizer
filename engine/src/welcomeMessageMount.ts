import { mount } from 'svelte';
import { isIdeHost } from './hosts/ideEnvironment';
import WelcomeMessage from './components/WelcomeMessage.svelte';

/**
 * Phase 2 leaf island (docs/SVELTE_MIGRATION_PLAN.md): the welcome message is
 * driven entirely by state/ui.svelte.ts's showWelcomeMessage field now.
 */
export function mountWelcomeMessage(
  onAddCloud: () => void,
  onLoadGuidedExample: () => Promise<void>,
  onLoadBasicExample: () => Promise<void>
): void {
  // Never create the website welcome/example DOM in an IDE, even while loading.
  if (isIdeHost) {return;}
  const target = document.getElementById('welcome-message-mount');
  if (!target) {
    return;
  }
  mount(WelcomeMessage, {
    target,
    props: { onAddCloud, onLoadGuidedExample, onLoadBasicExample },
  });
}
