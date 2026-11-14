#!/usr/bin/env python3
"""DesignWizard.ai by DynamiteAgile(TM) - local server (Python >= 3.9, standard library only).

    python designwizard.py [--port 8070] [--no-browser] [--data DIR]

Serves the static app from web/ on http://127.0.0.1:<port> (loopback only), stores projects
in the data directory (default <repo>/data/, git-ignored) and proxies the Onshape REST API
(server/onshape.py) because Onshape does not allow calls straight from a browser.

Security model: bound to 127.0.0.1; the Host header must be 127.0.0.1/localhost on the
served port (DNS-rebinding); every POST/PUT/DELETE must carry `X-DW-Request: 1` and an
Origin (or Referer) of this server (CSRF); strict Content-Security-Policy on every response.
The Onshape secret key never leaves server/onshape.py and the credentials file (mode 600).
"""
from __future__ import annotations

import argparse
import base64
import binascii
import importlib.util
import json
import re
import shutil
import sys
import threading
import traceback
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

ROOT = Path(__file__).resolve().parent
WEB = ROOT / "web"
APP, VERSION = "DesignWizard.ai", "0.1.0"
MAX_FILE = 60 * 1024 * 1024          # raw file / project body limit
MAX_IMPORT = 85 * 1024 * 1024        # JSON body of /api/onshape/import (base64 of 60 MB)
MAX_JSON = 2 * 1024 * 1024


def _load(name: str):
    """Import server/<name>.py by path (no package needed, no clash with other `server` modules)."""
    spec = importlib.util.spec_from_file_location("dw_" + name, ROOT / "server" / (name + ".py"))
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


store_mod = _load("store")
onshape_mod = _load("onshape")

SECURITY_HEADERS = (
    ("Content-Security-Policy",
     "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; "
     "img-src 'self' data: blob:; worker-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; "
     "base-uri 'self'; form-action 'self'"),
    ("X-Content-Type-Options", "nosniff"),
    ("Referrer-Policy", "no-referrer"),
)
MIME = {
    ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".wasm": "application/wasm",
    ".pdf": "application/pdf", ".step": "model/step", ".stp": "model/step", ".png": "image/png",
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
    ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8",
    ".map": "application/json; charset=utf-8", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
}
NO_STORE = {"Cache-Control": "no-store"}
OID = r"([A-Za-z0-9]{1,64})"          # Onshape id segment
PID = r"([A-Za-z0-9_\-]{1,64})"       # project id segment


class ApiError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status, self.message = status, message


