"""Builds tiny text PDFs (Courier, one line per Tj) for tests. Synthetic only."""


def make_pdf(pages, path):
    objs = []
    objs.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    n = len(pages)
    kids = " ".join(f"{3 + 2 * i} 0 R" for i in range(n))
    objs.append(f"<< /Type /Pages /Kids [{kids}] /Count {n} >>".encode())
    font_id = 3 + 2 * n
    for i, lines in enumerate(pages):
        objs.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 700 800] /Contents {4 + 2 * i} 0 R /Resources << /Font << /F1 {font_id} 0 R >> >> >>".encode())
        parts = ["BT /F1 9 Tf 11 TL 20 780 Td"]
        for ln in lines:
            esc = ln.replace("\\", "\\\\").replace("(", "\(").replace(")", "\)")
            parts.append(f"({esc}) Tj T*")
        parts.append("ET")
        stream = "\n".join(parts).encode("latin-1")
        objs.append(b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream")
    objs.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>")
    out = bytearray(b"%PDF-1.4\n")
    offs = []
    for i, o in enumerate(objs):
        offs.append(len(out))
        out += f"{i + 1} 0 obj\n".encode() + o + b"\nendobj\n"
    x = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode()
    for o in offs:
        out += f"{o:010d} 00000 n \n".encode()
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{x}\n%%EOF".encode()
    with open(path, "wb") as f:
        f.write(bytes(out))


def blank_pdf(path):
    make_pdf([[]], path)
