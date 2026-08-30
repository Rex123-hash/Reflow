"""Strict, bounded image upload parsing and content validation."""

from __future__ import annotations

import warnings
from collections.abc import AsyncGenerator, Callable
from dataclasses import dataclass
from io import BytesIO

from fastapi import Request
from PIL import Image, UnidentifiedImageError
from pydantic import ValidationError
from starlette.datastructures import UploadFile
from starlette.formparsers import MultiPartException, MultiPartParser

from objective_recovery_agent.image_schemas import (
    ImageErrorCode,
    ImageMimeType,
    ImageProvenance,
    ImageRequestMetadata,
)

MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_IMAGE_EDGE = 8192
MAX_IMAGE_PIXELS = 16_000_000
MAX_MULTIPART_BYTES = MAX_IMAGE_BYTES + 64 * 1024

_MAGIC: tuple[tuple[ImageMimeType, Callable[[bytes], bool]], ...] = (
    ("image/png", lambda value: value.startswith(b"\x89PNG\r\n\x1a\n")),
    ("image/jpeg", lambda value: value.startswith(b"\xff\xd8\xff")),
    (
        "image/webp",
        lambda value: len(value) >= 12 and value.startswith(b"RIFF") and value[8:12] == b"WEBP",
    ),
)
_PIL_FORMATS: dict[str, ImageMimeType] = {
    "PNG": "image/png",
    "JPEG": "image/jpeg",
    "WEBP": "image/webp",
}


class ImageRequestError(ValueError):
    def __init__(self, code: ImageErrorCode, message: str, status_code: int) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True, slots=True)
class ValidatedImageUpload:
    metadata: ImageRequestMetadata
    content: bytes
    provenance: ImageProvenance


class _MemoryMultipartParser(MultiPartParser):
    """Keep the one bounded upload in RAM; never spool raw image bytes to disk."""

    spool_max_size = MAX_IMAGE_BYTES + 1


def _detected_magic(content: bytes) -> ImageMimeType | None:
    for mime_type, predicate in _MAGIC:
        if predicate(content):
            return mime_type
    return None


def validate_image(
    content: bytes,
    declared_mime_type: str | None,
    metadata: ImageRequestMetadata,
) -> ValidatedImageUpload:
    if not content:
        raise ImageRequestError("invalid_image", "The image is empty.", 400)
    if len(content) > MAX_IMAGE_BYTES:
        raise ImageRequestError("image_too_large", "The image exceeds 5 MiB.", 413)
    if declared_mime_type not in {"image/png", "image/jpeg", "image/webp"}:
        raise ImageRequestError(
            "unsupported_media_type", "Only PNG, JPEG, and WebP are accepted.", 415
        )
    detected_magic = _detected_magic(content)
    if detected_magic is None:
        raise ImageRequestError("invalid_image", "The image signature is invalid.", 400)
    if detected_magic != declared_mime_type:
        raise ImageRequestError(
            "media_type_mismatch", "The declared and detected image types do not match.", 400
        )
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(content)) as image:
                detected_format = _PIL_FORMATS.get(image.format or "")
                width, height = image.size
                frames = int(getattr(image, "n_frames", 1))
                if (
                    width <= 0
                    or height <= 0
                    or width > MAX_IMAGE_EDGE
                    or height > MAX_IMAGE_EDGE
                    or width * height > MAX_IMAGE_PIXELS
                ):
                    raise ImageRequestError(
                        "image_dimensions_exceeded",
                        "The image dimensions exceed the safe processing limit.",
                        413,
                    )
                if frames != 1:
                    raise ImageRequestError(
                        "invalid_image", "Animated or multi-frame images are not accepted.", 400
                    )
                image.verify()
            with Image.open(BytesIO(content)) as decoded:
                decoded.load()
    except ImageRequestError:
        raise
    except (
        UnidentifiedImageError,
        OSError,
        SyntaxError,
        ValueError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ):
        raise ImageRequestError("invalid_image", "The image is malformed.", 400) from None
    if detected_format != detected_magic:
        raise ImageRequestError(
            "media_type_mismatch", "The image decoder and signature do not agree.", 400
        )
    provenance = ImageProvenance(
        detected_mime_type=detected_magic,
        byte_size=len(content),
        width=width,
        height=height,
    )
    return ValidatedImageUpload(metadata=metadata, content=content, provenance=provenance)


async def _bounded_body(request: Request) -> bytes:
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_MULTIPART_BYTES:
                raise ImageRequestError("image_too_large", "The upload exceeds 5 MiB.", 413)
        except ValueError:
            raise ImageRequestError("invalid_form", "Content-Length is invalid.", 400) from None
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > MAX_MULTIPART_BYTES:
            raise ImageRequestError("image_too_large", "The upload exceeds 5 MiB.", 413)
    return bytes(body)


async def parse_and_validate_image_request(request: Request) -> ValidatedImageUpload:
    if request.headers.get("content-type", "").split(";")[0].strip().casefold() != (
        "multipart/form-data"
    ):
        raise ImageRequestError("multipart_required", "Multipart form data is required.", 415)
    body = await _bounded_body(request)

    async def stream() -> AsyncGenerator[bytes, None]:
        yield body

    parser = _MemoryMultipartParser(
        headers=request.headers,
        stream=stream(),
        max_files=1,
        max_fields=2,
        max_part_size=2048,
    )
    try:
        form = await parser.parse()
    except MultiPartException:
        raise ImageRequestError("invalid_form", "The multipart form is invalid.", 400) from None
    items = form.multi_items()
    names = [name for name, _ in items]
    if len(names) != len(set(names)) or not set(names) <= {"image", "incident_id", "message"}:
        for _, value in items:
            if isinstance(value, UploadFile):
                await value.close()
        raise ImageRequestError("invalid_form", "The multipart fields are invalid.", 400)
    image = form.get("image")
    if not isinstance(image, UploadFile):
        raise ImageRequestError("image_required", "Exactly one image is required.", 400)
    try:
        incident_id = form.get("incident_id")
        message = form.get("message")
        if not isinstance(incident_id, str) or (
            message is not None and not isinstance(message, str)
        ):
            raise ImageRequestError("invalid_form", "The image metadata is invalid.", 400)
        try:
            metadata = ImageRequestMetadata(incident_id=incident_id, message=message or None)
        except ValidationError:
            raise ImageRequestError("invalid_form", "The image metadata is invalid.", 400) from None
        content = await image.read(MAX_IMAGE_BYTES + 1)
        if len(content) > MAX_IMAGE_BYTES:
            raise ImageRequestError("image_too_large", "The image exceeds 5 MiB.", 413)
        return validate_image(content, image.content_type, metadata)
    finally:
        await image.close()


__all__ = [
    "MAX_IMAGE_BYTES",
    "MAX_IMAGE_EDGE",
    "MAX_IMAGE_PIXELS",
    "MAX_MULTIPART_BYTES",
    "ImageRequestError",
    "ValidatedImageUpload",
    "parse_and_validate_image_request",
    "validate_image",
]
