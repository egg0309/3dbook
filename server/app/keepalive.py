"""保持本机前端预览与后端服务可用。

每隔 15 秒检查一次；进程不在或端口无响应时自动拉起，
日志写到 server/logs/keepalive.log，不占控制台窗口。

启动方式：
    pythonw -m app.keepalive
或双击 server/keepalive.bat。
"""
import ctypes
import json
import socket
import subprocess
import sys
import time
import urllib.request
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT.parent / "web"
PYTHON = Path(r"C:\Users\32800\miniconda3\python.exe")
CLOUDFLARED = ROOT / "tools" / "cloudflared.exe"
LOG_DIR = ROOT / "logs"
TUNNEL_PORT = 20243
TUNNEL_METRICS = f"http://127.0.0.1:{TUNNEL_PORT}"
INTERVAL = 15
FLAGS = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0) | getattr(
    subprocess, "DETACHED_PROCESS", 0
)


def _log(message: str) -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(LOG_DIR / "keepalive.log", "a", encoding="utf-8") as f:
        f.write(f"[{stamp}] {message}\n")


def _healthy(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=4) as resp:
            return 200 <= resp.status < 400
    except Exception:
        return False


def _port_open(port: int) -> bool:
    with socket.socket() as sock:
        sock.settimeout(1)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def _spawn(name: str, command, cwd: Path, shell: bool = False):
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    log = open(LOG_DIR / f"{name}.log", "a", encoding="utf-8")
    return subprocess.Popen(
        command,
        cwd=str(cwd),
        shell=shell,
        stdout=log,
        stderr=subprocess.STDOUT,
        stdin=subprocess.DEVNULL,
        creationflags=FLAGS,
    )


def _spawn_backend():
    return _spawn(
        "backend",
        [
            str(PYTHON),
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            "8000",
        ],
        ROOT,
    )


def _spawn_frontend():
    return _spawn(
        "frontend",
        "npm run preview -- --port 5173 --strictPort",
        WEB,
        shell=True,
    )


def _spawn_tunnel():
    return _spawn(
        "cloudflared",
        [
            str(CLOUDFLARED),
            "tunnel",
            "--url",
            "http://localhost:5173",
            "--protocol",
            "http2",
            "--edge-ip-version",
            "4",
            "--metrics",
            f"127.0.0.1:{TUNNEL_PORT}",
            "--logfile",
            str(LOG_DIR / "cloudflared-http2.log"),
            "--loglevel",
            "info",
        ],
        ROOT,
    )


def _tunnel_hostname() -> str:
    try:
        with urllib.request.urlopen(f"{TUNNEL_METRICS}/quicktunnel", timeout=4) as resp:
            return json.load(resp).get("hostname", "")
    except Exception:
        return ""


def _record_tunnel_url(last: str) -> str:
    hostname = _tunnel_hostname()
    if not hostname or hostname == last:
        return last
    url = f"https://{hostname}"
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    (LOG_DIR / "public-url.txt").write_text(url + "\n", encoding="utf-8")
    _log(f"公网地址：{url}")
    return hostname


def _single_instance() -> bool:
    if sys.platform != "win32":
        return True
    ctypes.windll.kernel32.CreateMutexW(None, False, "Local\\zunyi-keepalive")
    return ctypes.windll.kernel32.GetLastError() != 183  # ERROR_ALREADY_EXISTS


def main() -> None:
    if not _single_instance():
        return
    checks = [
        ("backend", "http://127.0.0.1:8000/api/health", _spawn_backend),
        ("frontend", "http://127.0.0.1:5173/home/", _spawn_frontend),
    ]
    if CLOUDFLARED.exists():
        checks.append(("tunnel", f"{TUNNEL_METRICS}/ready", _spawn_tunnel))
    procs = {name: None for name, _, _ in checks}
    fails = {name: 0 for name, _, _ in checks}
    hostname = ""
    public_fails = 0
    _log("keepalive started")
    while True:
        for name, url, starter in checks:
            if _healthy(url):
                fails[name] = 0
                continue
            if name == "tunnel" and _port_open(TUNNEL_PORT):
                # 进程还在、只是边缘连接短暂重连，不要重复拉起新隧道
                fails[name] += 1
                if fails[name] % 8 == 0:
                    _log("隧道重连中，守护等待恢复")
                continue
            fails[name] += 1
            proc = procs[name]
            alive = proc is not None and proc.poll() is None
            if alive and fails[name] < 3:
                continue
            if alive:
                _log(f"{name} 45 秒无响应，重启")
                proc.terminate()
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    proc.kill()
            _log(f"{name} 不可用，正在拉起")
            procs[name] = starter()
            fails[name] = 0
        if "tunnel" in procs:
            hostname = _record_tunnel_url(hostname)
            if hostname:
                # 每 15 秒走一次公网，既保活连接也能尽早发现真实断线
                if _healthy(f"https://{hostname}/api/health", timeout=6):
                    public_fails = 0
                else:
                    public_fails += 1
                    if public_fails % 4 == 0:
                        _log(f"公网连续 {public_fails} 次不可达，等隧道自行重连")
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
