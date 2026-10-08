#!/usr/bin/env python3
# ---------------------------------------------------------------------------
# serve.py — server lokal emulasi GitHub Pages untuk dev AsProject.
#
# GitHub Pages menyalakan "trik": URL yang path-nya TIDAK ada di file system
# (mis. /u/{slug}) tetap menyajikan 404.html (status 404) — dan JS di
# 404.html yang merute ke undangan.html?slug=… . Server http biasa tidak
# berperilaku seperti itu, jadi di sini send_error(404) ditimpa agar
# menyajikan 404.html fisik. Dengan ini alur link tamu bisa diuji lokal:
#
#   python3 tools/serve.py            # default :8080
#   python3 tools/serve.py 9000       # port lain
#   buka http://localhost:8080/u/rangga-alya  (router 404 → undangan.html)
#   buka http://localhost:8080/undangan.html?demo=1
# ---------------------------------------------------------------------------
import http.server
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def send_error(self, code, *a, **k):
        if code == 404:
            p = os.path.join(ROOT, "404.html")
            if os.path.exists(p):
                self.send_response(404)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.end_headers()
                with open(p, "rb") as f:
                    self.wfile.write(f.read())
                return
        return super().send_error(code, *a, **k)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    print(f"Emulasi GitHub Pages di http://localhost:{PORT}  (root: {ROOT})")
    http.server.ThreadingHTTPServer(("0.0.0.0", PORT), H).serve_forever()
