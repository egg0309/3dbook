"""把当前匿名测试记录整体归档，并建立一个空的新库。

用途：正式发问卷前，把此前自己调试产生的记录挪到 data/archive/，
之后写入 sessions.db 的就只属于新一批测试。旧批次不会被删除，
仍可用 `python -m app.export --db <归档文件>` 导出查看。

本机运行（server 目录、.venv 环境）：
    python -m app.archive
"""
import shutil
import sqlite3
import sys
import time
from contextlib import closing
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.store import DB_PATH, init_db

_BEIJING = timezone(timedelta(hours=8))


def _count(path: Path) -> int:
    try:
        with closing(sqlite3.connect(path)) as conn:
            return conn.execute("SELECT COUNT(*) FROM attempts").fetchone()[0]
    except sqlite3.Error:
        return 0


def _checkpoint() -> None:
    try:
        with closing(sqlite3.connect(DB_PATH)) as conn:
            conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
            conn.commit()
    except sqlite3.Error:
        pass


def _move(src: Path, dst: Path) -> bool:
    # 服务器可能刚好开着短连接，Windows 下文件锁会让 move 失败，稍等重试
    for _ in range(10):
        try:
            shutil.move(str(src), str(dst))
            return True
        except OSError:
            time.sleep(0.2)
    return False


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass

    if not DB_PATH.exists():
        init_db()
        print(f"没有历史记录。已新建空数据库：{DB_PATH}")
        return

    count = _count(DB_PATH)
    stamp = datetime.now(_BEIJING).strftime("%Y%m%d-%H%M%S")
    archive_dir = DB_PATH.parent / "archive"
    archive_dir.mkdir(parents=True, exist_ok=True)
    target = archive_dir / f"sessions-{stamp}.db"

    _checkpoint()
    for suffix in ("", "-wal", "-shm"):
        src = Path(f"{DB_PATH}{suffix}")
        if not src.exists():
            continue
        if not _move(src, Path(f"{target}{suffix}")):
            print(f"归档失败：{src} 仍被占用。请先停止后端服务，再运行本命令。")
            return

    # 旧报表跟着批次一起挪走，避免和新批次混在 data/ 里
    export_dir = archive_dir / f"exports-{stamp}"
    moved_exports = 0
    for path in sorted(DB_PATH.parent.glob("export-*")):
        export_dir.mkdir(parents=True, exist_ok=True)
        if _move(path, export_dir / path.name):
            moved_exports += 1

    init_db()
    print(f"已归档 {count} 条会话：{target}")
    if moved_exports:
        print(f"已归档 {moved_exports} 个旧报表：{export_dir}")
    print(f"新数据库已就绪：{DB_PATH}（0 条记录）")
    print(f"查看旧批次：python -m app.export --db \"{target}\"")


if __name__ == "__main__":
    main()
