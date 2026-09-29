"""The website bridge requires explicit pairing and returns renderer replies."""
import asyncio
from http.server import ThreadingHTTPServer
import json
import threading
import unittest
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlsplit
from urllib.request import Request, urlopen

from mcp import Client
from viz3d.browser_mcp import BrowserTabManager, make_handler
from viz3d.mcp_server import BROWSER_TOOLS, create_server


class BrowserPairingTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.manager = BrowserTabManager()
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(self.manager, 0))
        # The handler validates the actual Host port, so rebuild it after binding.
        self.server.RequestHandlerClass = make_handler(self.manager, self.server.server_port)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    async def asyncTearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def request(self, path, payload=None, origin="https://3d.f-kleinicke.de"):
        data = None if payload is None else json.dumps(payload).encode()
        request = Request(f"http://127.0.0.1:{self.server.server_port}{path}", data=data,
                          headers={"Origin": origin, "Content-Type": "application/json"})
        with urlopen(request, timeout=3) as response:
            return json.load(response)

    async def test_pairing_gate_and_command_round_trip(self):
        pair = self.manager.new_website_session()
        self.assertTrue(pair["url"].startswith("https://3d.f-kleinicke.de/#"))
        fragment = parse_qs(urlsplit(pair["url"]).fragment)
        scene_id = fragment["agent_scene"][0]
        token = fragment["agent_token"][0]
        self.assertEqual(scene_id, pair["scene_id"])
        query = f"?scene_id={scene_id}&token={token}&renderer_id=tab-1"
        with self.assertRaises(HTTPError) as blocked:
            await asyncio.to_thread(self.request, f"/command{query}", None, "https://attacker.example")
        self.assertEqual(blocked.exception.code, 403)
        with self.assertRaises(HTTPError) as wrong:
            await asyncio.to_thread(self.request, f"/command?scene_id={scene_id}&token=wrong&renderer_id=tab-1")
        self.assertEqual(wrong.exception.code, 404)
        request_task = asyncio.create_task(asyncio.to_thread(
            self.manager.get(scene_id)._bridge.request, "navigate", {"action": "fit"}))
        command = None
        for _ in range(30):
            command = await asyncio.to_thread(self.request, f"/command{query}")
            if command:
                break
            await asyncio.sleep(0.02)
        self.assertEqual(command["operation"], "navigate")
        result = await asyncio.to_thread(self.request, f"/result{query}",
                                         {"id": command["id"], "renderer_id": "tab-1", "result": {"camera": "fit"}})
        self.assertTrue(result["accepted"])
        self.assertEqual(await request_task, {"camera": "fit"})
        await asyncio.to_thread(self.request, f"/unpair{query}", {})
        with self.assertRaises(HTTPError) as revoked:
            await asyncio.to_thread(self.request, f"/command{query}")
        self.assertEqual(revoked.exception.code, 404)

    async def test_browser_profile_exposes_only_tab_tools(self):
        async with Client(create_server([], tools="browser", scene_manager=self.manager)) as client:
            names = {tool.name for tool in (await client.list_tools()).tools}
            self.assertEqual(names, BROWSER_TOOLS)
            result = await client.call_tool("pair_3d_website", {})
            self.assertFalse(result.is_error)
            self.assertIn("#agent_scene=", result.structured_content["url"])
            existing = await client.call_tool("pair_3d_website", {
                "current_url": "https://3d.f-kleinicke.de/?source=https%3A%2F%2Fexample.com%2Fscan.ply"
            })
            self.assertFalse(existing.is_error)
            self.assertTrue(existing.structured_content["url"].startswith(
                "https://3d.f-kleinicke.de/?source=https%3A%2F%2Fexample.com%2Fscan.ply#"))


if __name__ == "__main__":
    unittest.main()
