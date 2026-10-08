#!/usr/bin/env python3
"""Tambahkan classes.dex ke APK hasil ``aapt2 link`` tanpa menulis ulang entri lain.

``aapt2 link`` sudah menyimpan ``resources.arsc`` tanpa kompresi **dan** selaras 4 byte
(syarat Android 11+ untuk aplikasi bertarget API 30+). Karena itu APK tidak boleh
ditulis ulang dengan pustaka zip biasa — padding milik aapt2 akan hilang. Skrip ini
menyisipkan local header baru tepat sebelum central directory, sehingga:

  * seluruh entri lama tetap byte-per-byte identik (offset & alignment tidak berubah),
  * hanya central directory + EOCD yang ditulis ulang,
  * ``classes.dex`` disimpan terkompresi (deflate) sehingga tidak terikat syarat
    alignment berkas DEX yang tidak terkompresi.
"""

from __future__ import annotations

import argparse
import binascii
import hashlib
import struct
import sys
import zlib
import zipfile
from pathlib import Path

EOCD_SIGNATURE = b"PK\x05\x06"
EOCD_STRUCT = "<IHHHHIIH"
EOCD_MIN_SIZE = struct.calcsize(EOCD_STRUCT)

DOS_TIME = 0          # 00:00:00
DOS_DATE = 0x0021     # 1980-01-01


def find_eocd(data: bytes) -> int:
    limit = min(len(data), EOCD_MIN_SIZE + 0xFFFF)
    for offset in range(len(data) - EOCD_MIN_SIZE, len(data) - limit - 1, -1):
        if data[offset:offset + 4] == EOCD_SIGNATURE:
            return offset
    raise SystemExit("EOCD tidak ditemukan — berkas bukan APK/ZIP yang valid")


def read_eocd(data: bytes) -> tuple[int, int, int]:
    offset = find_eocd(data)
    fields = struct.unpack_from(EOCD_STRUCT, data, offset)
    _, _, _, total_entries, _, cd_size, cd_offset, comment_length = fields
    if comment_length:
        raise SystemExit("EOCD dengan komentar tidak didukung")
    if cd_offset == 0xFFFFFFFF or total_entries == 0xFFFF:
        raise SystemExit("ZIP64 tidak didukung untuk APK ini")
    return offset, cd_offset, cd_size


def zipinfo_compatible_name(name: str) -> bytes:
    return name.encode("utf-8")


def build_local_header(name: bytes, crc: int, csize: int, usize: int, method: int) -> bytes:
    header = struct.pack(
        "<IHHHHHIIIHH",
        0x04034B50,   # signature
        20,           # version needed (2.0)
        0,            # flags
        method,
        DOS_TIME,
        DOS_DATE,
        crc,
        csize,
        usize,
        len(name),
        0,            # extra length
    )
    return header + name


def build_central_entry(name: bytes, crc: int, csize: int, usize: int, method: int,
                        local_offset: int) -> bytes:
    record = struct.pack(
        "<IHHHHHHIIIHHHHHII",
        0x02014B50,   # signature
        20,           # version made by
        20,           # version needed
        0,            # flags
        method,
        DOS_TIME,
        DOS_DATE,
        crc,
        csize,
        usize,
        len(name),
        0,            # extra
        0,            # comment
        0,            # disk number
        0,            # internal attributes
        0o644 << 16,  # external attributes
        local_offset,
    )
    return record + name


def build_eocd(total_entries: int, cd_size: int, cd_offset: int) -> bytes:
    return struct.pack(
        EOCD_STRUCT,
        0x06054B50,
        0,                # disk number
        0,                # disk with central directory
        total_entries,
        total_entries,
        cd_size,
        cd_offset,
        0,                # comment length
    )


