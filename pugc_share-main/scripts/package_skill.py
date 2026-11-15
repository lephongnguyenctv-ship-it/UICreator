#!/usr/bin/env python3
"""
package_skill.py — Build an installable skill ZIP for Craftland PUGC.

Produces a zip whose contents live under a single top-level folder named
after the skill (`craftland-pugc/`), containing SKILL.md + all knowledge
files. Folder names are already lowercase-no-space, so no rewriting is needed.

Usage:
    python scripts/package_skill.py [output_zip]

Default output: ~/Downloads/craftland-pugc-skill.zip
"""
import fnmatch
import os
import stat
import sys
import zipfile

SKILL_NAME = "craftland-pugc"
# Match case-insensitively at every depth, including on case-sensitive hosts.
EXCLUDE_DIRS = {
    ".git", ".agents", ".claude", ".codex", "__pycache__",
    ".ssh", ".aws", ".azure", ".gcloud", ".gnupg", ".kube",
    "secrets", ".secrets", "credentials", ".credentials",
    "private_keys", "private-keys",
}
EXCLUDE_FILES = {".ds_store"}
EXCLUDE_RELATIVE_PATHS = {
    "scripts/package_skill.py", "scripts/test_package_skill.py", "test_delete_check.txt",
}
EXCLUDE_EXTS = {
    ".skill",  # reference-only packaged skills, not KB content
    ".pem", ".key", ".p8", ".ppk", ".p12", ".pfx", ".jks", ".keystore", ".kdbx",
}
EXCLUDE_FILE_PATTERNS = (
    ".env", ".env.*", ".envrc", "*.env", "*.env.*",
    "credential", "credential.*", "credentials", "credentials.*",
    "secret", "secret.*", "secrets", "secrets.*",
    "service-account*.json", "service_account*.json", "serviceaccount*.json",
    "id_rsa", "id_rsa.*", "id_dsa", "id_dsa.*",
    "id_ecdsa", "id_ecdsa.*", "id_ed25519", "id_ed25519.*",
    ".netrc", "_netrc", ".npmrc", ".pypirc", ".git-credentials",
)

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def is_link_or_reparse_point(path):
    """Do not dereference file symlinks or Windows junctions into the payload."""
    metadata = os.lstat(path)
    return stat.S_ISLNK(metadata.st_mode) or bool(
        getattr(metadata, "st_file_attributes", 0)
        & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0)
    )


def excluded_file(name):
    lower_name = name.lower()
    return (
        lower_name in EXCLUDE_FILES
        or os.path.splitext(lower_name)[1] in EXCLUDE_EXTS
        or any(fnmatch.fnmatchcase(lower_name, pattern) for pattern in EXCLUDE_FILE_PATTERNS)
    )


def main():
    out = (
        sys.argv[1]
        if len(sys.argv) > 1
        else os.path.join(os.path.expanduser("~"), "Downloads", f"{SKILL_NAME}-skill.zip")
    )
    out = os.path.abspath(out)
    skill_entry = os.path.join(REPO, "SKILL.md")
    if is_link_or_reparse_point(skill_entry):
        raise ValueError("SKILL.md must be a regular file, not a symlink or reparse point.")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    if os.path.exists(out):
        os.remove(out)

    count = 0
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.write(skill_entry, f"{SKILL_NAME}/SKILL.md")
        count += 1

        for dirpath, dirnames, filenames in os.walk(REPO):
            dirnames[:] = [
                d for d in dirnames
                if d.lower() not in EXCLUDE_DIRS
                and not is_link_or_reparse_point(os.path.join(dirpath, d))
            ]
            for fn in filenames:
                if excluded_file(fn):
                    continue
                full = os.path.join(dirpath, fn)
                if is_link_or_reparse_point(full) or os.path.normcase(os.path.abspath(full)) == os.path.normcase(out):
                    continue
                rel = os.path.relpath(full, REPO)
                normalized_rel = rel.replace(os.sep, "/")
                if normalized_rel.lower() == "skill.md" or normalized_rel.lower() in EXCLUDE_RELATIVE_PATHS:
                    continue
                arc = os.path.join(SKILL_NAME, rel).replace(os.sep, "/")
                z.write(full, arc)
                count += 1

    print(f"Created {out} ({count} files) under top-level '{SKILL_NAME}/'")


if __name__ == "__main__":
    main()
