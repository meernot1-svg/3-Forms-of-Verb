#!/usr/bin/env python3
"""Render each PDF page to a PNG image for OCR/VLM extraction."""
import fitz, os
PDF = "/home/z/my-project/upload/A_to_Z_English_Verbs_Full_Pack.pdf"
OUT_DIR = "/home/z/my-project/pdf_pages"
os.makedirs(OUT_DIR, exist_ok=True)
doc = fitz.open(PDF)
zoom = 2.4  # high-res for clear OCR
mat = fitz.Matrix(zoom, zoom)
for i, page in enumerate(doc):
    pix = page.get_pixmap(matrix=mat)
    out = os.path.join(OUT_DIR, f"page_{i+1:02d}.png")
    pix.save(out)
    print(f"saved {out} ({pix.width}x{pix.height})")
print("DONE")
