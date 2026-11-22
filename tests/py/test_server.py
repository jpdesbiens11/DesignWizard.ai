"""Tests of designwizard.py (local server + Onshape proxy) against tests/py/mock_onshape.py.

Run from the repository root:  python -m unittest discover -s tests/py -t .
Standard library only. The server runs in a subprocess on a free port with a temp data
directory and DW_ONSHAPE_BASE_URL pointing at the in-process mock.
"""
from __future__ import annotations

import base64
import http.client
import json
import os
import shutil
import socket
import stat
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import mock_onshape  # noqa: E402

CSP = ("default-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://accounts.google.com/gsi/client https://apis.google.com; "
       "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style; "
       "img-src 'self' data: blob:; worker-src 'self' blob:; "
       "connect-src 'self' https://accounts.google.com/gsi/ https://www.googleapis.com; "
       "frame-src https://accounts.google.com/gsi/ https://docs.google.com; object-src 'none'; frame-ancestors 'none'; "
       "base-uri 'self'; form-action 'self'")
STEP = """ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('DesignOrbit.ai test'),'2;1');
FILE_SCHEMA(('AUTOMOTIVE_DESIGN'));
ENDSEC;
DATA;
#1=PRODUCT('HVB_Assembly','HVB_Assembly','',(#9));
#2=PRODUCT('Busbar_L1','Busbar_L1','',(#9));
#3=PRODUCT('Housing top','Housing top','',(#9));
ENDSEC;
END-ISO-10303-21;
"""
PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
ENV = {}


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def setUpModule():
    ENV["mock"] = mock_onshape.MockOnshape().start()
    ENV["data"] = Path(tempfile.mkdtemp(prefix="dw-test-data-"))
    ENV["port"] = free_port()
    ENV["origin"] = f"http://127.0.0.1:{ENV['port']}"
    ENV["log"] = open(ENV["data"].parent / (ENV["data"].name + ".log"), "w+", encoding="utf-8")
    env = dict(os.environ, DW_ONSHAPE_BASE_URL=ENV["mock"].base_url, PYTHONDONTWRITEBYTECODE="1")
    ENV["proc"] = subprocess.Popen(
        [sys.executable, str(ROOT / "designwizard.py"), "--port", str(ENV["port"]), "--no-browser",
         "--data", str(ENV["data"])], cwd=str(ROOT), env=env, stdout=ENV["log"], stderr=subprocess.STDOUT)
    deadline = time.time() + 15
    while time.time() < deadline:
        try:
            if req("GET", "/api/ping")[0] == 200:
                return
        except OSError:
            time.sleep(0.1)
    raise RuntimeError("designwizard.py did not start")


def tearDownModule():
    ENV["proc"].terminate()
    ENV["proc"].wait(timeout=10)
    ENV["mock"].stop()
    ENV["log"].close()
    os.unlink(ENV["log"].name)
    shutil.rmtree(ENV["data"], ignore_errors=True)


def req(method, path, body=None, headers=None, trusted=True):
    """Returns (status, headers, bytes). `trusted` adds the CSRF headers on writes."""
    h = {}
    if trusted and method in ("POST", "PUT", "DELETE"):
        h.update({"X-DW-Request": "1", "Origin": ENV["origin"]})
    if body is not None and not isinstance(body, (bytes, bytearray)):
        body = json.dumps(body).encode("utf-8")
        h["Content-Type"] = "application/json"
    h.update(headers or {})
    conn = http.client.HTTPConnection("127.0.0.1", ENV["port"], timeout=60)
    try:
        conn.request(method, path, body=body, headers=h)
        r = conn.getresponse()
        return r.status, r.headers, r.read()
    finally:
        conn.close()


def api(method, path, body=None, **kw):
    status, _h, data = req(method, path, body, **kw)
    return status, json.loads(data.decode("utf-8"))


def connect():
    return api("POST", "/api/onshape/connect",
               {"accessKey": mock_onshape.ACCESS, "secretKey": mock_onshape.SECRET})


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