class Handler(BaseHTTPRequestHandler):
    server_version = "DesignWizard/" + VERSION
    sys_version = ""
    protocol_version = "HTTP/1.1"
    timeout = 120

    # ---------- plumbing ----------
    def log_message(self, fmt, *args):  # quiet by default; never logs bodies or headers
        if self.server.verbose:
            sys.stderr.write("%s %s\n" % (self.log_date_time_string(), fmt % args))

    def end_headers(self):
        for key, value in SECURITY_HEADERS:
            self.send_header(key, value)
        super().end_headers()

    def _send(self, status: int, body: bytes = b"", ctype: str = "application/json; charset=utf-8", extra=None):
        if not self._consumed and (self._length() != 0 or self.headers.get("Transfer-Encoding")):
            self.close_connection = True  # unread request body: do not reuse the connection
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        for key, value in (extra or NO_STORE).items():
            self.send_header(key, value)
        if self.close_connection:
            self.send_header("Connection", "close")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _json(self, status: int, obj: dict):
        self._send(status, json.dumps(obj, ensure_ascii=False).encode("utf-8"))

    def _length(self) -> int:
        try:
            return int(self.headers.get("Content-Length") or 0)
        except ValueError:
            return -1

    def _body(self, limit: int) -> bytes:
        length = self._length() if self.headers.get("Content-Length") is not None else -1
        if length < 0:
            raise ApiError(411, "Requête sans Content-Length. Correctif : envoyez le corps avec sa longueur "
                                "(fetch le fait automatiquement).")
        if length > limit:
            raise ApiError(413, f"Contenu trop volumineux (limite {limit // (1024 * 1024)} Mo). Correctif : réduisez "
                                "ou découpez le fichier.")
        data = self.rfile.read(length)
        self._consumed = True
        if len(data) != length:
            raise ApiError(400, "Corps de requête incomplet. Correctif : renvoyez la requête.")
        return data

    def _json_body(self, limit: int = MAX_JSON) -> dict:
        try:
            doc = json.loads(self._body(limit).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            raise ApiError(400, "Corps JSON invalide. Correctif : envoyez un objet JSON encodé en UTF-8.")
        if not isinstance(doc, dict):
            raise ApiError(400, "Corps JSON invalide : un objet est attendu. Correctif : envoyez {...}.")
        return doc

    def _guard(self, write: bool, api: bool):
        port = self.server.server_address[1]
        hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}
        if (self.headers.get("Host") or "").strip().lower() not in hosts:
            raise ApiError(403, "En-tête Host refusé (protection DNS-rebinding). Correctif : ouvrez l'application à "
                                f"l'adresse http://127.0.0.1:{port}/.")
        ours = {"http://" + h for h in hosts}
        origin = self.headers.get("Origin")
        if origin is None and self.headers.get("Referer"):
            ref = urlsplit(self.headers["Referer"])
            origin = f"{ref.scheme}://{ref.netloc}"
        origin = origin.strip().lower() if origin else None
        if write:
            if self.headers.get("X-DW-Request") != "1" or origin not in ours:
                raise ApiError(403, "Requête d'écriture refusée (protection CSRF) : en-tête X-DW-Request ou Origin "
                                    "manquant. Correctif : utilisez l'application servie par ce serveur "
                                    f"(http://127.0.0.1:{port}/).")
        elif api and ((origin and origin not in ours) or self.headers.get("Sec-Fetch-Site") == "cross-site"):
            raise ApiError(403, "Requête venant d'un autre site refusée. Correctif : utilisez l'application servie "
                                f"par ce serveur (http://127.0.0.1:{port}/).")

    def _handle(self):
        self._consumed = False
        try:
            url = urlsplit(self.path)
            query = {k: v[-1] for k, v in parse_qs(url.query, keep_blank_values=True).items()}
            write = self.command in ("POST", "PUT", "DELETE")
            api = url.path.startswith("/api/")
            self._guard(write, api)
            if api:
                self._api(url.path, query)
            elif write:
                raise ApiError(405, "Méthode non autorisée sur un fichier statique. Correctif : utilisez GET.")
            else:
                self._static(url.path)
        except (ApiError, store_mod.StoreError, onshape_mod.OnshapeError) as e:
            self._json(e.status, {"ok": False, "error": e.message})
        except (BrokenPipeError, ConnectionResetError):
            self.close_connection = True
        except Exception as e:  # noqa: BLE001 - last-resort guard, details go to the console only
            traceback.print_exc()
            self._json(500, {"ok": False, "error": f"Erreur interne du serveur local ({type(e).__name__}). Correctif : "
                                                   "relancez « python designwizard.py » ; le détail est affiché "
                                                   "dans la console du serveur."})

    do_GET = do_HEAD = do_POST = do_PUT = do_DELETE = _handle

    def do_OPTIONS(self):  # no CORS: preflights from other origins must fail
        self._consumed = False
        self._json(403, {"ok": False, "error": "Requête cross-origin refusée. Correctif : utilisez l'application "
                                               "servie par ce serveur."})

    # ---------- static files ----------
    def _static(self, raw_path: str):
        path = unquote(raw_path)
        parts = path.split("/")
        if "\x00" in path or "\\" in path or ".." in parts or any(p.startswith(".") for p in parts if p):
            raise ApiError(403, "Chemin refusé. Correctif : demandez un fichier de l'application.")
        target = WEB.joinpath(*[p for p in parts if p])
        if target.is_dir():
            if not path.endswith("/"):
                return self._send(301, b"", "text/plain; charset=utf-8", {"Location": raw_path + "/", **NO_STORE})
            target = target / "index.html"
        try:
            real = target.resolve()
            real.relative_to(WEB.resolve())
        except (OSError, ValueError):
            raise ApiError(403, "Chemin refusé. Correctif : demandez un fichier de l'application.")
        if not real.is_file():
            return self._send(404, f"404 - fichier introuvable : {path}\n".encode("utf-8"), "text/plain; charset=utf-8")
        cache = {"Cache-Control": "public, max-age=86400"} if path.startswith("/vendor/") else NO_STORE
        self._file(real, MIME.get(real.suffix.lower(), "application/octet-stream"), cache)

    def _file(self, path: Path, ctype: str, extra: dict):
        with open(path, "rb") as f:
            size = path.stat().st_size
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(size))
            for key, value in extra.items():
                self.send_header(key, value)
            self.end_headers()
            if self.command != "HEAD":
                shutil.copyfileobj(f, self.wfile, 256 * 1024)

    # ---------- JSON API ----------
    def _api(self, path: str, q: dict):
        method = "GET" if self.command == "HEAD" else self.command
        allowed = False
        for verb, pattern, name in ROUTES:
            m = pattern.fullmatch(path)
            if not m:
                continue
            allowed = True
            if verb == method:
                out = getattr(self, name)(q, *[unquote(g) for g in m.groups()])
                if out is not None:
                    self._json(200, {"ok": True, **out})
                return
        if allowed:
            raise ApiError(405, f"Méthode {self.command} non autorisée sur {path}. Correctif : consultez la liste des "
                                "endpoints dans docs/ONSHAPE.md.")
        raise ApiError(404, f"Endpoint inconnu : {path}. Correctif : vérifiez l'URL appelée.")

    @property
    def store(self):
        return self.server.store

    @property
    def onshape(self):
        return self.server.onshape

    def a_ping(self, q):
        st = self.onshape.status()
        info = {"connected": st["connected"]}
        if st["connected"]:
            info["user"] = (st.get("user") or {}).get("name") or ""
        return {"app": APP, "version": VERSION, "mode": "server", "onshape": info}

    def a_settings_get(self, q):
        return {"settings": self.store.get_settings()}

    def a_settings_put(self, q):
        return {"settings": self.store.put_settings(self._json_body().get("settings"))}

    def a_projects(self, q):
        return {"projects": self.store.list_projects()}

    def a_project_get(self, q, pid):
        return {"project": self.store.get_project(pid)}

    def a_project_put(self, q, pid):
        self.store.check_id(pid)
        return self.store.put_project(pid, self._json_body(MAX_FILE).get("project"))

    def a_project_delete(self, q, pid):
        return self.store.delete_project(pid)

    def a_files(self, q, pid):
        return {"files": self.store.list_files(pid)}

    def a_file_get(self, q, pid, name):
        f = self.store.get_file(pid, name)
        self._file(f, MIME.get(f.suffix.lower(), "application/octet-stream"),
                   {**NO_STORE, "Content-Disposition": "attachment"})

    def a_file_put(self, q, pid, name):
        self.store.check_id(pid)
        self.store.check_file(name)
        return self.store.put_file(pid, name, self._body(MAX_FILE))

    def a_os_status(self, q):
        return self.onshape.status(verify=q.get("verify") in ("1", "true"))

    def a_os_connect(self, q):
        b = self._json_body()
        return self.onshape.connect(b.get("accessKey"), b.get("secretKey"), b.get("baseUrl"))

    def a_os_disconnect(self, q):
        if self.headers.get("Content-Length"):
            self._body(MAX_JSON)
        return self.onshape.disconnect()

    def a_os_documents(self, q):
        return self.onshape.documents(q.get("q", ""), q.get("limit"), q.get("offset"), q.get("filter"))

    def a_os_document_create(self, q):
        b = self._json_body()
        return self.onshape.create_document(b.get("name"), b.get("description"), bool(b.get("public")))

    def a_os_workspaces(self, q, did):
        return self.onshape.workspaces(did)

    def a_os_elements(self, q, did, wid):
        return self.onshape.elements(did, wid, q.get("type"))

    def a_os_import(self, q):
        b = self._json_body(MAX_IMPORT)
        try:
            data = base64.b64decode(b.get("contentBase64") or "", validate=True)
        except (binascii.Error, ValueError, TypeError):
            raise ApiError(400, "contentBase64 invalide. Correctif : encodez le fichier en base64 standard.")
        if len(data) > MAX_FILE:
            raise ApiError(413, "Fichier trop volumineux (limite 60 Mo). Correctif : réduisez le fichier.")
        opts = b.get("options") if isinstance(b.get("options"), dict) else None
        return self.onshape.import_file(b.get("did"), b.get("wid"), b.get("filename"), data, b.get("kind"),
                                        opts, b.get("elementId"))

    def a_os_translation(self, q, tid):
        return self.onshape.translation(tid)

    def a_os_parts(self, q, did, wid, eid):
        return self.onshape.parts(did, wid, eid)

    def a_os_drawing_create(self, q):
        b = self._json_body()
        template = b.get("template") if isinstance(b.get("template"), dict) else None
        return self.onshape.create_drawing(b.get("did"), b.get("wid"), b.get("name"), b.get("elementId"),
                                           b.get("partId"), b.get("size"), template, b.get("views"), b.get("standard"))

    def a_os_drawing_modify(self, q, did, wid, eid):
        b = self._json_body(MAX_FILE)
        return self.onshape.modify_drawing(did, wid, eid, b.get("description"), b.get("jsonRequests"))

    def a_os_drawing_status(self, q, did, wid, eid, rid):
        return self.onshape.modify_status(rid)

    def a_os_metadata(self, q):
        b = self._json_body()
        return self.onshape.set_metadata(b.get("did"), b.get("wid"), b.get("eid"), b.get("partId"), b.get("properties"))

    def a_os_raw(self, q):
        b = self._json_body(MAX_FILE)
        return self.onshape.raw(b.get("method"), b.get("path"), b.get("query"), b.get("body"))


