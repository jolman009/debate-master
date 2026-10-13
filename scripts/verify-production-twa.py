#!/usr/bin/env python3
"""Check the compiled AAB, including manifest references to compiled resources."""
import hashlib
import json
import re
import sys
from pathlib import Path
from zipfile import ZipFile


def varint(data, offset):
    value = shift = 0
    while True:
        byte = data[offset]
        offset += 1
        value |= (byte & 127) << shift
        if byte < 128:
            return value, offset
        shift += 7
        if shift > 63:
            raise ValueError("Invalid protobuf varint")


def fields(data):
    result = {}
    offset = 0
    while offset < len(data):
        key, offset = varint(data, offset)
        number, wire = key >> 3, key & 7
        if wire == 0:
            value, offset = varint(data, offset)
        elif wire == 2:
            length, offset = varint(data, offset)
            value = data[offset:offset + length]
            offset += length
        elif wire in (1, 5):
            length = 8 if wire == 1 else 4
            value = data[offset:offset + length]
            offset += length
        else:
            raise ValueError("Unsupported protobuf wire type")
        if offset > len(data):
            raise ValueError("Truncated protobuf")
        result.setdefault(number, []).append(value)
    return result


def first(data, number, default=b""):
    return fields(data).get(number, [default])[0]


def elements(node):
    # AAPT2 Resources.proto: XmlNode.element=1, XmlElement.child=5.
    for raw in fields(node).get(1, []):
        element = fields(raw)
        attrs = {}
        for attr in element.get(4, []):
            attrs[first(attr, 2).decode()] = first(attr, 3).decode()
        yield element.get(3, [b""])[0].decode(), attrs
        for child in element.get(5, []):
            yield from elements(child)


def verify(bundle, manifest_path):
    expected = json.loads(Path(manifest_path).read_text())
    host = "debate-master-psi.vercel.app"
    if expected["host"] != host or expected["packageId"] != "app.debatemaster.twa":
        raise ValueError("Production configuration does not match the registered app")
    with ZipFile(bundle) as archive:
        bad = archive.testzip()
        if bad:
            raise ValueError("Invalid ZIP entry: " + bad)
        manifest = archive.read("base/manifest/AndroidManifest.xml")
        resources = archive.read("base/resources.pb")
    strings = {}
    for package in fields(resources).get(2, []):
        for resource_type in fields(package).get(3, []):
            if first(resource_type, 2) != b"string":
                continue
            for entry in fields(resource_type).get(3, []):
                name = first(entry, 2).decode()
                strings[name] = []
                for config in fields(entry).get(6, []):
                    value = first(config, 2)
                    item = first(value, 4)
                    string = first(item, 2)
                    strings[name].append(first(string, 1).decode())
    def resolve(value):
        return strings.get(value.removeprefix("@string/"), []) if value.startswith("@string/") else [value]
    compiled = list(elements(manifest))
    attrs = next(a for name, a in compiled if name == "manifest")
    sdk = next(a for name, a in compiled if name == "uses-sdk")
    assert attrs["package"] == expected["packageId"], "Wrong package"
    assert attrs["versionCode"] == str(expected["appVersionCode"]), "Wrong version code"
    assert attrs["versionName"] == expected["appVersionName"], "Wrong version name"
    assert int(sdk["minSdkVersion"]) >= 24, "Minimum SDK must be at least 24"
    assert sdk["targetSdkVersion"] == "36", "Wrong target SDK"
    launch = next(a["value"] for name, a in compiled if name == "meta-data" and a.get("name") == "android.support.customtabs.trusted.DEFAULT_URL")
    assert not launch.startswith("@"), "Launch URL must be a literal immune to translation overrides"
    assert resolve(launch) == ["https://" + host + expected["startUrl"]], "Wrong compiled launch URL"
    host_attrs = [a["host"] for name, a in compiled if name == "data" and "host" in a]
    assert all(not value.startswith("@") for value in host_attrs), "Supported-link domains must be literal"
    hosts = [value for value in host_attrs for value in resolve(value)]
    assert hosts and set(hosts) == {host}, "Wrong compiled supported-link domain"
    domains = set(re.findall(rb"[A-Za-z0-9.-]+\.vercel\.app", resources))
    assert domains == {host.encode()}, "Mixed deployment domains in compiled resources"
    print(json.dumps({"package": attrs["package"], "version": attrs["versionName"], "versionCode": int(attrs["versionCode"]), "launchUrl": resolve(launch)[0], "supportedDomains": hosts, "minSdk": int(sdk["minSdkVersion"]), "targetSdk": int(sdk["targetSdkVersion"]), "sha256": hashlib.sha256(Path(bundle).read_bytes()).hexdigest(), "passed": True}))


if __name__ == "__main__":
    verify(sys.argv[1], sys.argv[2])
