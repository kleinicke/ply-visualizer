"""Explicit, bounded HTTP downloads for the local MCP process (not the widget)."""
import gzip
import re
from email.message import Message
from pathlib import Path
import tempfile
import time
from urllib.parse import unquote, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from urllib.error import URLError
from .session import FORMATS, ViewerSession


def _url(value):
    parsed = urlsplit(value)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname:
        raise ValueError('Provide a direct http:// or https:// file URL')
    if parsed.username or parsed.password:
        raise ValueError('Credentials in URLs are not supported; use a signed download URL')
    return value


class _Redirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        _url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def open_remote(url, filename=None, max_bytes=256 * 1024 * 1024):
    """Own the downloaded file for exactly the returned scene's lifetime."""
    _url(url)
    temporary = tempfile.TemporaryDirectory(prefix='ply-remote-')
    deadline = time.monotonic() + 120
    try:
        opener = build_opener(_Redirects())
        request = Request(url, headers={'User-Agent': 'ply-visualizer', 'Accept-Encoding': 'identity'})
        try:
            with opener.open(request, timeout=30) as response:
                if response.headers.get_content_type() in ('text/html', 'application/xhtml+xml'):
                    raise ValueError('URL returned a webpage; use a direct 3D file download URL')
                disposition = Message()
                disposition['Content-Disposition'] = response.headers.get('Content-Disposition', '')
                name = filename or disposition.get_filename() or unquote(urlsplit(response.url).path.rsplit('/', 1)[-1])
                # Only a basename is accepted; the server controls no local path.
                name = str(name or '').replace('\\', '/').rsplit('/', 1)[-1]
                name = re.sub(r'[<>:"|?*\x00-\x1f]', '_', name).strip()
                if not name:
                    raise ValueError('Supply filename with a supported extension for this download')
                if name.lower().endswith('.gz'): name = name[:-3]
                if Path(name).suffix.lower() not in FORMATS:
                    raise ValueError('URL must return a supported 3D file, not a webpage; supply filename when the URL has no extension')
                length = response.headers.get('Content-Length')
                if length and int(length) > max_bytes: raise ValueError('Download exceeds max_bytes')
                raw = Path(temporary.name) / 'download.raw'
                total = 0
                with raw.open('wb') as output:
                    while chunk := response.read(min(1024 * 1024, max_bytes - total + 1)):
                        total += len(chunk)
                        if total > max_bytes: raise ValueError('Download exceeds max_bytes')
                        if time.monotonic() > deadline: raise ValueError('Download exceeded 120 seconds')
                        output.write(chunk)
        except URLError as error:
            raise ValueError(f'Download failed: {error.reason}') from error
        if not total: raise ValueError('Downloaded file is empty')
        target = Path(temporary.name) / name
        with raw.open('rb') as source:
            compressed = source.read(2) == b'\x1f\x8b'
        if compressed:
            total = 0
            try:
                with gzip.open(raw, 'rb') as source, target.open('wb') as output:
                    while chunk := source.read(min(1024 * 1024, max_bytes - total + 1)):
                        total += len(chunk)
                        if total > max_bytes: raise ValueError('Decompressed file exceeds max_bytes')
                        if time.monotonic() > deadline: raise ValueError('Download exceeded 120 seconds')
                        output.write(chunk)
            except (gzip.BadGzipFile, EOFError) as error:
                raise ValueError('Invalid gzip download') from error
            raw.unlink()
        else:
            raw.replace(target)
        return ViewerSession([target], temporary=temporary)
    except BaseException:
        temporary.cleanup()
        raise
