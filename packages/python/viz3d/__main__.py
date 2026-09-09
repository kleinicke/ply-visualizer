import argparse
import sys

from .session import show


def main():
    if sys.argv[1:2] == ["doctor"]:
        from .doctor import main as doctor_main
        raise SystemExit(doctor_main(sys.argv[2:]))
    # Registry runners infer the executable from the distribution name.
    if sys.argv[1:2] == ["mcp"]:
        from .mcp_server import main as mcp_main
        return mcp_main(sys.argv[2:])
    parser = argparse.ArgumentParser(description="View local 3D files in your browser. Use doctor for diagnostics or mcp for agents.")
    parser.add_argument("files", nargs="+", help="3D files to display together")
    parser.add_argument("--no-browser", action="store_true", help="Print the local URL without opening it")
    args = parser.parse_args()
    try:
        with show(*args.files, open_browser=not args.no_browser) as session:
            print(session.url, flush=True)
            print("Keep this process running. Press Ctrl+C to stop.", file=sys.stderr)
            session.wait()
    except KeyboardInterrupt:
        pass
    except (OSError, ValueError, RuntimeError) as error:
        parser.exit(1, f"3d-visualizer: {error}\n")


if __name__ == "__main__":
    main()
