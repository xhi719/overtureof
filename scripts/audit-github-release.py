"""Review untracked release candidates without creating a repository in the project.

The scan does not print matched values. It is a screening tool, not a guarantee
that all confidential information or third-party rights issues are detected.
"""

from pathlib import Path
import re
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parent.parent

# Patterns intentionally describe only common credential forms. Values are never logged.
PATTERNS = {
    "private-key": re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----"),
    "github-token": re.compile(rb"\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b"),
    "aws-access-key": re.compile(rb"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b"),
    "slack-token": re.compile(rb"\bxox[baprs]-[A-Za-z0-9-]{20,}\b"),
    "openai-key": re.compile(rb"\bsk-(?:proj-)?[A-Za-z0-9_-]{30,}\b"),
    "database-password-in-url": re.compile(rb"(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?)://[^\s:/@]+:(?!CHANGE_ME)[^\s/@]+@", re.I),
}
SENSITIVE_SUFFIXES = {".pem", ".key", ".p8", ".ppk", ".der", ".p12", ".pfx", ".jks", ".keystore", ".db", ".sqlite", ".sqlite3", ".dump", ".backup", ".bak", ".log"}
SENSITIVE_NAMES = {"id_rsa", "id_dsa", "id_ecdsa", "id_ed25519", "credentials", "credentials.json"}


def main() -> int:
    findings: list[tuple[str, str]] = []
    unreadable: list[str] = []
    runtime = ROOT / ".runtime"
    runtime.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="overture-release-audit-", dir=runtime) as temp:
        temp_path = Path(temp)
        git_dir = temp_path / "repository.git"
        empty_excludes = temp_path / "empty-excludes"
        empty_excludes.touch()
        subprocess.run(["git", "init", "--bare", "--quiet", str(git_dir)], check=True, capture_output=True)
        result = subprocess.run(
            ["git", "-c", f"core.excludesFile={empty_excludes.as_posix()}", f"--git-dir={git_dir}", f"--work-tree={ROOT}", "ls-files", "--others", "--exclude-standard", "-z"],
            check=True, capture_output=True,
        )
        paths = [Path(p.decode("utf-8")) for p in result.stdout.split(b"\0") if p]

    for relative in paths:
        path = ROOT / relative
        label = relative.as_posix()
        if path.is_symlink():
            findings.append((label, "symlink: inspect target before release"))
            continue
        if path.suffix.lower() in SENSITIVE_SUFFIXES:
            findings.append((label, "potentially sensitive file extension"))
        if path.name.lower() in SENSITIVE_NAMES:
            findings.append((label, "potentially sensitive file name"))
        if path.name.lower().startswith(".env") and not path.name.lower().endswith(".example"):
            findings.append((label, "environment file"))
        try:
            data = path.read_bytes()
        except OSError:
            unreadable.append(label)
            continue
        if data.startswith(b"SQLite format 3\x00"):
            findings.append((label, "SQLite database"))
        # Avoid noisy accidental token patterns in media or compressed binaries.
        if b"\x00" in data[:8192]:
            continue
        for name, pattern in PATTERNS.items():
            if pattern.search(data):
                findings.append((label, name))

    print(f"Candidate files: {len(paths)}")
    print(f"Findings: {len(findings)}; unreadable: {len(unreadable)}")
    for name, reason in findings:
        print(f"REVIEW {name}: {reason}")
    for name in unreadable:
        print(f"UNREADABLE {name}")
    print("Screening only; manually review files, licenses, Git staging and all history before publication.")
    return 1 if findings or unreadable else 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, subprocess.CalledProcessError, UnicodeDecodeError) as exc:
        print(f"Audit could not complete: {type(exc).__name__}", file=sys.stderr)
        raise SystemExit(2)
