"""One-off: write minimal OOXML docx for seed (run from repo root: python backend/scripts/write_default_resume_docx.py)."""
import os
import zipfile

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "app", "assets", "templates", "default_resume_template.docx")

PARTS: dict[str, bytes] = {
	"[Content_Types].xml": b"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>""",
	"_rels/.rels": b"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>""",
	"word/_rels/document.xml.rels": b"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>""",
	"word/document.xml": """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>이력서 양식 (기본) — 정해진 워드 양식을 작성하여 업로드해 주세요.</w:t></w:r></w:p></w:body></w:document>""".encode(
		"utf-8"
	),
}


def main() -> None:
	os.makedirs(os.path.dirname(OUT), exist_ok=True)
	with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as zf:
		for name, data in PARTS.items():
			zf.writestr(name, data)
	print("Wrote", OUT)


if __name__ == "__main__":
	main()
