"""Value-only bounds for the single configured Slack capability; no provider access."""

import re
import unicodedata

SLACK_DEMO_RESOURCE = "configured-release-channel"
SLACK_MESSAGE_LIMIT = 500
SLACK_REQUIRED_SCOPES = frozenset({"chat:write", "channels:read", "channels:history"})
SLACK_CREDENTIAL = re.compile(r"(?i)\b(?:xox[baprs]-|xoxe[.-]|xapp-)[\w.-]+")


def slack_message_denial(text: str | None) -> str | None:
    if text is None or not text.strip():
        return "slack_empty_message"
    if len(text) > SLACK_MESSAGE_LIMIT:
        return "slack_message_too_long"
    if any(unicodedata.category(c) in {"Cc", "Cf"} and c not in "\n\t" for c in text):
        return "slack_control_characters"
    if re.search(r"(?i)@(channel|here|everyone)\b|<\s*[!@#]", text):
        return "slack_mentions_denied"
    if SLACK_CREDENTIAL.search(text) or re.search(r"(?i)\bbearer\s+\S+", text):
        return "slack_credentials_denied"
    return None


def encode_slack_text(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def decode_slack_text(text: str) -> str:
    # Only Slack's three display escapes, once. No fuzzy matching, trimming, URL
    # rewriting, emoji conversion or general HTML entity interpretation.
    return text.replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
