"""Small fake of the Onshape REST API (v17) used by tests/py/test_server.py - standard library only.

Implements only what the DesignWizard.ai proxy calls, with the behaviours documented in the API
reference: sessioninfo answers 204 for bad keys, drawings are APPLICATION elements, translations
go ACTIVE -> DONE and create Part Studio / Assembly tabs named after the STEP PRODUCT names,
modify requests are asynchronous and report one result per annotation.
Run standalone:  python tests/py/mock_onshape.py --port 8071
"""
from __future__ import annotations

import base64
import json
import re
import threading
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlsplit

ACCESS, SECRET = "MOCKACCESSKEY0001", "MOCKSECRETKEY0001xyz"
PROPS = [  # (propertyId, name, editable, valueType)
    ("57f3fb8efa3416c06701d60d", "Name", True, "STRING"),
    ("57f3fb8efa3416c06701d60f", "Part number", True, "STRING"),
    ("57f3fb8efa3416c06701d60e", "Description", True, "STRING"),
    ("57f3fb8efa3416c06701d610", "Revision", False, "STRING"),
    ("57f3fb8efa3416c06701d6ff", "Material", True, "OBJECT"),
]


def new_id() -> str:
    return uuid.uuid4().hex[:24]


def parse_multipart(ctype: str, body: bytes):
    """Returns (fields: dict[str, str], file: (filename, bytes) | None)."""
    boundary = re.search(r"boundary=(.+)$", ctype).group(1).strip().encode()
    fields, upload = {}, None
    for chunk in body.split(b"--" + boundary):
        if b"\r\n\r\n" not in chunk:
            continue
        head, _, content = chunk.partition(b"\r\n\r\n")
        content = content[:-2] if content.endswith(b"\r\n") else content
        disp = head.decode("utf-8", "replace")
        name = re.search(r'name="([^"]*)"', disp).group(1)
        fname = re.search(r'filename="([^"]*)"', disp)
        if fname:
            upload = (fname.group(1), content)
        else:
            fields[name] = content.decode("utf-8")
    return fields, upload


