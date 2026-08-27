"""One-time Gmail readonly OAuth bootstrap directly into Secret Manager."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from google.auth.transport.requests import AuthorizedSession
from google.cloud import secretmanager
from google_auth_oauthlib.flow import InstalledAppFlow
from objective_recovery_agent.gmail_contract import GMAIL_READONLY_SCOPE


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Authorize one Gmail mailbox and store its offline grant securely."
    )
    parser.add_argument("--project", required=True)
    parser.add_argument("--mailbox", required=True)
    parser.add_argument("--client-secrets", required=True, type=Path)
    parser.add_argument("--secret-id", default="objective-recovery-gmail-oauth-user")
    parser.add_argument("--delete-client-file", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = arguments()
    expected_mailbox = args.mailbox.strip().casefold()
    flow = InstalledAppFlow.from_client_secrets_file(
        str(args.client_secrets),
        scopes=[GMAIL_READONLY_SCOPE],
        autogenerate_code_verifier=True,
    )
    credentials = flow.run_local_server(
        host="127.0.0.1",
        port=0,
        open_browser=True,
        access_type="offline",
        prompt="consent",
        authorization_prompt_message="Opening Gmail readonly consent in your browser...",
        success_message="Authorization received. You may close this browser tab.",
    )
    profile_response = AuthorizedSession(credentials).get(
        "https://gmail.googleapis.com/gmail/v1/users/me/profile", timeout=20
    )
    profile_response.raise_for_status()
    profile = profile_response.json()
    actual_mailbox = str(profile.get("emailAddress", "")).strip().casefold()
    if actual_mailbox != expected_mailbox:
        raise SystemExit(
            f"Authorized mailbox {actual_mailbox!r} does not match {expected_mailbox!r}; "
            "no secret version was written."
        )
    if not credentials.refresh_token:
        raise SystemExit("OAuth response did not contain an offline refresh credential.")
    payload = {
        "client_id": credentials.client_id,
        "client_secret": credentials.client_secret,
        "refresh_token": credentials.refresh_token,
        "token_uri": credentials.token_uri,
        "scopes": [GMAIL_READONLY_SCOPE],
        "type": "authorized_user",
    }
    client = secretmanager.SecretManagerServiceClient()
    parent = f"projects/{args.project}/secrets/{args.secret_id}"
    client.add_secret_version(
        request={
            "parent": parent,
            "payload": {"data": json.dumps(payload, separators=(",", ":")).encode("utf-8")},
        }
    )
    if args.delete_client_file:
        args.client_secrets.unlink(missing_ok=True)
    print(
        f"Stored a Gmail readonly offline grant for {actual_mailbox} in "
        f"projects/{args.project}/secrets/{args.secret_id}."
    )


if __name__ == "__main__":
    main()