def _routes():
    table = [
        ("GET", r"/api/ping", "a_ping"),
        ("GET", r"/api/settings", "a_settings_get"),
        ("PUT", r"/api/settings", "a_settings_put"),
        ("GET", r"/api/projects", "a_projects"),
        ("GET", rf"/api/projects/{PID}", "a_project_get"),
        ("PUT", rf"/api/projects/{PID}", "a_project_put"),
        ("DELETE", rf"/api/projects/{PID}", "a_project_delete"),
        ("GET", rf"/api/projects/{PID}/files", "a_files"),
        ("GET", rf"/api/projects/{PID}/files/([^/]{{1,400}})", "a_file_get"),
        ("PUT", rf"/api/projects/{PID}/files/([^/]{{1,400}})", "a_file_put"),
        ("GET", r"/api/onshape/status", "a_os_status"),
        ("POST", r"/api/onshape/connect", "a_os_connect"),
        ("POST", r"/api/onshape/disconnect", "a_os_disconnect"),
        ("GET", r"/api/onshape/documents", "a_os_documents"),
        ("POST", r"/api/onshape/documents", "a_os_document_create"),
        ("GET", rf"/api/onshape/documents/{OID}/workspaces", "a_os_workspaces"),
        ("GET", rf"/api/onshape/documents/{OID}/w/{OID}/elements", "a_os_elements"),
        ("POST", r"/api/onshape/import", "a_os_import"),
        ("GET", rf"/api/onshape/translations/{OID}", "a_os_translation"),
        ("GET", rf"/api/onshape/documents/{OID}/w/{OID}/e/{OID}/parts", "a_os_parts"),
        ("POST", r"/api/onshape/drawings", "a_os_drawing_create"),
        ("POST", rf"/api/onshape/drawings/{OID}/{OID}/{OID}/modify", "a_os_drawing_modify"),
        ("GET", rf"/api/onshape/drawings/{OID}/{OID}/{OID}/modify/{OID}", "a_os_drawing_status"),
        ("POST", r"/api/onshape/metadata", "a_os_metadata"),
        ("POST", r"/api/onshape/raw", "a_os_raw"),
    ]
    return [(verb, re.compile(pattern), name) for verb, pattern, name in table]


