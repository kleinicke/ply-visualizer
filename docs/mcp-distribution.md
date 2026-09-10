# 3D Visualizer distribution

Published listing links below describe 0.4.2. The development checkout targets
the next release; use the current [MCP guide](../packages/python/MCP.md) for
profiles, headless setup and the new Python import.

The public product name is **3D Visualizer**, the PyPI distribution is
`3d-visualizer` and the MCP identifier is `io.github.kleinicke/3d-visualizer`.
The GitHub repository remains `kleinicke/ply-visualizer` and the Python import
is `viz3d` (Python identifiers cannot begin with a digit). Releases through
0.4.1 used the old `ply-visualizer` distribution. The CLI commands are
`3d-visualizer`, `3d-visualizer-mcp` and `3d-visualizer-api`; the development
interface removes legacy aliases.

## Installation

```sh
uvx --from '3d-visualizer[mcp]==0.4.2' 3d-visualizer-mcp --root /absolute/data/directory
```

Local MCP needs Python 3.10+ (uv can manage Python). Inline interactive previews
need an MCP Apps host with WebGL; otherwise explicitly open the browser viewer.
The server has authenticated HTTP support for self-hosting, but the website is
not a publicly hosted MCP endpoint. No hosted endpoint should be entered in a
directory until it is actually deployed and tested.

## Registry metadata

- `server.json`: official registry entry, PyPI package, icon and required data
  directory. Registry runners use
  `uvx --with 'mcp>=2.2,<3' 3d-visualizer==0.4.2 mcp --root /absolute/data/directory`.
  The matching `3d-visualizer mcp` subcommand starts MCP, while `3d-visualizer`
  opens the CLI viewer.
- `packages/python/README.md`: ownership marker required in the published PyPI
  description. Changing this marker requires a new package release.
- `glama.json`: maintainer claim using Glama's published schema.
- `packages/mcpb`: MCPB 0.4 UV bundle for local desktop distribution. Build with
  `python3 scripts/build-mcp-bundle.py --out /tmp/3d-visualizer-0.4.2.mcpb`. The
  builder uses an explicit file allowlist and checks release versions.

Before each release, synchronize the Python version, diagnostics version,
`server.json`, MCPB manifest and pinned bundle dependency. Build and validate
wheel/sdist, smoke-test the launch commands, then publish the package before
publishing registry metadata. Credentials must remain outside version control.

## Listing copy

**Name:** 3D Visualizer

**Short description:** Inspect, compare and export point clouds, meshes and
calibrated depth data with inline 3D previews.

**Repository:** https://github.com/kleinicke/ply-visualizer

**Docs:**
https://github.com/kleinicke/ply-visualizer/blob/main/packages/python/MCP.md

**Package:** https://pypi.org/project/3d-visualizer/

**Suggested categories:** Data Visualization; Developer Tools; AI & Machine
Learning.

**Keywords:** 3D, point cloud, mesh, PLY, PCD, depth, disparity, COLMAP, NumPy,
PyTorch, MCP Apps.

**Example tasks:** inspect an unknown scan; isolate and export a labeled object;
compare prediction and target; convert depth using calibration from companion
files. Calibration is explicit, never inferred from image pixels alone.

## Submission destinations

