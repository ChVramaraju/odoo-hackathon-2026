"""
Brightloop — Structured logging configuration.

Sets up a single named logger ("brightloop") with a format that is useful for
local development and easy to parse in production log aggregators.

Security rules:
- Do not log Authorization headers, request bodies, or response bodies by default.
- Do not log Supabase keys, database passwords, or AI-provider secrets.
- Log request method, path, status code, and duration at INFO level.
"""

import logging
import sys


def configure_logging(debug: bool = False) -> None:
    """
    Configure root and application loggers.

    Call once during application startup before routes receive requests.
    """
    level = logging.DEBUG if debug else logging.INFO

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)

    formatter = logging.Formatter(
        fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )
    handler.setFormatter(formatter)

    # Suppress noisy libraries at WARNING unless debugging.
    for lib in ("uvicorn.error", "uvicorn.access", "httpx", "httpcore"):
        lib_logger = logging.getLogger(lib)
        lib_logger.setLevel(logging.WARNING if not debug else logging.DEBUG)
        lib_logger.propagate = False

    root = logging.getLogger()
    root.setLevel(level)
    root.handlers.clear()
    root.addHandler(handler)

    app_logger = logging.getLogger("brightloop")
    app_logger.setLevel(level)
    app_logger.info("Logging initialised (debug=%s)", debug)

