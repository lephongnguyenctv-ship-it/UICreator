"""Black-box regression checks for the ZIP payload; never use real credentials."""
import os
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path


PACKAGER = Path(__file__).with_name("package_skill.py")
DUMMY_SECRET = "DUMMY_CREDENTIAL_DO_NOT_PACKAGE"


class PackageSkillTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="craftland-package-test-")
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)
        self.repo = self.base / "repository"
        self.put("scripts/package_skill.py", PACKAGER.read_text(encoding="utf-8"))
        self.put("SKILL.md", "---\nname: craftland-pugc\n---\n# Fixture\n")

    def put(self, relative_path, content):
        path = self.repo / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return path

    def build(self, output):
        subprocess.run(
            [sys.executable, str(self.repo / "scripts/package_skill.py"), str(output)],
            check=True, capture_output=True, text=True,
        )
        with zipfile.ZipFile(output) as archive:
            self.assertIsNone(archive.testzip())
            self.assertEqual(archive.namelist()[0], "craftland-pugc/SKILL.md")
            payload = {name.removeprefix("craftland-pugc/"): archive.read(name) for name in archive.namelist()}
            self.assertTrue(all(name.startswith("craftland-pugc/") for name in archive.namelist()))
        return payload

    def test_excludes_credentials_at_every_depth_and_keeps_knowledge(self):
        forbidden = [
            ".env", "nested/.ENV.production", ".envrc", "deep/app.env", "deep/app.env.local",
            "nested/credentials.json", "deep/Secrets.yaml", "deep/credential.ini",
            "deep/service-account-production.json", "deep/service_account.json",
            "deep/id_ed25519", "deep/id_rsa.pub", "deep/server.KEY",
            "deep/cert.pem", "deep/key.p12", "deep/key.pfx", "deep/key.jks",
            "deep/key.keystore", "deep/vault.kdbx", "deep/key.ppk", "deep/key.p8",
            "deep/ServiceAccount.json", "deep/.npmrc", ".git-credentials",
            "nested/.SSH/config", "nested/.AWS/config", "nested/.kube/config",
            "nested/credentials/config.json", "nested/private-keys/custom.txt",
            "nested/.secrets/config.json", "nested/.claude/settings.json",
            "nested/.git/config", "test_delete_check.txt", "legacy.skill",
        ]
        for path in forbidden:
            self.put(path, DUMMY_SECRET)
        keep = [
            "README.md", "knowledge/safety_and_secrets.md", "knowledge/credential_handling.md",
            "scripts/provision_craftland_pugc.ps1", "scripts/install_auto_save_format.ps1",
            "assets/auto-save-format/.vscode/settings.json",
            "assets/auto-save-format/.vscode/mcp.json",
            "development/deployment/run-platform/templates/deploy-config.example",
            "development/deployment/run-platform/templates/deploy.ps1",
        ]
        for path in keep:
            self.put(path, "Safe fixture content\n")
        payload = self.build(self.base / "result.zip")
        for path in forbidden:
            self.assertNotIn(path, payload)
        for path in keep:
            self.assertEqual(payload[path], (self.repo / path).read_bytes())
        self.assertNotIn("scripts/package_skill.py", payload)
        self.assertFalse(any(DUMMY_SECRET.encode() in value for value in payload.values()))

    def test_output_archive_inside_repo_is_not_packaged(self):
        self.put("README.md", "Safe fixture\n")
        output = self.repo / "result.zip"
        payload = self.build(output)
        self.assertNotIn("result.zip", payload)
        self.assertEqual(payload, self.build(output))

    def test_symlinks_cannot_package_external_files(self):
        external = self.base / "external"
        external.mkdir()
        target = external / "innocent.txt"
        target.write_text(DUMMY_SECRET, encoding="utf-8")
        try:
            (self.repo / "linked_file.txt").symlink_to(target)
            (self.repo / "linked_directory").symlink_to(external, target_is_directory=True)
        except (OSError, NotImplementedError) as exc:
            self.skipTest(f"Symlink creation unavailable on this host: {exc}")
        payload = self.build(self.base / "result.zip")
        self.assertNotIn("linked_file.txt", payload)
        self.assertFalse(any(path.startswith("linked_directory/") for path in payload))

    @unittest.skipUnless(os.name == "nt", "Windows junction regression")
    def test_windows_junction_cannot_package_external_directory(self):
        external = self.base / "external"
        external.mkdir()
        (external / "innocent.txt").write_text(DUMMY_SECRET, encoding="utf-8")
        link = self.repo / "linked_directory"
        subprocess.run(
            ["cmd", "/c", "mklink", "/J", str(link), str(external)],
            check=True, capture_output=True, text=True,
        )
        payload = self.build(self.base / "result.zip")
        self.assertFalse(any(path.startswith("linked_directory/") for path in payload))


if __name__ == "__main__":
    unittest.main(verbosity=2)
