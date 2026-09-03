#!/usr/bin/env python3
"""Tiny, dependency-free status server for the update-openshell orchestrator.

It serves the tick history that run-tick.sh appends to $STATE_DIR/ticks.jsonl
(one JSON object per tick: start/end, total duration, and the *analysis*
duration — how long the skill/claude run actually took — plus outcome and PR).

Bound to a loopback port so it can be published through the gateway with:

    openshell service expose <orchestrator-sandbox> <STATUS_PORT> status

Routes:
  GET /            -> HTML dashboard (newest tick first)
  GET /ticks.jsonl -> raw JSON Lines history (machine-readable)
  GET /log         -> tail of the scheduler/tick execution log
  GET /healthz     -> "ok"

Stdlib only (the base image ships python3); no third-party packages.
"""
import html
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

STATE_DIR = os.environ.get("STATE_DIR", "/sandbox/updater-state")
HISTORY_FILE = os.path.join(STATE_DIR, "ticks.jsonl")
LOG_FILE = os.path.join(STATE_DIR, "scheduler.log")
HOST = os.environ.get("STATUS_HOST", "127.0.0.1")  # loopback: exposed via gateway
PORT = int(os.environ.get("STATUS_PORT", "8080"))
LOG_TAIL_BYTES = 64 * 1024


def read_ticks():
    """Return the parsed tick records, newest first (bad lines skipped)."""
    ticks = []
    try:
        with open(HISTORY_FILE, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    ticks.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    except FileNotFoundError:
        pass
    ticks.reverse()
    return ticks


def fmt_secs(value):
    try:
        secs = int(value)
    except (TypeError, ValueError):
        return "-"
    if secs < 0:
        return "-"
    if secs < 60:
        return f"{secs}s"
    return f"{secs // 60}m{secs % 60:02d}s"


def render_html(ticks):
    badge = {"success": "#137333", "timeout": "#b06000", "failed": "#c5221f"}
    rows = []
    for t in ticks:
        status = str(t.get("status", "?"))
        color = badge.get(status, "#5f6368")
        pr = t.get("pr_url") or ""
        pr_num = pr.rsplit("/", 1)[-1] if pr else ""
        pr_cell = f'<a href="{html.escape(pr)}">#{html.escape(pr_num)}</a>' if pr else "—"
        rows.append(
            "<tr>"
            f"<td>{html.escape(str(t.get('tick_start', '-')))}</td>"
            f"<td>{html.escape(fmt_secs(t.get('duration_seconds')))}</td>"
            f"<td><b>{html.escape(fmt_secs(t.get('analysis_seconds')))}</b></td>"
            f'<td style="color:{color};font-weight:600">{html.escape(status)}</td>'
            f"<td>{html.escape(str(t.get('child', '-')))}</td>"
            f"<td>{pr_cell}</td>"
            "</tr>"
        )
    body = "\n".join(rows) or '<tr><td colspan="6"><i>no ticks recorded yet</i></td></tr>'
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><title>update-openshell ticks</title>
<style>
 body{{font:14px/1.5 system-ui,sans-serif;margin:2rem;color:#202124}}
 h1{{font-size:1.2rem}} table{{border-collapse:collapse;width:100%;max-width:960px}}
 th,td{{text-align:left;padding:.4rem .8rem;border-bottom:1px solid #e0e0e0}}
 th{{color:#5f6368;font-weight:600;font-size:.8rem;text-transform:uppercase}}
 a{{color:#1a73e8}} .foot{{margin-top:1rem;color:#5f6368;font-size:.85rem}}
</style></head><body>
<h1>update-openshell — tick history</h1>
<table>
 <tr><th>Started (UTC)</th><th>Total</th><th>Analysis</th><th>Status</th><th>Child</th><th>PR</th></tr>
 {body}
</table>
<p class="foot">{len(ticks)} tick(s) · raw: <a href="/ticks.jsonl">/ticks.jsonl</a> · log: <a href="/log">/log</a></p>
</body></html>"""


def tail_log():
    try:
        with open(LOG_FILE, "rb") as fh:
            fh.seek(0, os.SEEK_END)
            size = fh.tell()
            fh.seek(max(0, size - LOG_TAIL_BYTES))
            return fh.read().decode("utf-8", "replace")
    except FileNotFoundError:
        return "(no scheduler log yet)\n"


class Handler(BaseHTTPRequestHandler):
    def _send(self, body, content_type="text/plain; charset=utf-8", code=200):
        data = body.encode("utf-8") if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)

    def do_GET(self):  # noqa: N802
        path = self.path.split("?", 1)[0]
        if path == "/healthz":
            self._send("ok")
        elif path == "/ticks.jsonl":
            try:
                with open(HISTORY_FILE, "rb") as fh:
                    self._send(fh.read(), "application/x-ndjson")
            except FileNotFoundError:
                self._send("", "application/x-ndjson")
        elif path == "/log":
            self._send(tail_log())
        elif path == "/":
            self._send(render_html(read_ticks()), "text/html; charset=utf-8")
        else:
            self._send("not found\n", code=404)

    do_HEAD = do_GET

    def log_message(self, *_args):  # silence per-request stderr noise
        pass


def main():
    os.makedirs(STATE_DIR, exist_ok=True)
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"status-server: serving {HISTORY_FILE} on http://{HOST}:{PORT}", flush=True)
    httpd.serve_forever()


if __name__ == "__main__":
    main()
