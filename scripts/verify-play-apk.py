#!/usr/bin/env python3
"""Verify Play's signed APK, including every locale's routing resources."""
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path


def verify(apk, manifest_path):
    expected = json.loads(Path(manifest_path).read_text())
    config = json.loads((Path.home() / ".bubblewrap/config.json").read_text())
    tools = Path(config["androidSdkPath"]) / "build-tools"
    candidates = sorted(tools.glob("*/aapt2"), key=lambda p: [int(n) for n in re.findall(r"\d+", p.parent.name)])
    if not candidates:
        raise ValueError("Android SDK aapt2 is required")
    aapt = str(candidates[-1])
    def dump(*args):
        return subprocess.run([aapt, "dump", *args], check=True, capture_output=True, text=True).stdout
    resources = dump("resources", str(apk))
    tree = dump("xmltree", str(apk), "--file", "AndroidManifest.xml")
    badging = dump("badging", str(apk))
    table = {}
    current = None
    for line in resources.splitlines():
        header = re.search(r"resource (0x[0-9a-f]+) string/", line)
        if "resource " in line:
            current = header.group(1) if header else None
            if current:
                table[current] = []
        elif current:
            value = re.match(r'\s*\([^)]*\) "(.*)"$', line)
            if value:
                table[current].append(value.group(1))
    def resolve(line):
        ref = re.search(r"\)=@(0x[0-9a-f]+)", line)
        if ref:
            return table.get(ref.group(1), [])
        literal = re.search(r'\)="([^"]*)"', line)
        return [literal.group(1)] if literal else []
    lines = tree.splitlines()
    launch_line = next(lines[i + 1] for i, line in enumerate(lines) if '="android.support.customtabs.trusted.DEFAULT_URL"' in line)
    launch_values = resolve(launch_line)
    host_lines = [line for line in lines if ":host(" in line]
    hosts = [value for line in host_lines for value in resolve(line)]
    host = "debate-master-psi.vercel.app"
    launch = "https://" + host + expected["startUrl"]
    if not launch_values or set(launch_values) != {launch}:
        raise ValueError("Play APK has incorrect or localized launch URL overrides")
    if not hosts or set(hosts) != {host}:
        raise ValueError("Play APK has incorrect or localized supported-domain overrides")
    if "@0x" in launch_line or any("@0x" in line for line in host_lines):
        raise ValueError("Play APK routing must use translation-independent manifest literals")
    domains = set(re.findall(r"[A-Za-z0-9.-]+\.vercel\.app", resources + tree))
    if domains != {host}:
        raise ValueError("Play APK contains mixed deployment domains")
    package = re.search(r"package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'", badging)
    if not package or package.groups() != (expected["packageId"], str(expected["appVersionCode"]), expected["appVersionName"]):
        raise ValueError("Play APK package or version does not match the release")
    print(json.dumps({"passed": True, "package": package.group(1), "versionCode": int(package.group(2)), "version": package.group(3), "launchUrl": launch, "supportedDomains": hosts, "sha256": hashlib.sha256(Path(apk).read_bytes()).hexdigest()}))


if __name__ == "__main__":
    verify(sys.argv[1], sys.argv[2])
