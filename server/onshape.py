"""Onshape REST client + proxy operations of the DynamiteOrbit local server (standard library only).

Coded against the Onshape API v17 reference of 2026-11-14 (docs/ONSHAPE.md): Basic auth with the API keys;
`GET /users/sessioninfo` answers 204 for bad keys; 307 redirects are followed by hand, to *.onshape.com only;
429 carries `Retry-After`, 402 = annual quota exhausted; drawings are APPLICATION elements; modify status is
`GET /drawings/modify/status/{id}`. Items the reference marks UNCONFIRMED are hedged where used (search the word).
The secret key lives only in <data>/onshape_credentials.json (mode 600): never logged, never returned.
"""
from __future__ import annotations

import base64
import http.client
import json
import os
import re
import socket
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

API = "/api/v17"
DEFAULT_BASE = "https://cad.onshape.com"
JSON_TYPE = "application/json;charset=UTF-8; qs=0.09"
RAW_PREFIXES = ("documents", "blobelements", "translations", "drawings", "assemblies", "partstudios", "parts",
                "metadata", "elements")
ELEMENT_TYPES = {"PARTSTUDIO", "ASSEMBLY", "DRAWING", "FEATURESTUDIO", "BLOB", "APPLICATION", "TABLE",
                 "BILLOFMATERIALS", "VARIABLESTUDIO", "PUBLICATIONITEM", "IMPORTSTUDIO"}
IMPORT_BOOLS = ("flattenAssemblies", "yAxisIsUp", "createComposite", "allowFaultyParts", "joinAdjacentSurfaces",
                "importAppearances", "importMaterialDensity", "notifyUser")
STEP_DEFAULTS = {"flattenAssemblies": False, "yAxisIsUp": False, "createComposite": False,
                 "allowFaultyParts": False, "importAppearances": True, "notifyUser": False}
MODIFY_MESSAGES = ("onshapeCreateAnnotations", "onshapeEditAnnotations", "onshapeCreateViews", "onshapeEditViews",
                   "onshapeDeleteEntities")
META_LABELS = {"name": "name", "partNumber": "part number", "description": "description", "revision": "revision",
               "material": "material"}
ID_RE = re.compile(r"^[A-Za-z0-9]{6,64}$")
PART_RE = re.compile(r"^[A-Za-z0-9+/=_\-.]{1,64}$")
RAW_PATH_RE = re.compile(r"^/[A-Za-z0-9_\-./~%+=]{1,400}$")
NOT_CONNECTED = ("Onshape n'est pas connecté. Correctif : ouvrez le panneau Onshape et saisissez vos clés API "
                 "(access key + secret key).")
MESSAGES = {
    400: "Onshape a refusé la requête (400) : paramètres invalides. Correctif : vérifiez le document, le workspace, "
         "l'onglet et le contenu envoyé.",
    401: "Onshape a refusé les clés API (401). Correctif : vérifiez l'access key et la secret key (créées sur le même "
         "serveur Onshape que l'URL utilisée) ou recréez une paire dans le Developer Portal.",
    402: "Quota annuel d'appels API Onshape épuisé (402). Correctif : attendez le renouvellement du quota ou passez "
         "à un plan Onshape supérieur.",
    403: "Droit manquant côté Onshape (403) : la clé API n'a pas la permission requise ou vous n'avez pas accès à ce "
         "document. Correctif : recréez la clé avec les permissions Read + Write, ou demandez l'accès en écriture.",
    404: "Ressource Onshape introuvable (404). Correctif : vérifiez que le document, le workspace ou l'onglet existe "
         "toujours, puis rechargez la liste.",
    409: "Conflit Onshape (409) : la ressource a changé entre-temps ou le nom est déjà pris. Correctif : rechargez "
         "la liste puis réessayez.",
    429: "Trop de requêtes vers Onshape (429, rate limit). Correctif : patientez une minute puis réessayez.",
}


class OnshapeError(Exception):  # carries an HTTP status and a French user-facing message
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status, self.message = status, message