class StaticTests(unittest.TestCase):
    def test_kernel_worker_has_its_own_policy(self):
        """The OpenCascade worker needs run-time code generation; every other response keeps the strict policy."""
        status, headers, _body = req("GET", "/js/cad/worker.js")
        self.assertEqual(status, 200)
        self.assertIn("'unsafe-eval'", headers["Content-Security-Policy"])
        self.assertIn("default-src 'none'", headers["Content-Security-Policy"])
        status, headers, _body = req("GET", "/js/main.js")
        self.assertNotIn("'unsafe-eval'", headers["Content-Security-Policy"])

    def test_static_file_and_security_headers(self):
        status, h, body = req("GET", "/img/favicon.svg")
        self.assertEqual(status, 200)
        self.assertEqual(h["Content-Type"], "image/svg+xml")
        self.assertEqual(h["Content-Security-Policy"], CSP)
        self.assertEqual(h["X-Content-Type-Options"], "nosniff")
        self.assertEqual(h["Referrer-Policy"], "strict-origin-when-cross-origin")
        self.assertEqual(h["Cache-Control"], "no-store")
        self.assertEqual(body, (ROOT / "web/img/favicon.svg").read_bytes())
        status, h, _ = req("GET", "/js/onshape/api.js")
        self.assertEqual((status, h["Content-Type"]), (200, "text/javascript; charset=utf-8"))
        status, h, _ = req("GET", "/nope/missing.css")
        self.assertEqual(status, 404)
        self.assertEqual(h["Content-Security-Policy"], CSP)  # headers on errors too

    def test_index_and_directory(self):
        status, h, body = req("GET", "/")
        if (ROOT / "web/index.html").is_file():
            self.assertEqual((status, h["Content-Type"]), (200, "text/html; charset=utf-8"))
            self.assertEqual(body, (ROOT / "web/index.html").read_bytes())
        else:
            self.assertEqual(status, 404)
        status, h, _ = req("GET", "/img")
        self.assertEqual((status, h["Location"]), (301, "/img/"))

    def test_wasm_mime_vendor_cache_and_head(self):
        wasm = ROOT / "web/vendor/occ/replicad_single.wasm"
        status, h, body = req("HEAD", "/vendor/occ/replicad_single.wasm")
        self.assertEqual(status, 200)
        self.assertEqual(h["Content-Type"], "application/wasm")
        self.assertEqual(h["Cache-Control"], "public, max-age=86400")
        self.assertEqual(int(h["Content-Length"]), wasm.stat().st_size)
        self.assertEqual(body, b"")
        status, h, body = req("GET", "/vendor/three/LICENSE.txt")
        self.assertEqual((status, h["Cache-Control"]), (200, "public, max-age=86400"))
        self.assertEqual(body, (ROOT / "web/vendor/three/LICENSE.txt").read_bytes())

    def test_film_by_pieces(self):
        # a player asks for a film by byte ranges : the whole file when none is asked, the piece when one is
        film = ROOT / "web/video/designorbit_fr.mp4"
        data = film.read_bytes()
        status, h, body = req("HEAD", "/video/designorbit_fr.mp4")
        self.assertEqual((status, h["Content-Type"], h["Accept-Ranges"], int(h["Content-Length"])), (200, "video/mp4", "bytes", len(data)))
        status, h, body = req("GET", "/video/designorbit_fr.mp4", headers={"Range": "bytes=4-11"})
        self.assertEqual((status, h["Content-Range"], body), (206, f"bytes 4-11/{len(data)}", data[4:12]))
        status, h, body = req("GET", "/video/designorbit_fr.mp4", headers={"Range": "bytes=-16"})
        self.assertEqual((status, h["Content-Range"], body), (206, f"bytes {len(data) - 16}-{len(data) - 1}/{len(data)}", data[-16:]))
        status, h, body = req("GET", "/video/designorbit_fr.mp4", headers={"Range": f"bytes={len(data)}-"})
        self.assertEqual((status, h["Content-Range"], body), (416, f"bytes */{len(data)}", b""))
        status, h, body = req("GET", "/video/designorbit_fr.vtt")
        self.assertEqual((status, h["Content-Type"]), (200, "text/vtt; charset=utf-8"))
        self.assertTrue(body.startswith(b"WEBVTT"))

    def test_traversal_refused(self):
        for path in ("/../designwizard.py", "/%2e%2e/designwizard.py", "/js/..%2f..%2fdesignwizard.py",
                     "/..%5cdesignwizard.py", "/js/../../server/onshape.py", "/.%2e/data/onshape_credentials.json",
                     "//etc/passwd", "/js/%00"):
            status, _h, body = req("GET", path)
            self.assertIn(status, (400, 403, 404), path)
            self.assertNotIn(b"import ", body, path)
            self.assertNotIn(b"root:", body, path)

    def test_csrf_and_host_checks(self):
        doc = {"project": {"name": "x"}}
        cases = [
            ({"Origin": ENV["origin"]}, "missing X-DW-Request"),
            ({"X-DW-Request": "1"}, "missing Origin"),
            ({"X-DW-Request": "1", "Origin": "http://evil.example.com"}, "foreign Origin"),
            ({"X-DW-Request": "1", "Origin": ENV["origin"], "Host": "evil.example.com"}, "foreign Host"),
            ({"X-DW-Request": "1", "Referer": "http://evil.example.com/page"}, "foreign Referer"),
        ]
        for headers, why in cases:
            status, body = api("PUT", "/api/projects/csrf", doc, headers=headers, trusted=False)
            self.assertEqual(status, 403, why)
            self.assertFalse(body["ok"])
            self.assertIn("Correctif", body["error"])
        self.assertEqual(api("GET", "/api/projects/csrf")[0], 404)
        status, _ = api("POST", "/api/onshape/disconnect", {}, headers={"Origin": ENV["origin"]}, trusted=False)
        self.assertEqual(status, 403)
        self.assertEqual(api("GET", "/api/ping", headers={"Host": "attacker.test:%d" % ENV["port"]})[0], 403)
        self.assertEqual(api("GET", "/api/ping", headers={"Origin": "http://evil.example.com"})[0], 403)
        self.assertEqual(req("OPTIONS", "/api/ping", headers={"Origin": "http://evil.example.com"})[0], 403)
        # Referer of this server is accepted in place of Origin; localhost is accepted as Host
        status, _ = api("PUT", "/api/projects/csrf", doc, trusted=False,
                        headers={"X-DW-Request": "1", "Referer": ENV["origin"] + "/index.html"})
        self.assertEqual(status, 200)
        self.assertEqual(api("GET", "/api/ping", headers={"Host": "localhost:%d" % ENV["port"]})[0], 200)
        self.assertEqual(api("DELETE", "/api/projects/csrf")[0], 200)