ROUTES = _routes()


class Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, port: int, data_dir: Path, verbose: bool = False):
        super().__init__(("127.0.0.1", port), Handler)  # loopback only, never 0.0.0.0
        self.store = store_mod.Store(data_dir)
        self.onshape = onshape_mod.Onshape(data_dir)
        self.verbose = verbose


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="DesignWizard.ai - serveur local (127.0.0.1 uniquement)")
    ap.add_argument("--port", type=int, default=8070, help="port d'écoute (défaut 8070)")
    ap.add_argument("--no-browser", action="store_true", help="ne pas ouvrir le navigateur")
    ap.add_argument("--data", default=None, help="dossier des données (défaut : <repo>/data)")
    ap.add_argument("--verbose", action="store_true", help="journaliser les requêtes dans la console")
    args = ap.parse_args(argv)
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(errors="replace")
    data_dir = Path(args.data).expanduser().resolve() if args.data else ROOT / "data"
    if data_dir == WEB.resolve() or WEB.resolve() in data_dir.parents:
        print("Erreur : le dossier de données ne doit pas être dans web/ (il serait servi publiquement). "
              "Correctif : choisissez un autre dossier avec --data.", file=sys.stderr)
        return 2
    try:
        server = Server(args.port, data_dir, args.verbose)
    except OSError as e:
        print(f"Erreur : impossible d'ouvrir le port {args.port} ou le dossier {data_dir} ({e.strerror or e}). "
              "Correctif : fermez l'autre instance ou choisissez un autre port avec --port.", file=sys.stderr)
        return 2
    url = f"http://127.0.0.1:{server.server_address[1]}/"
    st = server.onshape.status()
    print(f"{APP} by DynamiteAgile™ - serveur local v{VERSION}")
    print(f"  URL      : {url}")
    print(f"  Données  : {data_dir}")
    print("  Onshape  : " + (f"connecté ({(st.get('user') or {}).get('name') or '?'})" if st["connected"]
                              else "non connecté"))
    print("  Ctrl+C pour arrêter", flush=True)
    if not (WEB / "index.html").is_file():
        print(f"  Attention : {WEB / 'index.html'} est absent ; seule l'API répondra.", flush=True)
    if not args.no_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nArrêt du serveur.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