def _error(status: int, payload: bytes) -> OnshapeError:
    msg = MESSAGES.get(status) or (
        f"Onshape est momentanément indisponible ({status}). Correctif : réessayez dans quelques minutes."
        if status >= 500 else f"Onshape a renvoyé l'erreur {status}. Correctif : vérifiez la requête puis réessayez.")
    try:
        detail = json.loads(payload.decode("utf-8")).get("message")
        msg += f" Détail Onshape : {str(detail)[:300]}" if detail else ""
    except (ValueError, UnicodeDecodeError, AttributeError):
        pass
    return OnshapeError(status if 400 <= status < 500 else 502, msg)


def _bad(message: str) -> OnshapeError:
    return OnshapeError(400, message)


def _id(value, what: str) -> str:
    if not isinstance(value, str) or not ID_RE.fullmatch(value):
        raise _bad(f"Identifiant Onshape invalide ({what}). Correctif : choisissez le document / l'onglet dans la liste "
                   "au lieu de saisir l'identifiant à la main.")
    return value


def _part(value):
    if value is not None and (not isinstance(value, str) or not PART_RE.fullmatch(value)):
        raise _bad("partId invalide. Correctif : reprenez le partId renvoyé par la liste des pièces.")
    return value


def _dwe(did, wid, eid=None) -> str:
    path = f"/d/{_id(did, 'document')}/w/{_id(wid, 'workspace')}"
    return path + (f"/e/{_id(eid, 'onglet')}" if eid is not None else "")


def _name(value, what: str) -> str:
    if not isinstance(value, str) or not 1 <= len(value.strip()) <= 255:
        raise _bad(f"Nom de {what} invalide. Correctif : saisissez un nom de 1 à 255 caractères.")
    return value.strip()


def _env_base() -> str:
    return os.environ.get("DW_ONSHAPE_BASE_URL", "").strip().rstrip("/")


def _is_local(url: str) -> bool:
    return (urllib.parse.urlsplit(url).hostname or "").lower() in ("127.0.0.1", "localhost")


def check_base_url(url) -> str:
    """Accept https://<x>.onshape.com only; plus the exact DW_ONSHAPE_BASE_URL override when it is local (tests)."""
    url = str(url or "").strip().rstrip("/")
    try:
        u = urllib.parse.urlsplit(url)
        host, port = (u.hostname or "").lower(), u.port
        if url == _env_base() and _is_local(url) and u.scheme in ("http", "https"):
            return url
        if (u.scheme == "https" and (host == "onshape.com" or host.endswith(".onshape.com")) and not u.username
                and not u.password and port in (None, 443) and u.path in ("", "/") and not u.query and not u.fragment):
            return "https://" + host
    except ValueError:
        pass
    raise _bad("URL Onshape refusée : seule une adresse https se terminant par « onshape.com » est acceptée. "
               "Correctif : utilisez https://cad.onshape.com (ou https://<votre-entreprise>.onshape.com).")


def multipart(fields: dict, filename: str, content: bytes, mime: str):
    """Build a multipart/form-data body by hand. Returns (body, content_type)."""
    boundary = "----DWBoundary" + uuid.uuid4().hex
    ascii_name = re.sub(r"[^A-Za-z0-9_\-. ]", "_", filename) or "file"  # the real name goes in encodedFilename
    out = [f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode("utf-8")
           for k, v in fields.items()]
    out.append((f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{ascii_name}"\r\n'
                f"Content-Type: {mime}\r\n\r\n").encode("ascii") + content + b"\r\n")
    out.append(f"--{boundary}--\r\n".encode("ascii"))
    return b"".join(out), "multipart/form-data; boundary=" + boundary


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):  # redirects are handled by Client.request
        return None


