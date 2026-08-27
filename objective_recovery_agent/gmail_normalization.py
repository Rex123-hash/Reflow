"""Bounded Gmail FULL-payload normalization with no attachment ingestion."""

from __future__ import annotations

import base64
import binascii
import hashlib
import html
import re
import unicodedata
from datetime import UTC, datetime
from email.header import decode_header, make_header
from email.message import Message
from html.parser import HTMLParser
from typing import Any

from objective_recovery_agent.gmail_contract import (
    MAX_DECODED_TEXT_BYTES,
    MAX_PERSISTED_EXCERPT_CHARS,
    NormalizedGmailMessage,
)


class GmailMessageNormalizationError(ValueError):
    pass


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._ignored_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        del attrs
        if tag.casefold() in {"script", "style", "head"}:
            self._ignored_depth += 1
        elif tag.casefold() in {"br", "p", "div", "li", "tr"}:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag.casefold() in {"script", "style", "head"} and self._ignored_depth:
            self._ignored_depth -= 1
        elif tag.casefold() in {"p", "div", "li", "tr"}:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self._ignored_depth:
            self.parts.append(data)


def _base64url_decode(value: str) -> bytes:
    padded = value + ("=" * (-len(value) % 4))
    try:
        return base64.urlsafe_b64decode(padded.encode("ascii"))
    except (UnicodeEncodeError, binascii.Error) as error:
        raise GmailMessageNormalizationError("invalid Gmail Base64URL body") from error


def _decode_header(value: str) -> str:
    try:
        return str(make_header(decode_header(value)))
    except (LookupError, UnicodeDecodeError):
        return value


def _charset(headers: dict[str, str]) -> str:
    message = Message()
    message["content-type"] = headers.get("content-type", "text/plain; charset=utf-8")
    return message.get_content_charset("utf-8") or "utf-8"


def _normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).replace("\x00", "")
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in value.splitlines()]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()


def _html_to_text(value: str) -> str:
    parser = _TextExtractor()
    parser.feed(value)
    parser.close()
    return html.unescape("".join(parser.parts))


def _headers(payload: dict[str, Any]) -> dict[str, str]:
    result: dict[str, str] = {}
    for item in payload.get("headers", []):
        if not isinstance(item, dict):
            continue
        name = str(item.get("name", "")).casefold()
        if name:
            result[name] = _decode_header(str(item.get("value", "")))
    return result


def _text_parts(payload: dict[str, Any]) -> tuple[list[str], list[str], bool]:
    plain: list[str] = []
    html_parts: list[str] = []
    used_bytes = 0
    truncated = False

    def visit(part: dict[str, Any]) -> None:
        nonlocal used_bytes, truncated
        filename = str(part.get("filename", ""))
        body = part.get("body") if isinstance(part.get("body"), dict) else {}
        if filename or body.get("attachmentId"):
            return
        for child in part.get("parts", []):
            if isinstance(child, dict):
                visit(child)
        mime_type = str(part.get("mimeType", "")).casefold()
        if mime_type not in {"text/plain", "text/html"}:
            return
        encoded = body.get("data")
        if not isinstance(encoded, str) or not encoded:
            return
        raw = _base64url_decode(encoded)
        remaining = MAX_DECODED_TEXT_BYTES - used_bytes
        if remaining <= 0:
            truncated = True
            return
        if len(raw) > remaining:
            raw = raw[:remaining]
            truncated = True
        used_bytes += len(raw)
        charset = _charset(_headers(part))
        try:
            decoded = raw.decode(charset, errors="replace")
        except LookupError:
            decoded = raw.decode("utf-8", errors="replace")
        if mime_type == "text/plain":
            plain.append(decoded)
        else:
            html_parts.append(decoded)

    visit(payload)
    return plain, html_parts, truncated


def normalize_gmail_message(raw: dict[str, Any], *, mailbox: str) -> NormalizedGmailMessage:
    message_id = str(raw.get("id", ""))
    thread_id = str(raw.get("threadId", ""))
    payload = raw.get("payload")
    if not message_id or not thread_id or not isinstance(payload, dict):
        raise GmailMessageNormalizationError("Gmail FULL response lacks message identity/payload")
    headers = _headers(payload)
    plain, html_parts, truncated = _text_parts(payload)
    selected = "\n\n".join(plain)
    if not selected and html_parts:
        selected = _html_to_text("\n\n".join(html_parts))
    normalized = _normalize_text(selected)
    if not normalized:
        raise GmailMessageNormalizationError("Gmail message has no supported textual body")
    internal_ms = str(raw.get("internalDate", ""))
    if not internal_ms.isdecimal():
        raise GmailMessageNormalizationError("Gmail message lacks a valid internalDate")
    internal_date = datetime.fromtimestamp(int(internal_ms) / 1000, tz=UTC).isoformat()
    content_hash = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
    return NormalizedGmailMessage(
        gmail_message_id=message_id,
        thread_id=thread_id,
        mailbox=mailbox.casefold(),
        sender=headers.get("from", ""),
        to=headers.get("to", ""),
        cc=headers.get("cc", ""),
        subject=headers.get("subject", ""),
        internal_date=internal_date,
        labels=sorted(str(value) for value in raw.get("labelIds", [])),
        snippet=_normalize_text(str(raw.get("snippet", "")))[:500],
        normalized_text=normalized,
        content_hash=content_hash,
        evidence_excerpt=normalized[:MAX_PERSISTED_EXCERPT_CHARS],
        body_truncated=truncated,
    )
