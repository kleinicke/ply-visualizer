# Publishing ply-visualizer

Version `0.3.0` includes the MCP Apps preview. Publish releases only when
requested; intermediate development builds stay local.

The distribution name is `ply-visualizer`, the Python import is
`ply_visualizer`, and the CLI is `ply-viewer`. The initial release was `0.1.0`;
MCP support starts in `0.2.0`. Release artifacts include the browser engine,
WASM decoders and styles; users do not need Node.js.

## GitHub trusted publishing

The workflow is `.github/workflows/publish-python.yml`. It builds the shared
viewer, runs Python and browser tests, builds/validates both wheel and sdist,
and publishes the resulting artifacts using a short-lived PyPI identity.

For the first release, configure a pending publisher at
https://pypi.org/manage/account/publishing/ with:

| Field             | Value                |
| ----------------- | -------------------- |
| PyPI project name | `ply-visualizer`     |
| GitHub owner      | `kleinicke`          |
| Repository        | `ply-visualizer`     |
| Workflow filename | `publish-python.yml` |
| Environment       | `pypi`               |

Create the matching `pypi` environment in GitHub. Commit and push the release
changes, then run **Publish Python package** in GitHub Actions. No long-lived
token needs to be stored in the repository. For subsequent releases, increment
`project.version` in `pyproject.toml`; PyPI versions cannot be overwritten.

[PyPI trusted publishing](https://docs.pypi.org/trusted-publishers/creating-a-project-through-oidc/)

## Local publishing with the configured token

Local credentials are configured in the repository's `.local/.pypirc`, outside
the Python package directory. This file is Git-ignored and excluded from the VS
Code package, and has owner-only `0600` permissions. It uses the standard
`.pypirc` format with repository `pypi`, username `__token__`, and the token as
`password`. Do not copy its contents into documentation or source control.

Twine normally looks in `~/.pypirc`; pass `--config-file .local/.pypirc` to use
these project-local credentials. uv's own publishing command does not read this
file, so use Twine through `uvx` for this configuration.

Build and check the concrete artifacts first:

```sh
npm run build:python-viewer
uv build packages/python --out-dir packages/python/dist
uvx twine check --strict packages/python/dist/ply_visualizer-0.3.0*
```

When publication is requested, run this from the repository root to publish only
the checked, versioned artifacts:

```sh
uvx twine upload --non-interactive --config-file .local/.pypirc --repository pypi packages/python/dist/ply_visualizer-0.3.0-py3-none-any.whl packages/python/dist/ply_visualizer-0.3.0.tar.gz
```

Never place the token in source control or documentation. Verify the project
page after upload and install the published version into a clean environment:

```sh
uvx --from ply-visualizer==0.3.0 ply-viewer --help
```

Publishing uses the configured PyPI account credentials. A missing project page
alone does not guarantee that PyPI will accept a particular name.

## Agent integrations before publication

PyPI publication is optional for MCP and other agent integrations. Local agents
can use an installed local wheel or checkout, and a remote MCP service can run
from a private deployment. A public package makes installation and distribution
easier, but it does not itself expose MCP tools or install them into an agent.