class ProjectTests(unittest.TestCase):
    def test_ping(self):
        status, body = api("GET", "/api/ping")
        self.assertEqual(status, 200)
        self.assertEqual((body["ok"], body["app"], body["mode"]), (True, "DesignOrbit.ai", "server"))
        self.assertIn("version", body)
        self.assertIn("connected", body["onshape"])
        self.assertEqual(req("HEAD", "/api/ping")[2], b"")

    def test_crud_history_files_trash(self):
        pid = "proj_A-1"
        for n in range(8):
            status, body = api("PUT", f"/api/projects/{pid}", {"project": {"name": "Boîtier HVB", "rev": n}})
            self.assertEqual(status, 200, body)
        status, body = api("GET", f"/api/projects/{pid}")
        self.assertEqual((status, body["project"]["rev"]), (200, 7))
        history = sorted((ENV["data"] / "projects" / pid / "history").glob("*.json"))
        self.assertEqual(len(history), 5)
        self.assertEqual([json.loads(f.read_text("utf-8"))["rev"] for f in history], [2, 3, 4, 5, 6])
        status, body = api("GET", "/api/projects")
        entry = next(p for p in body["projects"] if p["id"] == pid)
        self.assertEqual(entry["name"], "Boîtier HVB")
        self.assertTrue(entry["updated"].endswith("Z") and entry["size"] > 0)
        # files: raw bytes in, raw bytes out
        blob = bytes(range(256)) * 40
        status, body = api("PUT", f"/api/projects/{pid}/files/plan%20A.pdf", blob,
                           headers={"Content-Type": "application/pdf"})
        self.assertEqual((status, body["size"]), (200, len(blob)))
        status, h, data = req("GET", f"/api/projects/{pid}/files/plan%20A.pdf")
        self.assertEqual((status, data, h["Content-Type"]), (200, blob, "application/pdf"))
        self.assertEqual(api("GET", f"/api/projects/{pid}/files")[1]["files"][0]["name"], "plan A.pdf")
        for bad in ("..%2Fx.json", "a..b", ".hidden", "x%2Fy"):
            self.assertEqual(api("PUT", f"/api/projects/{pid}/files/{bad}", b"x")[0], 400, bad)
        self.assertEqual(api("GET", f"/api/projects/{pid}/files/none.bin")[0], 404)
        # bad ids and bodies
        self.assertIn(api("PUT", "/api/projects/bad%20id", {"project": {}})[0], (400, 404))
        self.assertEqual(api("PUT", f"/api/projects/{'x' * 65}", {"project": {}})[0], 404)
        self.assertEqual(api("PUT", f"/api/projects/{pid}", {"project": [1, 2]})[0], 400)
        self.assertEqual(api("PUT", f"/api/projects/{pid}", b"not json")[0], 400)
        self.assertEqual(api("POST", f"/api/projects/{pid}", {})[0], 405)
        # delete = moved to trash, never erased
        status, body = api("DELETE", f"/api/projects/{pid}")
        self.assertEqual(status, 200)
        self.assertEqual(api("GET", f"/api/projects/{pid}")[0], 404)
        trash = ENV["data"] / "trash" / body["trash"]
        self.assertEqual(json.loads((trash / f"{pid}.json").read_text("utf-8"))["rev"], 7)
        self.assertEqual((trash / "content" / "files" / "plan A.pdf").read_bytes(), blob)
        self.assertEqual(api("DELETE", f"/api/projects/{pid}")[0], 404)

    def test_settings(self):
        self.assertEqual(api("PUT", "/api/settings", {"settings": {"theme": "carnet"}})[0], 200)
        self.assertEqual(api("GET", "/api/settings")[1]["settings"], {"theme": "carnet"})


