# Publishing ply-visualizer

The distribution name is `ply-visualizer`, the Python import is
`ply_visualizer`, and the CLI is `ply-viewer`. The initial version is `0.1.0`.
Release artifacts include the browser engine, WASM decoders and styles; users do
not need Node.js.

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

## Local publishing with an existing token

Build and check the concrete artifacts first:

```sh
npm run build:python-viewer
uv build packages/python --out-dir packages/python/dist
uvx twine check --strict packages/python/dist/ply_visualizer-0.1.0*
```

With a PyPI token already configured as `UV_PUBLISH_TOKEN` in the publishing
process, publish only these versioned artifacts:

```sh
uv publish packages/python/dist/ply_visualizer-0.1.0-py3-none-any.whl packages/python/dist/ply_visualizer-0.1.0.tar.gz
```

Never place the token in source control or documentation. Verify the project
page after upload and install the published version into a clean environment:

```sh
uvx --from ply-visualizer==0.1.0 ply-viewer --help
```

The first upload still requires authorization through a PyPI token or a
configured trusted publisher. A missing project page alone does not guarantee
that PyPI will accept a particular name.