def append_dex(resource_apk: Path, dex_files: list[Path], output: Path) -> None:
    data = resource_apk.read_bytes()
    eocd_offset, cd_offset, cd_size = read_eocd(data)
    cd_bytes = data[cd_offset:cd_offset + cd_size]
    total_entries = struct.unpack_from(EOCD_STRUCT, data, eocd_offset)[3]

    # Verifikasi cepat: seluruh entri lama harus bisa dibaca sebelum diubah.
    with zipfile.ZipFile(resource_apk) as archive:
        previous = {info.filename: archive.read(info.filename) for info in archive.infolist()}
        if len(previous) != total_entries:
            raise SystemExit("jumlah entri tidak konsisten")

    body = bytearray(data[:cd_offset])
    local_offsets: list[tuple[bytes, int, int, int, int]] = []

    for dex in sorted(dex_files, key=lambda path: path.name):
        payload = dex.read_bytes()
        if not payload.startswith(b"dex\n"):
            raise SystemExit(f"{dex} bukan berkas DEX yang valid")
        name = zipinfo_compatible_name(dex.name)
        compressor = zlib.compressobj(9, zlib.DEFLATED, -15)
        compressed = compressor.compress(payload) + compressor.flush()
        crc = binascii.crc32(payload) & 0xFFFFFFFF
        if len(compressed) >= len(payload):
            # Ukuran hampir selalu lebih kecil; jaga-jaga bila tidak.
            compressed = payload
            method = zipfile.ZIP_STORED
        else:
            method = zipfile.ZIP_DEFLATED
        local_offset = len(body)
        body += build_local_header(name, crc, len(compressed), len(payload), method)
        body += compressed
        local_offsets.append((name, crc, len(compressed), len(payload), method, local_offset))

    new_cd_offset = len(body)
    central = bytearray(cd_bytes)
    for name, crc, csize, usize, method, local_offset in local_offsets:
        central += build_central_entry(name, crc, csize, usize, method, local_offset)

    output.write_bytes(bytes(body) + bytes(central)
                       + build_eocd(total_entries + len(local_offsets), len(central), new_cd_offset))

    # Pastikan entri lama tidak tersentuh.
    with zipfile.ZipFile(output) as archive:
        for filename, expected in previous.items():
            if archive.read(filename) != expected:
                raise SystemExit(f"entri {filename} berubah setelah penyisipan DEX")
        for name, _, _, _, _, _ in local_offsets:
            if name.decode() not in archive.namelist():
                raise SystemExit(f"entri {name!r} tidak masuk ke APK")


def data_offset(apk: Path, name: str) -> int:
    with zipfile.ZipFile(apk) as archive:
        info = archive.getinfo(name)
    with apk.open("rb") as handle:
        handle.seek(info.header_offset)
        header = handle.read(30)
        _, _, _, _, _, _, _, _, _, name_length, extra_length = struct.unpack("<IHHHHHIIIHH", header)
    return info.header_offset + 30 + name_length + extra_length


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--resources", required=True, type=Path, help="APK hasil aapt2 link")
    parser.add_argument("--dex", required=True, type=Path, help="folder berisi classes*.dex")
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--check-alignment", action="store_true")
    args = parser.parse_args()

    dex_files = sorted(args.dex.glob("classes*.dex"))
    if not dex_files:
        raise SystemExit(f"tidak ada berkas DEX di {args.dex}")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    append_dex(args.resources, dex_files, args.output)

    with zipfile.ZipFile(args.output) as archive:
        broken = archive.testzip()
        if broken is not None:
            raise SystemExit(f"APK rusak pada entri {broken}")
        infos = archive.infolist()
        arsc = archive.getinfo("resources.arsc")
        dex_names = [info.filename for info in infos if info.filename.endswith(".dex")]

    print(f"APK  : {args.output}")
    print(f"entri: {len(infos)}  dex: {', '.join(dex_names)}")
    print(f"resources.arsc tanpa kompresi: {arsc.compress_type == zipfile.ZIP_STORED}")

    if args.check_alignment:
        arsc_offset = data_offset(args.output, "resources.arsc")
        print(f"offset data resources.arsc: {arsc_offset} (mod 4 = {arsc_offset % 4})")
        if arsc_offset % 4 != 0:
            raise SystemExit("resources.arsc tidak selaras 4 byte — Android 11+ akan menolak APK ini")
        for name in dex_names:
            with zipfile.ZipFile(args.output) as archive:
                stored = archive.getinfo(name).compress_type == zipfile.ZIP_STORED
            if stored:
                offset = data_offset(args.output, name)
                print(f"offset data {name}: {offset} (mod 4 = {offset % 4})")
                if offset % 4 != 0:
                    raise SystemExit(f"{name} disimpan tanpa kompresi tetapi tidak selaras 4 byte")

    print(f"sha256: {hashlib.sha256(args.output.read_bytes()).hexdigest()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