class Client:
    """Minimal Onshape HTTP client: Basic auth, manual redirects, one retry, French errors."""

    def __init__(self, access_key: str, secret_key: str, base_url: str):
        self.base = base_url.rstrip("/")
        self._auth = "Basic " + base64.b64encode(f"{access_key}:{secret_key}".encode("utf-8")).decode("ascii")
        local = [urllib.request.ProxyHandler({})] if _is_local(self.base) else []  # the mock never goes via a proxy
        self._opener = urllib.request.build_opener(_NoRedirect(), *local)

    def _redirect_ok(self, url: str) -> bool:
        u, b = urllib.parse.urlsplit(url), urllib.parse.urlsplit(self.base)
        if u.scheme == "https" and (u.hostname or "").lower().endswith(".onshape.com") and not u.username:
            return True
        return _is_local(self.base) and (u.scheme, u.netloc) == (b.scheme, b.netloc)

    def _send(self, method, url, headers, data, timeout):
        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            with self._opener.open(req, timeout=timeout) as r:
                return r.status, r.headers, r.read()
        except urllib.error.HTTPError as e:
            return e.code, e.headers, e.read()
        except (urllib.error.URLError, OSError, http.client.HTTPException) as e:
            if isinstance(getattr(e, "reason", e), (socket.timeout, TimeoutError)):
                raise OnshapeError(504, f"Onshape n'a pas répondu en {timeout} s. Correctif : vérifiez la connexion "
                                        "Internet puis réessayez (un gros fichier peut demander plusieurs essais).")
            raise OnshapeError(502, "Onshape est injoignable (réseau, DNS, proxy ou certificat). Correctif : vérifiez "
                                    f"la connexion Internet et l'URL {self.base}.")

    def request(self, method, path, query=None, body=None, raw=None, timeout=30):
        """Returns (status, headers, bytes). `raw` = (bytes, content_type) for uploads."""
        url = self.base + API + path + ("?" + urllib.parse.urlencode(query) if query else "")
        headers = {"Accept": JSON_TYPE, "Authorization": self._auth}
        data = None
        if raw is not None:
            data, headers["Content-Type"] = raw
        elif body is not None:
            data, headers["Content-Type"] = json.dumps(body).encode("utf-8"), JSON_TYPE
        hops, retried = 0, False
        while True:
            status, hdrs, payload = self._send(method, url, headers, data, timeout)
            if status in (301, 302, 303, 307, 308):
                hops += 1
                url = urllib.parse.urljoin(url, hdrs.get("Location") or "")
                if hops > 5 or not hdrs.get("Location") or not self._redirect_ok(url):
                    raise OnshapeError(502, "Redirection Onshape refusée (hôte non autorisé ou boucle). Correctif : "
                                            "vérifiez l'URL Onshape configurée puis reconnectez-vous.")
                if status in (301, 302, 303) and method not in ("GET", "HEAD"):
                    method, data = "GET", None
                    headers.pop("Content-Type", None)
                continue
            transient = status in (429, 502, 503, 504) or (status == 500 and method == "GET")
            if transient and not retried:  # retry once, honouring Retry-After (a POST is not replayed on a plain 500)
                retried = True
                after = re.fullmatch(r"\d+(\.\d+)?", (hdrs.get("Retry-After") or "").strip())
                time.sleep(min(float(after.group(0)) if after else 1.0, 20.0))
                continue
            return status, hdrs, payload

    def call(self, method, path, query=None, body=None, raw=None, timeout=30):
        """Returns the decoded JSON (None for 204 / empty body); raises OnshapeError on HTTP errors."""
        status, _hdrs, payload = self.request(method, path, query, body, raw, timeout)
        if status >= 400:
            raise _error(status, payload)
        if status == 204 or not payload:
            return None
        try:
            return json.loads(payload.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return {"text": payload[:20000].decode("utf-8", "replace")}


class Onshape:
    """Stored credentials + the operations exposed by the local /api/onshape/* endpoints."""

    def __init__(self, data_dir):
        self.file = Path(data_dir) / "onshape_credentials.json"
        self.lock = threading.Lock()

    # ---------- credentials ----------
    def _creds(self):
        try:
            doc = json.loads(self.file.read_text(encoding="utf-8"))
            return doc if isinstance(doc, dict) and doc.get("accessKey") and doc.get("secretKey") else None
        except (OSError, ValueError):
            return None

    def _client(self) -> Client:
        c = self._creds()
        if not c:
            raise OnshapeError(401, NOT_CONNECTED)
        return Client(c["accessKey"], c["secretKey"], check_base_url(c.get("baseUrl") or _env_base() or DEFAULT_BASE))

    @staticmethod
    def _session(client: Client) -> dict:
        info = client.call("GET", "/users/sessioninfo")
        if not isinstance(info, dict) or not info.get("id"):  # 204 / empty = unauthenticated
            raise OnshapeError(401, MESSAGES[401])
        user = {"name": str(info.get("name") or ""), **({"email": str(info["email"])} if info.get("email") else {})}
        return {"user": user, "plan": info.get("planGroup") or info.get("companyPlan") or None}

    def status(self, verify: bool = False) -> dict:
        c = self._creds()
        if not c:
            return {"connected": False, "baseUrl": _env_base() or DEFAULT_BASE}
        out = {"connected": True, "user": c.get("user") or {"name": ""}, "baseUrl": c.get("baseUrl"),
               **({"plan": c["plan"]} if c.get("plan") else {})}
        if verify:  # costs one API call: only on demand
            out.update(self._session(self._client()))
        return out

    def connect(self, access_key, secret_key, base_url=None) -> dict:
        if not all(isinstance(k, str) and 8 <= len(k) <= 200 and re.fullmatch(r"[\x21-\x7e]+", k)
                   for k in (access_key, secret_key)):
            raise _bad("Clés API Onshape invalides (vides, trop courtes ou avec des espaces). Correctif : copiez "
                       "l'access key et la secret key telles qu'affichées à la création de la clé.")
        base = check_base_url(base_url or _env_base() or DEFAULT_BASE)
        session = self._session(Client(access_key, secret_key, base))  # raises when the keys are refused
        doc = {"accessKey": access_key, "secretKey": secret_key, "baseUrl": base,
               "savedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), **session}
        with self.lock:
            self.file.parent.mkdir(parents=True, exist_ok=True)
            tmp = self.file.with_name(self.file.name + ".tmp")
            with os.fdopen(os.open(str(tmp), os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), "w", encoding="utf-8") as f:
                json.dump(doc, f)
            os.chmod(tmp, 0o600)
            os.replace(tmp, self.file)
        return self.status()

    def disconnect(self) -> dict:
        with self.lock:
            self.file.unlink(missing_ok=True)
        return self.status()

    # ---------- documents ----------
    @staticmethod
    def _doc(base: str, d: dict) -> dict:
        wid = (d.get("defaultWorkspace") or {}).get("id")
        return {"id": d.get("id"), "name": d.get("name"), "owner": (d.get("owner") or {}).get("name"),
                "modifiedAt": d.get("modifiedAt"), "defaultWorkspaceId": wid, "public": bool(d.get("public")),
                "href": f"{base}/documents/{d.get('id')}" + (f"/w/{wid}" if wid else "")}

    def documents(self, q="", limit=20, offset=0, filt=None) -> dict:
        c = self._client()
        try:
            query = {"offset": max(0, int(offset or 0)), "limit": min(20, max(1, int(limit or 20))),
                     "sortColumn": "modifiedAt", "sortOrder": "desc"}
            if filt not in (None, ""):
                query["filter"] = int(filt)
        except (TypeError, ValueError):
            raise _bad("Paramètres de liste invalides. Correctif : limit, offset et filter doivent être des entiers.")
        if q:
            query["q"] = str(q)[:200]
        r = c.call("GET", "/documents", query) or {}
        out = {"items": [self._doc(c.base, d) for d in r.get("items") or [] if isinstance(d, dict)]}
        nxt = re.search(r"[?&]offset=(\d+)", str(r.get("next") or ""))  # `next` is a full URL: expose the offset only
        if nxt:
            out["next"] = int(nxt.group(1))
        return out

    def create_document(self, name, description=None, public=False) -> dict:
        body = {"name": _name(name, "document"), "isPublic": bool(public)}
        if description:
            body["description"] = str(description)[:2000]
        c = self._client()
        try:
            d = c.call("POST", "/documents", body=body) or {}
        except OnshapeError as e:
            if public or e.status not in (400, 403, 409):
                raise
            # UNCONFIRMED: a Free plan may refuse private documents. Never switch to public silently.
            raise OnshapeError(e.status, e.message + " Si votre compte est un plan Free, Onshape n'accepte que des "
                               "documents PUBLICS. Correctif : cochez « document public » (après avoir vérifié que "
                               "rien de confidentiel n'est envoyé) puis réessayez.")
        return {k: v for k, v in self._doc(c.base, d).items() if k not in ("owner", "modifiedAt")}

    def workspaces(self, did) -> dict:
        r = self._client().call("GET", f"/documents/d/{_id(did, 'document')}/workspaces") or []
        return {"items": [{"id": w.get("id"), "name": w.get("name")} for w in r if isinstance(w, dict)]}

    def elements(self, did, wid, etype=None) -> dict:
        etype = str(etype or "").upper()
        if etype and etype not in ELEMENT_TYPES:
            raise _bad("Type d'onglet inconnu. Correctif : utilisez PARTSTUDIO, ASSEMBLY, DRAWING ou BLOB.")
        # Drawings are APPLICATION + dataType onshape-app/drawing in v17: they are filtered locally.
        query = {"elementType": etype} if etype and etype != "DRAWING" else None
        r = self._client().call("GET", f"/documents{_dwe(did, wid)}/elements", query) or []
        items = [{"id": e.get("id"), "name": e.get("name"), "elementType": e.get("elementType"),
                  "dataType": e.get("dataType"), "filename": e.get("filename")} for e in r if isinstance(e, dict)]
        if etype == "DRAWING":
            items = [e for e in items if e["elementType"] == "DRAWING" or e["dataType"] == "onshape-app/drawing"]
        return {"items": items}

    # ---------- import (STEP translation, PDF / blob tabs) ----------
    def import_file(self, did, wid, filename, data: bytes, kind="blob", options=None, element_id=None) -> dict:
        kind, name = str(kind or "blob").lower(), str(filename or "").strip()
        if kind not in ("step", "pdf", "blob") or not name or len(name) > 200 or re.search(r'[\x00-\x1f/\\"]', name):
            raise _bad("Import refusé : type ou nom de fichier invalide. Correctif : kind = step, pdf ou blob, et un "
                       "nom de fichier sans « / », « \\ » ni guillemet.")
        if kind == "step" and element_id:
            raise _bad("elementId n'est accepté que pour un PDF ou un blob. Correctif : retirez elementId.")
        if kind == "step" and not data.lstrip()[:12].upper().startswith(b"ISO-10303-21"):
            raise _bad("Le fichier n'est pas un STEP (en-tête ISO-10303-21 absent ou fichier vide). Correctif : "
                       "réexportez le STEP depuis l'application.")
        if kind == "pdf" and not data.startswith(b"%PDF"):
            raise _bad("Le fichier n'est pas un PDF (en-tête %PDF absent ou fichier vide). Correctif : régénérez le plan.")
        if not data:
            raise _bad("Import refusé : fichier vide. Correctif : régénérez le fichier puis renvoyez-le.")
        fields = {"translate": "false"}
        if kind == "step":
            if not name.lower().endswith((".step", ".stp")):
                name += ".step"  # Onshape picks the translator from the file name suffix
            opts = {**STEP_DEFAULTS, **{k: bool(v) for k, v in (options or {}).items() if k in IMPORT_BOOLS}}
            # Defaults of omitted flags are UNCONFIRMED: every boolean is sent explicitly.
            fields = {"translate": "true", "storeInDocument": "true",
                      **{k: "true" if v else "false" for k, v in opts.items()}}
        fields["encodedFilename"] = urllib.parse.quote(name, safe="")
        mime = "application/pdf" if kind == "pdf" else "application/octet-stream"
        c = self._client()
        r = c.call("POST", "/blobelements" + _dwe(did, wid, element_id), raw=multipart(fields, name, data, mime),
                   timeout=120) or {}
        if kind != "step":
            return {"elementId": r.get("id") or element_id, "name": r.get("name") or name}
        tid = r.get("translationId")
        if not tid and r.get("id"):  # hedge: look the translation up in the document's translation list
            lst = c.call("GET", f"/translations/d/{did}", {"limit": 20}) or []
            lst = (lst.get("items") or []) if isinstance(lst, dict) else lst
            tid = next((t.get("id") for t in lst if isinstance(t, dict) and t.get("requestElementId") == r["id"]), None)
        if not tid:
            raise OnshapeError(502, "Onshape a reçu le STEP mais n'a pas démarré de conversion (pas de translationId). "
                                    "Correctif : vérifiez l'onglet importé dans Onshape puis relancez l'import.")
        return {"translationId": tid, "state": "ACTIVE", "elementId": r.get("id"), "name": r.get("name") or name}

    def translation(self, tid) -> dict:
        r = self._client().call("GET", f"/translations/{_id(tid, 'translation')}") or {}
        return {"state": r.get("requestState") or "ACTIVE", "resultElementIds": r.get("resultElementIds") or [],
                "failureReason": r.get("failureReason"), "requestElementId": r.get("requestElementId"),
                "resultDocumentId": r.get("resultDocumentId")}

    def parts(self, did, wid, eid) -> dict:
        r = self._client().call("GET", "/parts" + _dwe(did, wid, eid)) or []
        return {"items": [{"partId": p.get("partId"), "name": p.get("name"), "partNumber": p.get("partNumber"),
                           "bodyType": p.get("bodyType")} for p in r if isinstance(p, dict)]}

    # ---------- drawings ----------
    def create_drawing(self, did, wid, name, element_id, part_id=None, size=None, template=None, views=None,
                       standard=None) -> dict:
        views = str(views or "four")
        if views not in ("zero", "one", "four", "suggested"):
            raise _bad("Valeur de views invalide. Correctif : utilisez one, four ou suggested.")
        body = {"drawingName": _name(name, "dessin"), "elementId": _id(element_id, "onglet source"), "views": views}
        if _part(part_id):
            body["partId"] = part_id
        hedged, warnings = {}, []
        if template:
            body.update({"templateDocumentId": _id(template.get("did"), "template did"),
                         "templateWorkspaceId": _id(template.get("wid"), "template wid"),
                         "templateElementId": _id(template.get("eid"), "template eid")})
        else:
            body.update({"units": "MILLIMETER", "border": True, "titleblock": True})
            # UNCONFIRMED accepted strings for size / standard: sent first, dropped on a 400.
            hedged = {k: str(v) for k, v in (("size", size or "A3"), ("standard", standard)) if v}
            if not all(re.fullmatch(r"[A-Za-z0-9 ]{1,16}", v) for v in hedged.values()):
                raise _bad("Format de feuille invalide. Correctif : utilisez par exemple A3 ou A4.")
        c, path = self._client(), f"/drawings{_dwe(did, wid)}/create"
        try:
            r = c.call("POST", path, body={**body, **hedged})
        except OnshapeError as e:
            if not hedged or e.status not in (400, 415):
                raise
            r = c.call("POST", path, body=body)
            warnings.append("Onshape a refusé le format de feuille demandé (" + ", ".join(hedged.values()) + ") : "
                            "dessin créé au format par défaut. Correctif : changez le format dans Onshape "
                            "(clic droit sur la feuille > Sheet properties) ou fournissez un template.")
        if not (r or {}).get("id"):
            raise OnshapeError(502, "Onshape n'a pas renvoyé l'identifiant du dessin créé. Correctif : rechargez la "
                                    "liste des onglets du document pour le retrouver.")
        return {"elementId": r["id"], "name": r.get("name") or body["drawingName"], "warnings": warnings}

    def modify_drawing(self, did, wid, eid, description, requests) -> dict:
        if not isinstance(requests, list) or not 1 <= len(requests) <= 50 or not all(
                isinstance(m, dict) and m.get("messageName") in MODIFY_MESSAGES for m in requests):
            raise _bad("jsonRequests invalide. Correctif : envoyez 1 à 50 messages dont messageName vaut "
                       + ", ".join(MODIFY_MESSAGES) + ".")
        body = {"description": str(description or "DynamiteOrbit")[:32],  # edit-history label: 32 chars max
                "jsonRequests": [{"formatVersion": "2021-01-01", **m} for m in requests]}
        r = self._client().call("POST", f"/drawings{_dwe(did, wid, eid)}/modify", body=body) or {}
        if not r.get("id"):
            raise OnshapeError(502, "Onshape n'a pas renvoyé d'identifiant de modification. Correctif : réessayez ; "
                                    "si l'erreur persiste, ouvrez le dessin dans Onshape pour vérifier son état.")
        return {"requestId": r["id"], "state": r.get("requestState") or "ACTIVE"}

    def modify_status(self, request_id) -> dict:
        r = self._client().call("GET", f"/drawings/modify/status/{_id(request_id, 'requête')}") or {}
        output = r.get("output")
        if isinstance(output, str):  # `output` is a JSON string
            try:
                output = json.loads(output)
            except ValueError:
                output = {"text": output}
        return {"state": r.get("requestState") or "ACTIVE", "output": output,
                "failureReason": r.get("failureReason"), "statusCode": r.get("outputStatusCode")}

    # ---------- metadata ----------
    def set_metadata(self, did, wid, eid, part_id, props) -> dict:
        if not isinstance(props, dict):
            raise _bad("properties invalide. Correctif : envoyez un objet {name?, partNumber?, description?, ...}.")
        path = "/metadata" + _dwe(did, wid, eid) + ("/p/" + urllib.parse.quote(part_id, safe="") if _part(part_id) else "")
        c = self._client()
        meta = c.call("GET", path) or {}
        known = {str(p.get("name") or "").strip().lower(): p for p in meta.get("properties") or [] if isinstance(p, dict)}
        send, done, skipped = [], [], []
        for key, value in props.items():
            if value in (None, ""):
                continue
            p = known.get(META_LABELS.get(key, ""))
            if not p or not p.get("propertyId"):
                reason = "propriété introuvable dans Onshape"
            elif not p.get("editable"):
                reason = "propriété non modifiable (souvent gérée par les releases Onshape)"
            elif p.get("valueType") not in (None, "STRING"):
                # UNCONFIRMED: e.g. Material expects an object from a material library; never guessed here.
                reason = "valeur non textuelle côté Onshape : à renseigner dans Onshape"
            else:
                send.append({"propertyId": p["propertyId"], "value": str(value)[:1000]})
                done.append(key)
                continue
            skipped.append({"property": key, "reason": reason})
        if send:
            extra = {"jsonType": "metadata-part", "partId": part_id} if part_id else {}
            c.call("POST", path, body={**extra, "properties": send})
        return {"set": done, "skipped": skipped}

    # ---------- raw pass-through (allow-listed) ----------
    def raw(self, method, path, query=None, body=None) -> dict:
        method = str(method or "GET").upper()
        path = re.sub(r"^/api(/v\d+)?(?=/)", "", path) if isinstance(path, str) else ""
        head = path.strip("/").split("/")[0]
        if (not RAW_PATH_RE.fullmatch(path) or ".." in path or "//" in path or re.search(r"%(2e|2f|5c|00)", path, re.I)
                or not (head in RAW_PREFIXES or path.rstrip("/") == "/users/sessioninfo")):
            raise OnshapeError(403, "Chemin Onshape non autorisé par le proxy local. Correctif : seuls les chemins "
                                    "sous /" + ", /".join(RAW_PREFIXES) + " et /users/sessioninfo sont acceptés.")
        if method not in ("GET", "POST", "DELETE") or (method == "DELETE" and head != "elements"):
            raise OnshapeError(403, "Méthode non autorisée par le proxy local. Correctif : utilisez GET ou POST "
                                    "(DELETE uniquement sous /elements pour supprimer un onglet).")
        if query is not None and not (isinstance(query, dict) and all(
                isinstance(v, (str, int, float, bool)) for v in query.values())):
            raise _bad("query invalide. Correctif : envoyez un objet clé → valeur simple.")
        query = {k: (str(v).lower() if isinstance(v, bool) else v) for k, v in (query or {}).items()}
        return {"data": self._client().call(method, path, query or None, body if method == "POST" else None)}
