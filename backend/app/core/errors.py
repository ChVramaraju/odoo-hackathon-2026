"""
Brightloop — Structured error responses.

Every unhandled exception returns a JSON body matching the agreed error contract:

    {
      "error": {
        "code": "SNAKE_CASE_CODE",
        "message": "Human-readable message",
        "details": []
      }
    }

HTTP handlers use AppError to signal expected domain-level failures.
FastAPI exception handlers convert both AppError and unexpected exceptions
to the structured format without leaking stack traces or database internals.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppError(Exception):
    """Raised by services and routes for expected domain-level failures."""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        details: list[Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or []


def _error_body(code: str, message: str, details: list[Any] | None = None) -> dict:
    return {"error": {"code": code, "message": message, "details": details or []}}


def register_exception_handlers(app: FastAPI) -> None:
    """Attach all exception handlers to the FastAPI application."""

    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_body(exc.code, exc.message, exc.details),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        # Surface field-level errors without exposing internal structure.
        details = [
            {
                "field": ".".join(str(loc) for loc in err["loc"] if loc != "body"),
                "issue": err["msg"],
            }
            for err in exc.errors()
        ]
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_error_body(
                "VALIDATION_ERROR",
                "One or more request fields are invalid.",
                details,
            ),
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        # Log internally; never expose stack trace or internal detail to the client.
        import logging

        logging.getLogger("brightloop").exception(
            "Unhandled exception: %s %s", request.method, request.url.path
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_error_body(
                "INTERNAL_ERROR",
                "An unexpected error occurred. Please try again.",
            ),
        )

