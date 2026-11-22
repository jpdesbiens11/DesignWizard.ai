"""Project store of the DynamiteOrbit local server (Python standard library only).

Layout of the data directory (never inside web/, git-ignored):
    projects/<id>.json                 the project document
    projects/<id>/files/<name>         binary attachments (STEP, PDF, images...)
    projects/<id>/history/<stamp>.json the 5 previous versions of the document
    trash/<id>-<stamp>/                deleted projects (moved, never erased)
    settings.json                      application settings
Every write is atomic (temp file in the same folder + os.replace).
"""
from __future__ import annotations

import json
import os
import re
import shutil
import tempfile
import threading
import time
from pathlib import Path

ID_RE = re.compile(r"^[A-Za-z0-9_\-]{1,64}$")
FILE_RE = re.compile(r"^[A-Za-z0-9_\-. ]{1,120}$")
HISTORY_KEEP = 5


class StoreError(Exception):
    """Error carrying an HTTP status and a French user-facing message."""

    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status, self.message = status, message


def atomic_write(path: Path, data: bytes) -> None:
    """Write `data` to `path` through a temp file in the same directory."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=".tmp-")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def _stamp() -> str:
    now = time.time()
    return time.strftime("%Y%m%dT%H%M%S", time.gmtime(now)) + "%03dZ" % int(now * 1000 % 1000)


def _iso(ts: float) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(ts))


class Store:
    def __init__(self, data_dir):
        self.root = Path(data_dir)
        self.projects = self.root / "projects"
        self.trash = self.root / "trash"
        self.lock = threading.RLock()
        self.projects.mkdir(parents=True, exist_ok=True)

    # ---------- validation ----------
    @staticmethod
    def check_id(pid: str) -> str:
        if not isinstance(pid, str) or not ID_RE.fullmatch(pid):
            raise StoreError(400, "Identifiant de projet invalide. Correctif : utilisez 1 à 64 caractères "
                                  "parmi A-Z, a-z, 0-9, « _ » et « - ».")
        return pid

    @staticmethod
    def check_file(name: str) -> str:
        ok = isinstance(name, str) and FILE_RE.fullmatch(name) and ".." not in name
        if not ok or name[0] in ". " or name[-1] in ". ":
            raise StoreError(400, "Nom de fichier invalide. Correctif : 1 à 120 caractères parmi lettres, "
                                  "chiffres, « _ », « - », « . » et espace, sans « .. » ni point/espace au début ou à la fin.")
        return name

    def _doc(self, pid: str) -> Path:
        return self.projects / (self.check_id(pid) + ".json")

    def _dir(self, pid: str) -> Path:
        return self.projects / self.check_id(pid)

    # ---------- projects ----------
    def list_projects(self) -> list:
        out = []
        for f in sorted(self.projects.glob("*.json")):
            if not ID_RE.fullmatch(f.stem):
                continue
            st = f.stat()
            name = f.stem
            try:
                doc = json.loads(f.read_text(encoding="utf-8"))
                if isinstance(doc, dict):
                    meta = doc.get("meta") if isinstance(doc.get("meta"), dict) else {}
                    name = str(doc.get("name") or meta.get("name") or f.stem)
            except (OSError, ValueError):
                name = f.stem + " (illisible)"
            out.append({"id": f.stem, "name": name, "updated": _iso(st.st_mtime), "size": st.st_size})
        out.sort(key=lambda p: p["updated"], reverse=True)
        return out

    def get_project(self, pid: str):
        f = self._doc(pid)
        if not f.is_file():
            raise StoreError(404, f"Projet « {pid} » introuvable. Correctif : rechargez la liste des projets.")
        try:
            return json.loads(f.read_text(encoding="utf-8"))
        except ValueError:
            raise StoreError(500, f"Le fichier du projet « {pid} » est corrompu. Correctif : restaurez une version "
                                  f"depuis {self._dir(pid) / 'history'}.")

    def put_project(self, pid: str, doc) -> dict:
        if not isinstance(doc, dict):
            raise StoreError(400, "Projet invalide : un objet JSON est attendu. Correctif : envoyez {\"project\": {...}}.")
        f = self._doc(pid)
        data = json.dumps(doc, ensure_ascii=False, indent=1).encode("utf-8")
        with self.lock:
            if f.is_file():
                hist = self._dir(pid) / "history"
                hist.mkdir(parents=True, exist_ok=True)
                target = hist / (_stamp() + ".json")
                n = 0
                while target.exists():
                    n += 1
                    target = hist / (f"{_stamp()}-{n}.json")
                shutil.copy2(f, target)
                versions = sorted(hist.glob("*.json"))
                for old in versions[:-HISTORY_KEEP]:
                    old.unlink(missing_ok=True)
            atomic_write(f, data)
        return {"id": pid, "updated": _iso(f.stat().st_mtime), "size": len(data)}

    def delete_project(self, pid: str) -> dict:
        f, d = self._doc(pid), self._dir(pid)
        if not f.is_file() and not d.is_dir():
            raise StoreError(404, f"Projet « {pid} » introuvable. Correctif : rechargez la liste des projets.")
        with self.lock:
            dest = self.trash / f"{pid}-{_stamp()}"
            n = 0
            while dest.exists():
                n += 1
                dest = self.trash / f"{pid}-{_stamp()}-{n}"
            dest.mkdir(parents=True)
            if f.is_file():
                shutil.move(str(f), str(dest / f.name))
            if d.is_dir():
                shutil.move(str(d), str(dest / "content"))
        return {"id": pid, "trash": dest.name}

    # ---------- files ----------
    def _file(self, pid: str, name: str) -> Path:
        return self._dir(pid) / "files" / self.check_file(name)

    def list_files(self, pid: str) -> list:
        d = self._dir(pid) / "files"
        if not d.is_dir():
            return []
        return [{"name": f.name, "size": f.stat().st_size, "updated": _iso(f.stat().st_mtime)}
                for f in sorted(d.iterdir()) if f.is_file() and FILE_RE.fullmatch(f.name)]

    def get_file(self, pid: str, name: str) -> Path:
        f = self._file(pid, name)
        if not f.is_file():
            raise StoreError(404, f"Fichier « {name} » introuvable dans le projet « {pid} ». "
                                  "Correctif : vérifiez le nom ou renvoyez le fichier.")
        return f

    def put_file(self, pid: str, name: str, data: bytes) -> dict:
        f = self._file(pid, name)
        with self.lock:
            atomic_write(f, data)
        return {"name": name, "size": len(data)}

    # ---------- settings ----------
    def get_settings(self) -> dict:
        try:
            doc = json.loads((self.root / "settings.json").read_text(encoding="utf-8"))
            return doc if isinstance(doc, dict) else {}
        except (OSError, ValueError):
            return {}

    def put_settings(self, doc) -> dict:
        if not isinstance(doc, dict):
            raise StoreError(400, "Réglages invalides : un objet JSON est attendu. Correctif : envoyez {\"settings\": {...}}.")
        with self.lock:
            atomic_write(self.root / "settings.json", json.dumps(doc, ensure_ascii=False, indent=1).encode("utf-8"))
        return doc
