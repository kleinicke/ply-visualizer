import { executeAgentCommand, type AgentViewerHost } from './agentBridge';

const endpoint = 'http://127.0.0.1:8767';
const rendererId = crypto.randomUUID();

function localFetch(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${endpoint}${path}`, {
    ...options,
    targetAddressSpace: 'loopback',
  } as RequestInit);
}

/**
 * An agent-created fragment pairs this tab without adding controls to the UI.
 * Fragment navigation on an already open tab preserves its in-memory scene.
 */
export function installBrowserAgent(host: AgentViewerHost): void {
  let generation = 0;

  async function fromFragment(): Promise<void> {
    const values = new URLSearchParams(location.hash.slice(1));
    const sceneId = values.get('agent_scene');
    const token = values.get('agent_token');
    if (!sceneId && !token) {return;}
    // A URL fragment is never sent to the website server; remove it from the
    // address bar and browser history as soon as this document has read it.
    history.replaceState(history.state, '', `${location.pathname}${location.search}`);
    if (!sceneId || !token || !/^[0-9a-f]{32}$/.test(sceneId) || !/^[\w-]{40,}$/.test(token)) {
      console.warn('Invalid 3D agent link.');
      return;
    }

    const current = ++generation;
    const sessionPath = (path: string) =>
      `${path}?${new URLSearchParams({ scene_id: sceneId, token, renderer_id: rendererId })}`;
    let previousReply: { id: string; result?: unknown; error?: string } | undefined;

    while (generation === current) {
      try {
        const response = await localFetch(sessionPath('/command'));
        if (!response.ok) {throw new Error(`Local agent bridge returned ${response.status}`);}
        const command = await response.json();
        if (command && generation === current) {
          if (previousReply?.id !== command.id) {
            previousReply = await executeAgentCommand(host, command);
          }
          const reply = await localFetch(sessionPath('/result'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...previousReply, renderer_id: rendererId }),
          });
          if (!reply.ok) {throw new Error(`Local agent bridge returned ${reply.status}`);}
        }
        await new Promise(resolve => setTimeout(resolve, command ? 0 : 350));
      } catch (error) {
        if (generation === current) {console.warn('3D agent connection stopped:', error);}
        return;
      }
    }
  }

  window.addEventListener('hashchange', () => void fromFragment());
  void fromFragment();
}
