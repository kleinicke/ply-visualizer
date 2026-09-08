# Documentation

Use these guides to choose a feature, find its controls, and understand its
limits. They describe the current repository; an installed release may not yet
include every feature, especially the MCP development tools.

## Start here

| Goal                                              | Guide                                                |
| ------------------------------------------------- | ---------------------------------------------------- |
| Open a file and learn the viewer                  | [Getting started](getting-started.md)                |
| Find a feature and its controls                   | [Viewer features and workflows](viewer-guide.md)     |
| Find a VS Code command                            | [Command reference](vscode-commands.md)              |
| Load files from the internet                      | [Remote files](remote-files.md)                      |
| View textured models and animation clips          | [Models and animations](models-and-animations.md)    |
| Use Python, NumPy, PyTorch, or notebooks          | [Python and CLI guide](../packages/python/README.md) |
| Connect an AI agent                               | [MCP setup](../packages/python/MCP.md)               |
| Inspect, select, compare, or export with an agent | [MCP workflows](mcp-workflows.md)                    |
| Look up an MCP tool and its arguments             | [MCP tool reference](mcp-tools.md)                   |
| Try representative model files                    | [Model fixtures](model-fixtures.md)                  |

## Platform guides

The shared viewer is used by several hosts. File access, installation, and
available inputs differ; MCP tools are provided by the Python MCP server.

- [VS Code and website quick start](getting-started.md)
- [Python, CLI, and local notebooks](../packages/python/README.md)
- [JetBrains preview](../jetbrains/README.md)
- [Desktop preview](../apps/desktop/README.md)

## Developer notes

| Topic                                             | Document                                          |
| ------------------------------------------------- | ------------------------------------------------- |
| Repository structure and contribution conventions | [CLAUDE.md](../CLAUDE.md)                         |
| Performance measurement                           | [Performance method](performance-method.md)       |
| Renderer backend status                           | [WebGPU readiness](WEBGPU_READINESS.md)           |
| Image decoder integration                         | [Image decoder backend](image-decoder-backend.md) |
| UI migration                                      | [Svelte migration plan](SVELTE_MIGRATION_PLAN.md) |
| Product architecture planning                     | [Unified product plan](UNIFIED_PRODUCT_PLAN.md)   |
| Planned, implemented, and discarded work          | [Backlog](BACKLOG.md)                             |
| Python releases                                   | [Publishing](../packages/python/PUBLISHING.md)    |
| JetBrains releases                                | [Release process](../jetbrains/RELEASE.md)        |

Planning documents can describe unfinished work; use the user guides and the
installed tool catalog to determine what is available.

## Keeping documentation current

Put feature instructions in a focused guide and link it here. Keep the main
project README an overview. For a feature change, document where to find it, a
short workflow, the result, and any limitations that affect usage.

The MCP reference is generated directly from server signatures and docstrings:

```sh
python3 scripts/generate-mcp-docs.py
python3 scripts/generate-mcp-docs.py --check
```

Update the walkthroughs separately when workflows or behavior change. No docs
website build is required: all pages and relative links work on GitHub.
