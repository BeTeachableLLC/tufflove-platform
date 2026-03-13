from __future__ import annotations

import os

from app.runner import run_forever


def main() -> None:
    block_seconds = max(int(os.getenv("WORKER_RUN_FOREVER_BLOCK_SECONDS", "5")), 1)
    run_forever(block_seconds=block_seconds)


if __name__ == "__main__":
    main()
