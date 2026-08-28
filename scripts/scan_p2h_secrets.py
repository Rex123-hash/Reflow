"""High-confidence credential scan; report locations/rule names, never matched values."""

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RULES = {
    "slack_token": re.compile(
        rb"\b(?:xox[baprs]-[A-Za-z0-9-]{20,}|xoxe[.-][A-Za-z0-9.-]{20,}|xapp-[A-Za-z0-9-]{20,})"
    ),
    "private_key": re.compile(
        rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\r\n]+[A-Za-z0-9+/]{40,}"
    ),
    "google_oauth_access": re.compile(rb"ya29\.[A-Za-z0-9_-]{40,}"),
    "google_oauth_refresh": re.compile(rb"1//[A-Za-z0-9_-]{40,}"),
    "github_token": re.compile(rb"\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})"),
}


def main() -> None:
    names = (
        subprocess.check_output(
            ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
            cwd=ROOT,
        )
        .decode()
        .split("\0")
    )
    paths = {ROOT / name for name in names if name}
    paths.update((ROOT / "artifacts").glob("p2h-*.json"))
    findings = []
    for path in sorted(paths):
        if not path.is_file():
            continue
        content = path.read_bytes()
        for rule, pattern in RULES.items():
            for match in pattern.finditer(content):
                findings.append(
                    {
                        "path": str(path.relative_to(ROOT)),
                        "rule": rule,
                        "line": content[: match.start()].count(b"\n") + 1,
                    }
                )
    historical = subprocess.check_output(
        [
            "git",
            "log",
            "--all",
            "--format=%H",
            "-G",
            "xox[baprs]-[0-9]{8,}-[0-9]{8,}-[A-Za-z0-9]{20,}",
            "--",
            ".",
        ],
        cwd=ROOT,
        text=True,
    ).splitlines()
    result = {
        "files_scanned": len(paths),
        "rules": list(RULES),
        "findings": findings,
        "historical_slack_candidate_commits": historical,
        "scope": (
            "tracked/untracked nonignored workspace files and P2H JSON artifacts; "
            "Slack token signature across Git history"
        ),
    }
    output = ROOT / "artifacts/p2h-secret-scan.json"
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))
    if findings or historical:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