- [Official registry](https://modelcontextprotocol.io/registry/quickstart):
  authenticate with `mcp-publisher login github`, then
  `mcp-publisher publish server.json`.
- [Glama](https://glama.ai/mcp/servers): sign in and choose Add Server, using
  the repository URL and listing copy above.
- [Smithery](https://smithery.ai/docs/build/publish): publish the local bundle
  with
  `smithery mcp publish /tmp/3d-visualizer-0.4.2.mcpb -n kleinicke/3d-visualizer`.
- [Awesome MCP Servers](https://github.com/punkpeye/awesome-mcp-servers): submit
  one alphabetical entry in Data Visualization via a pull request.
- [MCP.so](https://mcp.so/submit): submit via its form or a server-submission
  issue in `chatmcp/mcpso`.

Directory submissions pending moderation are not confirmed published listings.
Registry discovery does not automatically install the server into every client.

## Submission status (2026-09-10)

| Destination                                                                                              | Status                                                                              |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [Official MCP Registry](https://registry.modelcontextprotocol.io/?q=io.github.kleinicke%2F3d-visualizer) | Active, latest version 0.4.2; installs `3d-visualizer` from PyPI.                   |
| [PyPI](https://pypi.org/project/3d-visualizer/0.4.2/)                                                    | Published; wheel and sdist hashes verified against the release artifacts.           |
| [GitHub MCP bundle](https://github.com/kleinicke/ply-visualizer/releases/tag/python-v0.4.2)              | Published, with the validated MCPB 0.4 UV bundle attached.                          |
| [Awesome MCP Servers](https://github.com/punkpeye/awesome-mcp-servers/pull/14040)                        | Badge check passed; Glama publication follow-up posted; awaiting maintainer review. |
| [MCP.so](https://github.com/chatmcp/mcpso/issues/4009)                                                   | Submitted; MCP documentation follow-up posted; awaiting directory review.           |
| [Glama](https://glama.ai/mcp/servers/kleinicke/ply-visualizer)                                           | Glama confirmed release 0.1.0 published; container installs PyPI 0.4.2.             |
| [Smithery](https://smithery.ai/servers/f-t4mw/3d-visualizer)                                             | Released 0.4.2 MCPB uploaded; release status SUCCESS; listing metadata configured.  |
| [MCPServers.org](https://mcpservers.org/servers/kleinicke/ply-visualizer)                                | Approved and live; listing badge added to the README.                               |

The old `ply-visualizer` 0.4.1 release remains on PyPI. New releases use
`3d-visualizer`. The GitHub Actions trusted publisher is configured and verified
in PyPI for `kleinicke/ply-visualizer`, workflow `publish-python.yml`,
environment `pypi`. The matching GitHub environment exists. The existing 0.4.2
release used the local token; no new PyPI release was made during directory
registration.

## Awesome MCP Servers review requirement

PR #14040 requires a passing Glama listing and its score badge after the server
description. See [Glama Dockerfile and setup](../packages/glama/README.md). The
Glama configuration now installs the published Python MCP package, rather than
trying to execute the VS Code extension. Python 3.13, package version 0.4.2 and
an empty `/data` root are configured. No API keys are needed for introspection.
[Test 01a08821-df31-70e8-9f9b-c9f671781605](https://glama.ai/mcp/servers/kleinicke/ply-visualizer/admin/dockerfile/tests/01a08821-df31-70e8-9f9b-c9f671781605)
failed because uv protects its managed base interpreter. The configuration now
creates `/opt/visualizer-venv`, installs there and uses its absolute executable.
A fresh local installation passed MCP initialization and discovery of 27 tools.
[Replacement test](https://glama.ai/mcp/servers/kleinicke/ply-visualizer/admin/dockerfile/tests/01a0884a-112e-7345-aa44-95be189962c4)
was submitted with Build & Release. Glama subsequently confirmed publication of
its release 0.1.0 (the container still installs PyPI 0.4.2). The score badge was
added to the PR in commit `4395d1c8`, and its automated check passed. Follow-ups
were posted to
[Awesome MCP Servers](https://github.com/punkpeye/awesome-mcp-servers/pull/14040#issuecomment-5610790614)
and
[MCP.so](https://github.com/chatmcp/mcpso/issues/4009#issuecomment-5610790808).

The text-only MCP listing README is in `packages/mcp/README.md`; VS Code
demonstration media remains in the general README and is excluded from the
Python README and generated JetBrains description.

## Smithery bundle publication

The account namespace is `f-t4mw`; the public server ID is
`f-t4mw/3d-visualizer`. Release `a627abbe-bedb-47d3-966e-0593f74acb9b` contains
the unchanged 0.4.2 GitHub MCPB artifact. Smithery CLI 4.11.1 does not recognize
MCPB `server.type=uv` when inferring release metadata. Publication used a
temporary CLI correction mapping that type to the Python runtime; the bundle
manifest and contents were not changed. Until upstream supports this runtime,
use the documented multipart upload API with Python release metadata or an
equivalently corrected CLI. This is a local stdio distribution, not a new hosted
viewer endpoint.
