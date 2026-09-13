"""Regenerate native VS Code tool contributions from the authoritative MCP schemas.
Run with PYTHONPATH=packages/python and the Python MCP development dependencies.
"""
import asyncio
import json
import sys
from pathlib import Path
from mcp import Client
from viz3d.mcp_server import create_server

async def main():
    root = Path(__file__).resolve().parents[1]
    async with Client(create_server([root], tools='full')) as client:
        tools = (await client.list_tools()).tools
    contributions = []
    for tool in tools:
        if tool.name in ('read_viewer_data', 'submit_viewer_reply'):
            continue  # MCP App transport, not viewer operations.
        schema = tool.input_schema.copy()
        schema['properties'].pop('open_browser', None)
        schema['additionalProperties'] = False
        if 'calibration' in schema['properties']:
            schema['properties']['calibration']['description'] = 'Explicit calibration from files/context: dimensions and fx,fy,cx,cy in pixels; kind=z axial depth, depth ray range, disparity or inverse_depth. Defaults: camera_model=pinhole-ideal, convention=opencv, value_scale=1, value_offset=0, coefficients=[], invalid_values=[0]. camera_to_world is column-major. RGB must be aligned HxWx3 integer 0..255. Never guess calibration from pixels.'
        description = tool.description
        for old, new in [
            ('under configured roots', 'in the trusted VS Code workspace'),
            ('under configured --root directories', 'in the trusted VS Code workspace'),
            ('Paths must be under configured roots.', 'Paths resolve relative to the first workspace folder.'),
            ('Returns a persistent scene_id and local URL; inspect to verify loading.', 'Returns a persistent VS Code scene_id after loading.'),
            ('inline', 'in the VS Code viewer'),
            ('on the local MCP server', 'in the VS Code extension host'),
            ('Reuses the active inline viewer or explicit browser fallback.', 'Updates the same VS Code viewer tab.'),
            ('List scenes owned by this MCP process and their local viewer URLs.', 'List open VS Code viewer tabs, their scene_id, active/visible state and source URI. Includes manually opened tabs.'),
            ('viewer://depth-calibration', 'docs/depth-agent-workflows.md in the 3D Visualizer repository'),
        ]:
            description = description.replace(old, new)
        description = description.replace('Reuses the active in the VS Code viewer viewer or explicit browser fallback.', 'Updates the same VS Code viewer tab.')
        if tool.name == 'open_3d_url':
            description = 'Download 1..32 direct HTTP(S) 3D files (including gzip) into a native VS Code scene. Supply filename for extensionless URLs. Optional scene_id appends preserving the camera. No login, cookies, webpage extraction or implicit companion downloads. max_bytes bounds each download/decompressed file; one native load is limited to 256 MiB total. 120-second timeout.'
        if tool.name == 'open_3d_files':
            description += ' Maximum 256 MiB total per call; append additional batches with scene_id.'
        if tool.name == 'inspect_3d_scene':
            description = 'Inspect the selected VS Code viewer: camera position/rotation center, coordinate conventions, transforms, visibility, opacity/color, background/exposure, selections, attributes, bounds and actual renderer build ID. Summary is compact; request detail=full for complete state. Obtain scene_id from list_3d_scenes or an open tool.'
        if tool.name == 'capture_3d_view':
            description = 'Return an actual PNG image part of the selected VS Code viewer (maximum 1024 pixels per side), including enabled guides and legend. Use it to verify the visual result.'
        if tool.name == 'close_3d_scene':
            description = 'Close the selected VS Code viewer tab and release its renderer. Save/export any needed scene state first; source files are not deleted.'
        description += ' Uses the native VS Code viewer.'
        contributions.append(dict(name='viz3d_'+tool.name, toolReferenceName=tool.name,
            displayName='3D Visualizer: '+tool.name.replace('_',' '),
            canBeReferencedInPrompt=True, when='isWorkspaceTrusted', modelDescription=description,
            userDescription=description, inputSchema=schema))
    package = root / 'package.json'
    data = json.loads(package.read_text())
    if '--check' in sys.argv:
        if data['contributes'].get('languageModelTools') != contributions:
            raise SystemExit('Native VS Code tools are out of sync; regenerate contributions')
        print(f'{len(contributions)} native tools match MCP schemas')
        return
    data['contributes']['languageModelTools'] = contributions
    package.write_text(json.dumps(data, indent=2)+'\n')

asyncio.run(main())