class State:
    def __init__(self):
        self.lock = threading.RLock()
        self.docs, self.translations, self.modifies = {}, {}, {}
        self.parts, self.metadata_posts, self.calls, self.auth_seen = {}, [], [], set()
        self.flaky = 0
        self.add_doc("Demo document", public=False)

    def add_doc(self, name, public=False, description=""):
        did, wid = new_id(), new_id()
        self.docs[did] = {"id": did, "name": name, "public": public, "description": description, "wid": wid,
                          "elements": [{"id": new_id(), "name": "Part Studio 1", "elementType": "PARTSTUDIO",
                                        "dataType": "onshape/partstudio"}]}
        return self.docs[did]

    def add_element(self, did, name, etype, data_type, **extra):
        el = {"id": new_id(), "name": name, "elementType": etype, "dataType": data_type, **extra}
        self.docs[did]["elements"].append(el)
        return el

    def finish_translation(self, t):
        """Create the tabs of an imported STEP: one Assembly + one Part Studio per component."""
        products = [p.replace("''", "'") for p in re.findall(r"PRODUCT\s*\(\s*'((?:[^']|'')*)'", t["text"])]
        stem = re.sub(r"\.(step|stp)$", "", t["filename"], flags=re.I)
        root = stem if stem in products else (products[0] if len(products) > 1 else None)
        leaves = [p for p in products if p != root] or [stem]
        did = t["documentId"]
        if t["flatten"]:
            el = self.add_element(did, stem, "PARTSTUDIO", "onshape/partstudio")
            self.parts[el["id"]] = [{"partId": "J%02dD" % i, "name": n} for i, n in enumerate(leaves)]
            t["resultElementIds"] = [el["id"]]
        else:
            for n in leaves:
                el = self.add_element(did, n, "PARTSTUDIO", "onshape/partstudio")
                self.parts[el["id"]] = [{"partId": "JHD", "name": n}]
            asm = self.add_element(did, root or stem, "ASSEMBLY", "onshape/assembly")
            t["resultElementIds"] = [asm["id"]]  # worst case of the UNCONFIRMED behaviour: assembly id only
        t["requestState"] = "DONE"


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.0"

    def log_message(self, *args):
        pass

    def reply(self, status, obj=None, headers=None):
        body = b"" if obj is None else json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json;charset=UTF-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Api-Version", "v17")
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def handle_any(self):
        st: State = self.server.state
        url = urlsplit(self.path)
        q = {k: v[-1] for k, v in parse_qs(url.query).items()}
        body = self.rfile.read(int(self.headers.get("Content-Length") or 0))
        auth = self.headers.get("Authorization") or ""
        with st.lock:
            st.calls.append((self.command, url.path))
            st.auth_seen.add(auth)
            try:
                self.route(st, self.command, url.path, q, body, auth)
            except KeyError:
                self.reply(404, {"message": "Not found", "status": 404})

    do_GET = do_POST = do_DELETE = handle_any

    def route(self, st, method, path, q, body, auth):
        if not path.startswith("/api/v17/"):
            return self.reply(404, {"message": "Unknown API version", "status": 404})
        path = path[len("/api/v17"):]
        good = auth == "Basic " + base64.b64encode(f"{ACCESS}:{SECRET}".encode()).decode()
        if path == "/users/sessioninfo":
            if not good:
                return self.reply(204)  # documented gotcha: 204 + empty body when unauthenticated
            return self.reply(200, {"id": "u" + "0" * 23, "name": "Mock User", "email": "mock.user@example.com",
                                    "planGroup": "Free"})
        if not good:
            return self.reply(401, {"message": "Unauthenticated API request", "status": 401})
        ctype = self.headers.get("Content-Type") or ""
        data = json.loads(body.decode("utf-8")) if body and "json" in ctype else {}
        m = lambda pattern: re.fullmatch(pattern, path)  # noqa: E731
        base = f"http://{self.headers.get('Host')}/api/v17"

        if path == "/documents" and method == "GET":
            docs = [d for d in st.docs.values() if q.get("q", "").lower() in d["name"].lower()]
            offset, limit = int(q.get("offset", 0)), min(20, int(q.get("limit", 20)))
            page = docs[offset:offset + limit]
            nxt = f"{base}/documents?offset={offset + limit}&limit={limit}" if offset + limit < len(docs) else None
            return self.reply(200, {"items": [self.doc_json(d) for d in page], "next": nxt, "previous": None})
        if path == "/documents" and method == "POST":
            if data.get("name", "").startswith("FREE") and not data.get("isPublic"):
                return self.reply(403, {"message": "Private documents are not available on this plan", "status": 403})
            return self.reply(200, self.doc_json(st.add_doc(data["name"], bool(data.get("isPublic")),
                                                            data.get("description", ""))))
        if r := m(r"/documents/d/(\w+)/workspaces"):
            d = st.docs[r.group(1)]
            return self.reply(200, [{"id": d["wid"], "name": "Main", "type": "workspace"}])
        if r := m(r"/documents/d/(\w+)/w/(\w+)/elements"):
            els = st.docs[r.group(1)]["elements"]
            if q.get("elementType"):
                els = [e for e in els if e["elementType"] == q["elementType"]]
            return self.reply(200, els)
        if r := m(r"/documents/d/(\w+)/(redirect307|redirectevil|flaky429)"):
            if r.group(2) == "redirect307":
                return self.reply(307, None, {"Location": f"{base}/documents/d/{r.group(1)}/workspaces"})
            if r.group(2) == "redirectevil":
                return self.reply(307, None, {"Location": "http://evil.example.com/api/v17/documents"})
            st.flaky += 1
            if st.flaky % 2 == 1:
                return self.reply(429, {"message": "Too many requests", "status": 429}, {"Retry-After": "0"})
            return self.reply(200, {"flaky": "ok", "attempts": st.flaky})

        if (r := m(r"/blobelements/d/(\w+)/w/(\w+)(?:/e/(\w+))?")) and method == "POST":
            did, _wid, eid = r.groups()
            fields, upload = parse_multipart(ctype, body)
            if not upload:
                return self.reply(400, {"message": "file is required", "status": 400})
            name = unquote(fields.get("encodedFilename") or upload[0])
            if eid:
                el = next(e for e in st.docs[did]["elements"] if e["id"] == eid)
                el.update({"size": len(upload[1]), "updates": el.get("updates", 0) + 1})
                return self.reply(200, {"id": eid, "name": el["name"], "elementType": "BLOB"})
            el = st.add_element(did, name, "BLOB", "application/pdf" if name.lower().endswith(".pdf")
                                else "application/octet-stream", filename=name, size=len(upload[1]), fields=fields)
            out = {"id": el["id"], "name": name, "elementType": "BLOB", "dataType": el["dataType"]}
            if fields.get("translate") == "true" and name.lower().endswith((".step", ".stp")):
                tid = new_id()
                st.translations[tid] = {"id": tid, "requestState": "ACTIVE", "polls": 0, "documentId": did,
                                        "requestElementId": el["id"], "resultElementIds": None, "failureReason": None,
                                        "filename": name, "text": upload[1].decode("utf-8", "replace"),
                                        "flatten": fields.get("flattenAssemblies") == "true"}
                if "notid" not in name:  # "notid" simulates a response without translationId
                    out["translationId"] = tid
            return self.reply(200, out)
        if r := m(r"/translations/d/(\w+)"):
            return self.reply(200, {"items": [self.tr_json(t) for t in st.translations.values()
                                              if t["documentId"] == r.group(1)]})
        if r := m(r"/translations/(\w+)"):
            t = st.translations[r.group(1)]
            t["polls"] += 1
            if t["requestState"] == "ACTIVE" and t["polls"] >= 2:
                if "fail" in t["filename"]:
                    t.update({"requestState": "FAILED", "failureReason": "Untranslatable format"})
                else:
                    st.finish_translation(t)
            return self.reply(200, self.tr_json(t))
        if r := m(r"/parts/d/(\w+)/w/(\w+)/e/(\w+)"):
            return self.reply(200, st.parts.get(r.group(3), []))

        if (r := m(r"/drawings/d/(\w+)/w/(\w+)/create")) and method == "POST":
            if data.get("size") == "REJECT" or not data.get("drawingName"):
                return self.reply(400, {"message": "Invalid drawing parameters", "status": 400})
            el = st.add_element(r.group(1), data["drawingName"], "APPLICATION", "onshape-app/drawing",
                                create=data, annotations=[])
            return self.reply(200, {"id": el["id"], "name": el["name"], "elementType": "APPLICATION"})
        if (r := m(r"/drawings/d/(\w+)/w/(\w+)/e/(\w+)/modify")) and method == "POST":
            did, _wid, eid = r.groups()
            el = next(e for e in st.docs[did]["elements"] if e["id"] == eid)
            reqs = data.get("jsonRequests") or []
            if len(data.get("description", "")) > 32 or any(x.get("formatVersion") != "2021-01-01" for x in reqs):
                return self.reply(400, {"message": "Invalid modify request", "status": 400})
            results = []
            for x in reqs:
                for a in x.get("annotations", []):
                    inner = next((v for k, v in a.items() if k != "type"), {})
                    if isinstance(inner.get("position"), dict):
                        el["annotations"].append(a)
                        results.append({"status": "OK", "logicalId": "h:" + new_id()[:8].upper()})
                    else:
                        results.append({"status": "Failed", "errorDescription":
                                        f"Error processing {a.get('type')}: Point reference is not an object."})
            ok = sum(1 for x in results if x["status"] == "OK")
            status = "OK" if ok == len(results) else ("Partial_success" if ok else "Failed")
            mid = new_id()
            st.modifies[mid] = {"id": mid, "requestState": "ACTIVE", "polls": 0, "elementId": eid, "documentId": did,
                                "final": "DONE" if ok or not results else "FAILED",
                                "output": json.dumps({"status": status, "statusCode": 200 if ok else 400,
                                                      "changeId": new_id(), "results": results})}
            return self.reply(200, {"id": mid, "requestState": "ACTIVE", "output": None})
        if r := m(r"/drawings/modify/status/(\w+)"):
            x = st.modifies[r.group(1)]
            x["polls"] += 1
            if x["polls"] >= 2:
                x["requestState"] = x["final"]
            done = x["requestState"] != "ACTIVE"
            return self.reply(200, {"id": x["id"], "requestState": x["requestState"], "elementId": x["elementId"],
                                    "output": x["output"] if done else None,
                                    "failureReason": "All annotations failed" if x["requestState"] == "FAILED" else None})

        if r := m(r"/metadata/d/(\w+)/w/(\w+)/e/(\w+)(?:/p/([^/]+))?"):
            did, _wid, eid, pid = r.groups()
            if method == "GET":
                props = [{"propertyId": i, "name": n, "editable": e, "valueType": t, "value": ""}
                         for i, n, e, t in PROPS]
                return self.reply(200, {"jsonType": "metadata-part" if pid else "metadata-element",
                                        "partId": unquote(pid) if pid else None, "elementId": eid, "properties": props})
            names = {i: n for i, n, _e, _t in PROPS}
            st.metadata_posts.append({"elementId": eid, "partId": unquote(pid) if pid else None, "body": data,
                                      "values": {names.get(p["propertyId"], "?"): p["value"]
                                                 for p in data.get("properties", [])}})
            return self.reply(200, {"status": "OK"})
        if (r := m(r"/elements/d/(\w+)/w/(\w+)/e/(\w+)")) and method == "DELETE":
            d = st.docs[r.group(1)]
            d["elements"] = [e for e in d["elements"] if e["id"] != r.group(3)]
            return self.reply(200, {})
        return self.reply(404, {"message": "Not found: " + path, "status": 404})

    @staticmethod
    def tr_json(t):
        return {k: t[k] for k in ("id", "requestState", "requestElementId", "resultElementIds", "failureReason",
                                  "documentId")} | {"resultDocumentId": t["documentId"], "name": t["filename"]}

    @staticmethod
    def doc_json(d):
        return {"id": d["id"], "name": d["name"], "public": d["public"], "description": d["description"],
                "owner": {"id": "u" + "0" * 23, "name": "Mock User", "type": 0},
                "modifiedAt": "2026-11-14T10:00:00.000+00:00",
                "defaultWorkspace": {"id": d["wid"], "name": "Main", "type": "workspace"}}


class MockOnshape:
    """Runs the fake API on 127.0.0.1 in a background thread. `state` exposes what was received."""

    def __init__(self, port: int = 0):
        self.httpd = ThreadingHTTPServer(("127.0.0.1", port), Handler)
        self.httpd.daemon_threads = True
        self.httpd.state = self.state = State()
        self.port = self.httpd.server_address[1]
        self.base_url = f"http://127.0.0.1:{self.port}"
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)

    def start(self):
        self.thread.start()
        return self

    def stop(self):
        self.httpd.shutdown()
        self.httpd.server_close()


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(description="Fake Onshape API for local development")
    ap.add_argument("--port", type=int, default=8071)
    mock = MockOnshape(ap.parse_args().port)
    print(f"Mock Onshape on {mock.base_url} - keys: {ACCESS} / {SECRET}\n"
          f"Start the app with DW_ONSHAPE_BASE_URL={mock.base_url} python designwizard.py")
    try:
        mock.httpd.serve_forever()
    except KeyboardInterrupt:
        pass
