import argparse
import sys

from .session import show


def main():
    parser = argparse.ArgumentParser(description="View local 3D files in your browser.")
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
        parser.exit(1, f"ply-viewer: {error}\n")


if __name__ == "__main__":
    main()
