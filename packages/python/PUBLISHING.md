# Publishing 3D Visualizer

The development version is defined in `pyproject.toml`; the last published
release is `0.4.2`. Publish releases only when requested; intermediate
development builds stay local.

The distribution name is `3d-visualizer`, the Python import is `viz3d`, and the
CLI is `3d-visualizer`. The initial release was `0.1.0`; MCP support starts in
`0.2.0`. Release artifacts include the browser engine, WASM decoders and styles;
users do not need Node.js.

## GitHub trusted publishing

The workflow is `.github/workflows/publish-python.yml`. It builds the shared
viewer, runs Python and browser tests, builds/validates both wheel and sdist,
and publishes the resulting artifacts using a short-lived PyPI identity.

Sign in as a project owner and configure the existing project at
https://pypi.org/manage/project/3d-visualizer/settings/publishing/ with:

| Field             | Value                |
| ----------------- | -------------------- |
| PyPI project name | `3d-visualizer`      |
| GitHub owner      | `kleinicke`          |
| Repository        | `ply-visualizer`     |
| Workflow filename | `publish-python.yml` |
| Environment       | `pypi`               |

Create the matching `pypi` environment in GitHub. Commit and push the release
changes, then run **Publish Python package** in GitHub Actions. No long-lived
token needs to be stored in the repository. For subsequent releases, increment
`project.version` in `pyproject.toml`; PyPI versions cannot be overwritten.

[PyPI trusted publishing](https://docs.pypi.org/trusted-publishers/adding-a-publisher/)

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
release_version=$(python3 -c 'import tomllib; print(tomllib.load(open("packages/python/pyproject.toml", "rb"))["project"]["version"])')
uvx twine check --strict "packages/python/dist/3d_visualizer-${release_version}-py3-none-any.whl" "packages/python/dist/3d_visualizer-${release_version}.tar.gz"
```

When publication is requested, run this from the repository root to publish only
the checked, versioned artifacts:

```sh
uvx twine upload --non-interactive --config-file .local/.pypirc --repository pypi "packages/python/dist/3d_visualizer-${release_version}-py3-none-any.whl" "packages/python/dist/3d_visualizer-${release_version}.tar.gz"
```

Never place the token in source control or documentation. Verify the project
page after upload and install the published version into a clean environment:

```sh
uvx --from "3d-visualizer==${release_version}" 3d-visualizer --help
```

Publishing uses the configured PyPI account credentials. A missing project page
alone does not guarantee that PyPI will accept a particular name.

## Agent integrations before publication

PyPI publication is optional for MCP and other agent integrations. Local agents
can use an installed local wheel or checkout, and a remote MCP service can run
from a private deployment. A public package makes installation and distribution
easier, but it does not itself expose MCP tools or install them into an agent.

Before release, run `python3 scripts/generate-agent-quickstart.py` and
`python3 scripts/check-agent-docs.py --wheel /path/to/built.whl`. The latter
executes only the generated quickstart, against a clean tool installation of the
wheel, and verifies a headless capture through the documented MCP config. Never
run arbitrary documentation command blocks as a CI shell script.