class OnshapeTests(unittest.TestCase):
    def setUp(self):
        status, body = connect()
        self.assertEqual(status, 200, body)
        self.state = ENV["mock"].state
        self.doc = next(iter(self.state.docs.values()))
        self.did, self.wid = self.doc["id"], self.doc["wid"]

    def test_connect_status_disconnect(self):
        cred = ENV["data"] / "onshape_credentials.json"
        api("POST", "/api/onshape/disconnect", {})
        self.assertFalse(cred.exists())
        status, body = api("GET", "/api/onshape/status")
        self.assertEqual((status, body["connected"]), (200, False))
        status, body = api("GET", "/api/onshape/documents")
        self.assertEqual(status, 401)
        self.assertIn("Correctif", body["error"])
        # refused keys: the mock answers 204 on sessioninfo, nothing is stored
        status, body = api("POST", "/api/onshape/connect", {"accessKey": "WRONGKEY0001", "secretKey": "WRONGSECRET01"})
        self.assertEqual(status, 401)
        self.assertIn("clés API", body["error"])
        self.assertFalse(cred.exists())
        self.assertEqual(api("POST", "/api/onshape/connect", {"accessKey": "", "secretKey": "x"})[0], 400)
        status, _h, raw = req("POST", "/api/onshape/connect",
                              {"accessKey": mock_onshape.ACCESS, "secretKey": mock_onshape.SECRET})
        body = json.loads(raw)
        self.assertEqual(status, 200)
        self.assertEqual(body["user"], {"name": "Mock User", "email": "mock.user@example.com"})
        self.assertEqual((body["connected"], body["baseUrl"], body["plan"]), (True, ENV["mock"].base_url, "Free"))
        self.assertNotIn(mock_onshape.SECRET.encode(), raw)
        if os.name == "posix":
            self.assertEqual(stat.S_IMODE(cred.stat().st_mode), 0o600)
        for path in ("/api/onshape/status", "/api/onshape/status?verify=1", "/api/ping"):
            status, _h, raw = req("GET", path)
            self.assertEqual(status, 200)
            self.assertNotIn(mock_onshape.SECRET.encode(), raw)
            self.assertNotIn(b"secretKey", raw)
        self.assertEqual(api("GET", "/api/ping")[1]["onshape"], {"connected": True, "user": "Mock User"})

    def test_bad_base_url_refused(self):
        for url in ("https://evil.example.com", "http://cad.onshape.com", "https://evilonshape.com",
                    "https://cad.onshape.com@evil.example.com", "https://cad.onshape.com.evil.example.com",
                    "http://127.0.0.1:9", "https://cad.onshape.com/redirect?x=1", "ftp://cad.onshape.com"):
            status, body = api("POST", "/api/onshape/connect", {"accessKey": mock_onshape.ACCESS,
                                                               "secretKey": mock_onshape.SECRET, "baseUrl": url})
            self.assertEqual(status, 400, url)
            self.assertIn("onshape.com", body["error"])
        self.assertTrue(api("GET", "/api/onshape/status")[1]["connected"])  # previous connection kept

    def test_documents_workspaces_elements(self):
        status, body = api("POST", "/api/onshape/documents", {"name": "DW test doc", "description": "d"})
        self.assertEqual(status, 200, body)
        self.assertEqual(body["name"], "DW test doc")
        self.assertTrue(body["href"].endswith(f"/documents/{body['id']}/w/{body['defaultWorkspaceId']}"))
        status, lst = api("GET", "/api/onshape/documents?q=dw%20test&limit=5")
        self.assertEqual(status, 200)
        item = next(i for i in lst["items"] if i["id"] == body["id"])
        self.assertEqual(set(item), {"id", "name", "owner", "modifiedAt", "defaultWorkspaceId", "href", "public"})
        self.assertEqual((item["owner"], item["public"]), ("Mock User", False))
        page = api("GET", "/api/onshape/documents?limit=1")[1]
        self.assertEqual((len(page["items"]), page["next"]), (1, 1))
        # Free plan hint: private creation refused -> clear French error, no silent switch to public
        status, err = api("POST", "/api/onshape/documents", {"name": "FREE plan doc"})
        self.assertEqual(status, 403)
        self.assertIn("PUBLICS", err["error"])
        self.assertEqual(api("POST", "/api/onshape/documents", {"name": "FREE plan doc", "public": True})[0], 200)
        ws = api("GET", f"/api/onshape/documents/{body['id']}/workspaces")[1]["items"]
        self.assertEqual(ws, [{"id": body["defaultWorkspaceId"], "name": "Main"}])
        els = api("GET", f"/api/onshape/documents/{body['id']}/w/{ws[0]['id']}/elements?type=PARTSTUDIO")[1]["items"]
        self.assertEqual([(e["name"], e["elementType"]) for e in els], [("Part Studio 1", "PARTSTUDIO")])
        self.assertEqual(api("GET", f"/api/onshape/documents/{body['id']}/w/{ws[0]['id']}/elements?type=NOPE")[0], 400)
        self.assertEqual(api("GET", "/api/onshape/documents/000000000000000000000000/workspaces")[0], 404)

    def _import_step(self, filename="HVB_Assembly.step", options=None):
        status, body = api("POST", "/api/onshape/import", {
            "did": self.did, "wid": self.wid, "filename": filename, "contentBase64": b64(STEP.encode()),
            "kind": "step", "options": options or {}})
        self.assertEqual(status, 200, body)
        self.assertEqual(body["state"], "ACTIVE")
        states = []
        for _ in range(10):
            st = api("GET", f"/api/onshape/translations/{body['translationId']}")[1]
            states.append(st["state"])
            if st["state"] != "ACTIVE":
                break
        return body, st, states

    def test_step_import_translation_parts(self):
        body, st, states = self._import_step(options={"yAxisIsUp": True, "bogusOption": True})
        self.assertEqual(states, ["ACTIVE", "DONE"])
        self.assertEqual(len(st["resultElementIds"]), 1)
        blob = next(e for e in self.doc["elements"] if e["id"] == body["elementId"])
        self.assertEqual(blob["fields"]["translate"], "true")
        self.assertEqual(blob["fields"]["yAxisIsUp"], "true")
        self.assertEqual(blob["fields"]["flattenAssemblies"], "false")
        self.assertEqual(blob["fields"]["encodedFilename"], "HVB_Assembly.step")
        self.assertNotIn("bogusOption", blob["fields"])
        els = api("GET", f"/api/onshape/documents/{self.did}/w/{self.wid}/elements")[1]["items"]
        names = {(e["name"], e["elementType"]) for e in els}
        self.assertLessEqual({("HVB_Assembly", "ASSEMBLY"), ("Busbar_L1", "PARTSTUDIO"),
                              ("Housing top", "PARTSTUDIO")}, names)
        studio = next(e for e in els if e["name"] == "Busbar_L1")
        parts = api("GET", f"/api/onshape/documents/{self.did}/w/{self.wid}/e/{studio['id']}/parts")[1]["items"]
        self.assertEqual([(p["partId"], p["name"]) for p in parts], [("JHD", "Busbar_L1")])
        # failed translation, missing translationId (found through the document's translation list), bad content
        _b, st, _s = self._import_step("will_fail.step")
        self.assertEqual((st["state"], st["failureReason"]), ("FAILED", "Untranslatable format"))
        _b, st, _s = self._import_step("notid_part.stp")
        self.assertEqual(st["state"], "DONE")
        status, err = api("POST", "/api/onshape/import", {"did": self.did, "wid": self.wid, "filename": "x.step",
                                                          "contentBase64": b64(b"hello"), "kind": "step"})
        self.assertEqual(status, 400)
        self.assertIn("ISO-10303-21", err["error"])
        status, err = api("POST", "/api/onshape/import", {"did": self.did, "wid": self.wid, "filename": "x.step",
                                                          "contentBase64": "@@@", "kind": "step"})
        self.assertEqual(status, 400)

    def test_pdf_blob_upload_and_update(self):
        name = "DW-001 – drawing.pdf"
        payload = {"did": self.did, "wid": self.wid, "filename": name, "contentBase64": b64(PDF), "kind": "pdf"}
        status, body = api("POST", "/api/onshape/import", payload)
        self.assertEqual((status, body["name"]), (200, name), body)
        el = next(e for e in self.doc["elements"] if e["id"] == body["elementId"])
        self.assertEqual((el["elementType"], el["dataType"], el["size"]), ("BLOB", "application/pdf", len(PDF)))
        self.assertEqual(el["fields"]["translate"], "false")
        status, again = api("POST", "/api/onshape/import", {**payload, "elementId": body["elementId"],
                                                            "contentBase64": b64(PDF + b"more")})
        self.assertEqual((status, again["elementId"]), (200, body["elementId"]))
        self.assertEqual((el["updates"], el["size"]), (1, len(PDF) + 4))
        self.assertEqual(api("POST", "/api/onshape/import", {**payload, "contentBase64": b64(b"not a pdf")})[0], 400)
        self.assertEqual(api("POST", "/api/onshape/import", {**payload, "kind": "exe"})[0], 400)

    def test_drawing_create_modify_status(self):
        studio = self.doc["elements"][0]["id"]
        status, body = api("POST", "/api/onshape/drawings", {"did": self.did, "wid": self.wid, "name": "DW-001 – plan",
                                                             "elementId": studio, "partId": "JHD", "size": "A3"})
        self.assertEqual(status, 200, body)
        self.assertEqual(body["warnings"], [])
        el = next(e for e in self.doc["elements"] if e["id"] == body["elementId"])
        self.assertEqual(el["create"], {"drawingName": "DW-001 – plan", "elementId": studio, "partId": "JHD",
                                        "views": "four", "units": "MILLIMETER", "border": True, "titleblock": True,
                                        "size": "A3"})
        drawings = api("GET", f"/api/onshape/documents/{self.did}/w/{self.wid}/elements?type=DRAWING")[1]["items"]
        self.assertIn(body["elementId"], [d["id"] for d in drawings])
        self.assertTrue(all(d["dataType"] == "onshape-app/drawing" for d in drawings))
        # unconfirmed `size` value refused by Onshape -> created without it, with a warning
        status, hedge = api("POST", "/api/onshape/drawings", {"did": self.did, "wid": self.wid, "name": "fallback",
                                                              "elementId": studio, "size": "REJECT"})
        self.assertEqual(status, 200, hedge)
        self.assertEqual(len(hedge["warnings"]), 1)
        note = lambda text, pos: {"type": "Onshape::Note", "note": {"contents": text, "textHeight": 3.5, **pos}}  # noqa: E731
        point = {"position": {"type": "Onshape::Reference::Point", "coordinate": [15, 20, 0]}}
        url = f"/api/onshape/drawings/{self.did}/{self.wid}/{body['elementId']}/modify"
        status, rq = api("POST", url, {"description": "x" * 50, "jsonRequests": [
            {"messageName": "onshapeCreateAnnotations", "annotations": [note("NOTES :", point), note("broken", {})]}]})
        self.assertEqual((status, rq["state"]), (200, "ACTIVE"), rq)
        states = []
        for _ in range(5):
            st = api("GET", f"{url}/{rq['requestId']}")[1]
            states.append(st["state"])
            if st["state"] != "ACTIVE":
                break
        self.assertEqual(states, ["ACTIVE", "DONE"])
        self.assertEqual(st["output"]["status"], "Partial_success")
        self.assertEqual([r["status"] for r in st["output"]["results"]], ["OK", "Failed"])
        self.assertEqual(len(el["annotations"]), 1)
        self.assertEqual(api("POST", url, {"jsonRequests": [{"messageName": "dropTables"}]})[0], 400)
        self.assertEqual(api("POST", url, {"jsonRequests": []})[0], 400)

    def test_metadata(self):
        studio = self.doc["elements"][0]["id"]
        status, body = api("POST", "/api/onshape/metadata", {
            "did": self.did, "wid": self.wid, "eid": studio, "partId": "JHD",
            "properties": {"partNumber": "DW-001", "description": "Busbar L1", "revision": "B", "material": "Cu-ETP",
                           "colour": "red", "name": ""}})
        self.assertEqual(status, 200, body)
        self.assertEqual(body["set"], ["partNumber", "description"])
        self.assertEqual([s["property"] for s in body["skipped"]], ["revision", "material", "colour"])
        post = self.state.metadata_posts[-1]
        self.assertEqual((post["partId"], post["values"]), ("JHD", {"Part number": "DW-001", "Description": "Busbar L1"}))
        self.assertEqual((post["body"]["jsonType"], post["body"]["partId"]), ("metadata-part", "JHD"))

    def test_raw_allow_list_redirect_retry(self):
        raw = lambda **kw: api("POST", "/api/onshape/raw", kw)  # noqa: E731
        status, body = raw(method="GET", path="/documents", query={"limit": 1})
        self.assertEqual((status, len(body["data"]["items"])), (200, 1), body)
        self.assertEqual(raw(method="GET", path="/api/v17/users/sessioninfo")[1]["data"]["name"], "Mock User")
        for path in ("/users", "/users/sessioninfo/../../teams", "/companies", "/webhooks", "http://evil.example.com/x",
                     "//evil.example.com/documents", "/documents/../users", "/documents/%2e%2e/users",
                     "/documents?x=1", "documents", "/documentsX/y", ""):
            status, body = raw(method="GET", path=path)
            self.assertEqual(status, 403, path)
            self.assertIn("Correctif", body["error"])
        self.assertEqual(raw(method="PUT", path="/documents")[0], 403)
        self.assertEqual(raw(method="DELETE", path=f"/documents/{self.did}")[0], 403)
        self.assertIn(self.did, self.state.docs)
        # 307 followed on the Onshape host only, with the auth header re-sent; foreign host refused
        status, body = raw(method="GET", path=f"/documents/d/{self.did}/redirect307")
        self.assertEqual((status, body["data"][0]["name"]), (200, "Main"), body)
        self.assertEqual(raw(method="GET", path=f"/documents/d/{self.did}/redirectevil")[0], 502)
        # 429 retried once, honouring Retry-After
        status, body = raw(method="GET", path=f"/documents/d/{self.did}/flaky429")
        self.assertEqual((status, body["data"]["flaky"]), (200, "ok"), body)
        self.assertEqual(len(self.state.auth_seen - {""}), 2)  # the good key + the refused one, nothing else

    @unittest.skipUnless(shutil.which("node"), "node is not installed")
    def test_push_js_end_to_end(self):
        with self.state.lock:
            self.doc = self.state.add_doc("Push target")
        self.did, self.wid = self.doc["id"], self.doc["wid"]
        script = r"""
import * as api from %(api)s;
import { pushToOnshape, planPush, normName } from %(push)s;
api.configure({ baseUrl: %(base)s, headers: { Origin: %(base)s } });
const job = { did: %(did)s, wid: %(wid)s, assemblyName: 'HVB_Assembly', stepText: %(step)s,
  options: { nativeDrawings: true, attachPdf: true, setMetadata: true, pollMs: 10 },
  parts: [
    { id: 'DW-001', name: 'Busbar_L1', revision: 'B', material: 'Cu-ETP', pdfBytes: new TextEncoder().encode(%(pdf)s),
      drawing: { title: 'Busbar L1', size: 'A3', notes: ['Ébavurer {toutes} les arêtes', 'ISO 2768-mK'],
        gdt: [{ symbol: 'flatness', tolerance: '0.1', datums: [] }, { symbol: 'position', tolerance: '⌀0.2', datums: ['A', 'B'] }] } },
    { id: 'DW-002', name: 'Housing top' },
    { id: 'DW-003', name: 'Not in the STEP' },
  ] };
const events = [];
const first = await pushToOnshape(job, (e) => events.push(e));
const second = await pushToOnshape(job, null);
console.log(JSON.stringify({ available: await api.available(), plan: planPush(job), first, second, events,
  norm: normName('Boîtier/HVB #1'), b64: api.bytesToBase64(new Uint8Array(200000).fill(65)).length }));
""" % {"api": json.dumps((ROOT / "web/js/onshape/api.js").as_uri()),
            "push": json.dumps((ROOT / "web/js/onshape/push.js").as_uri()), "base": json.dumps(ENV["origin"]),
            "did": json.dumps(self.did), "wid": json.dumps(self.wid), "step": json.dumps(STEP),
            "pdf": json.dumps(PDF.decode("ascii"))}
        run = subprocess.run(["node", "--input-type=module", "-e", script], capture_output=True, text=True,
                             timeout=120, encoding="utf-8")
        self.assertEqual(run.returncode, 0, run.stderr)
        out = json.loads(run.stdout)
        first, second = out["first"], out["second"]
        self.assertTrue(out["available"])
        self.assertEqual((out["norm"], out["b64"]), ("Bo_tier_HVB _1", 266668))
        self.assertTrue(any("PUBLIC" in line for line in out["plan"]))
        self.assertTrue(first["ok"], first["warnings"])
        self.assertEqual(first["documentUrl"], f"{ENV['mock'].base_url}/documents/{self.did}/w/{self.wid}")
        self.assertEqual(first["elements"]["assembly"]["name"], "HVB_Assembly")
        self.assertEqual(sorted(s["name"] for s in first["elements"]["partStudios"]), ["Busbar_L1", "Housing top"])
        self.assertEqual([d["part"] for d in first["elements"]["drawings"]], ["DW-001", "DW-002"])
        self.assertEqual(first["elements"]["drawings"][0]["annotations"], "ok")
        self.assertEqual([(p["part"], p["name"], p["updated"]) for p in first["elements"]["pdfs"]],
                         [("DW-001", "DW-001 – drawing.pdf", False)])
        warnings = "\n".join(first["warnings"])
        self.assertIn("DW-003", warnings)
        self.assertIn("revision", warnings)
        self.assertIn("material", warnings)
        self.assertEqual(len(first["warnings"]), 3, first["warnings"])
        # the drawing references its part studio / part, and carries the notes block (confirmed Note payload only)
        el = {e["id"]: e for e in self.doc["elements"]}
        drawing = el[first["elements"]["drawings"][0]["elementId"]]
        studio = next(s for s in first["elements"]["partStudios"] if s["name"] == "Busbar_L1")
        self.assertEqual((drawing["create"]["elementId"], drawing["create"]["partId"]), (studio["id"], "JHD"))
        texts = [a["note"]["contents"] for a in drawing["annotations"]]
        self.assertEqual(texts[:3], ["NOTES :", "1. Ébavurer toutes les arêtes", "2. ISO 2768-mK"])
        self.assertEqual(texts[-2], "⌖ ⌀0.2 | A | B")
        self.assertIn("Co-Intelligence WorkFlow™ — document généré par DesignOrbit.ai", texts[-1])   # the note of the platform closes the block of notes
        self.assertTrue(all(a["type"] == "Onshape::Note" for a in drawing["annotations"]))
        ys = [a["note"]["position"]["coordinate"][1] for a in drawing["annotations"]]
        self.assertEqual(ys, sorted(ys, reverse=True))
        values = [p["values"] for p in self.state.metadata_posts if p["elementId"] == studio["id"]]
        self.assertEqual(values[0], {"Part number": "DW-001", "Description": "Busbar_L1"})
        # progress events: French labels, monotonic, complete
        self.assertEqual([e["step"] for e in out["events"]], sorted(e["step"] for e in out["events"]))
        self.assertEqual(out["events"][-1]["done"], out["events"][-1]["total"])
        self.assertTrue(all(0 <= e["done"] <= e["total"] and e["label"] for e in out["events"]))
        # second push: the PDF tab is updated in place, not duplicated
        self.assertEqual(second["elements"]["pdfs"][0]["elementId"], first["elements"]["pdfs"][0]["elementId"])
        self.assertTrue(second["elements"]["pdfs"][0]["updated"])

    def test_zz_secret_never_logged_or_copied(self):
        ENV["log"].flush()
        log = Path(ENV["log"].name).read_text("utf-8")
        self.assertNotIn(mock_onshape.SECRET, log)
        self.assertIn("Ctrl+C pour arrêter", log)
        holders = [f.name for f in ENV["data"].rglob("*") if f.is_file()
                   and mock_onshape.SECRET.encode() in f.read_bytes()]
        self.assertEqual(holders, ["onshape_credentials.json"])


if __name__ == "__main__":
    unittest.main()
