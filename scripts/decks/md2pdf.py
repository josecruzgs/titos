#!/usr/bin/env python3
"""Markdown -> PDF deck, estilo LINEAR FROST (off-white + violeta + mono).

Lee .md (separado por `---` entre slides), detecta el tipo de slide via
comentario `<!-- slide:TYPE -->` (cover/section/screenshot/quote/stats/
two-col/content/end), aplica template correspondiente, renderiza HTML
y exporta PDF A4 landscape via Playwright/Chromium.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import markdown
from playwright.sync_api import sync_playwright

if len(sys.argv) < 3:
    print("usage: md2pdf.py input.md output.pdf", file=sys.stderr)
    sys.exit(1)

INPUT = Path(sys.argv[1]).resolve()
OUTPUT = Path(sys.argv[2]).resolve()
BRAND = sys.argv[3] if len(sys.argv) > 3 else "Titos"

raw = INPUT.read_text(encoding="utf-8")

fm: dict[str, str] = {}
fm_match = re.match(r"^---\s*\n(.*?)\n---\s*\n", raw, re.DOTALL)
if fm_match:
    for line in fm_match.group(1).splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            fm[k.strip()] = v.strip().strip('"')
    raw = raw[fm_match.end():]

slides_md = [s.strip() for s in re.split(r"^---\s*$", raw, flags=re.MULTILINE) if s.strip()]

SLIDE_TYPE_RE = re.compile(r"<!--\s*slide:(\w+(?:-\w+)*)\s*-->")
md_renderer = markdown.Markdown(extensions=["tables", "fenced_code", "attr_list"])

slides_html = []
for i, s_md in enumerate(slides_md):
    m = SLIDE_TYPE_RE.search(s_md)
    slide_type = m.group(1) if m else "content"
    s_md_clean = SLIDE_TYPE_RE.sub("", s_md).strip()

    if i == 0 and slide_type == "content":
        slide_type = "cover"

    body_html = md_renderer.convert(s_md_clean)
    md_renderer.reset()

    if slide_type == "two-col":
        img_match = re.search(r"<p>\s*<img[^>]*>\s*</p>", body_html)
        if img_match:
            img_html = img_match.group(0)
            text_html = body_html[: img_match.start()] + body_html[img_match.end() :]
            body_html = f'<div class="col-text">{text_html}</div><div class="col-img">{img_html}</div>'

    page_num = i + 1
    total = len(slides_md)

    slides_html.append(
        f'<section class="slide slide-{slide_type}" data-page="{page_num}" data-total="{total}">'
        f'<div class="content">{body_html}</div>'
        f'<footer class="page-meta">'
        f'<span class="brand">{BRAND}</span>'
        f'<span class="num">{page_num:02d} / {total:02d}</span>'
        f'</footer>'
        f'</section>'
    )

css = """
@page { size: A4 landscape; margin: 0; }

* { box-sizing: border-box; }

:root {
  --bg: #FAFAFA;
  --gray-100: #F4F4F5;
  --ink: #0F0F0F;
  --ink-soft: #27272A;
  --ink-mid: #52525B;
  --ink-muted: #71717A;
  --accent: #5E6AD2;
  --accent-soft: #ECEDFB;
  --accent-tint: rgba(94,106,210,0.08);
  --border: #E4E4E7;
  --white: #FFFFFF;
}

html, body {
  margin: 0; padding: 0;
  font-family: 'Inter', -apple-system, sans-serif;
  color: var(--ink);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.slide {
  width: 297mm;
  height: 210mm;
  padding: 18mm 22mm;
  page-break-after: always;
  page-break-inside: avoid;
  position: relative;
  background: var(--bg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--border);
}

.slide .content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  width: 100%;
  max-width: 245mm;
  z-index: 2;
}

.page-meta {
  position: absolute;
  bottom: 9mm;
  left: 22mm;
  right: 22mm;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-muted);
  z-index: 3;
}

.page-meta .brand {
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
  color: var(--ink);
}

.page-meta .brand::before {
  content: "";
  display: inline-block;
  width: 6px; height: 6px;
  background: var(--accent);
  border-radius: 50%;
  vertical-align: middle;
  margin-right: 8px;
}

.page-meta .num { font-variant-numeric: tabular-nums; }

/* ============ COVER ============ */
.slide-cover {
  background: var(--ink);
  color: #FAFAFA;
  padding: 0;
  justify-content: center;
  border-top: none;
}

.slide-cover .content {
  justify-content: center;
  padding: 28mm 28mm;
  max-width: 100%;
}

.slide-cover h1 {
  font-family: 'Inter';
  font-size: 96px;
  font-weight: 600;
  line-height: 0.95;
  margin: 0 0 20px;
  letter-spacing: -0.04em;
  color: #FAFAFA;
  padding-bottom: 18px;
  border-bottom: 2px solid var(--accent);
  display: inline-block;
  width: fit-content;
}

.slide-cover h2 {
  font-family: 'Inter';
  font-size: 26px;
  font-weight: 500;
  color: var(--accent);
  margin: 22px 0 20px;
  letter-spacing: -0.005em;
  max-width: 75%;
}

.slide-cover p {
  font-size: 18px;
  line-height: 1.55;
  color: rgba(250,250,250,0.65);
  max-width: 62%;
  font-weight: 400;
  margin: 0 0 12px;
}

.slide-cover .page-meta { color: rgba(250,250,250,0.4); }
.slide-cover .page-meta .brand { color: #FAFAFA; }

/* ============ SECTION ============ */
.slide-section {
  background: var(--gray-100);
  justify-content: center;
}

.slide-section .content { justify-content: center; padding: 0; }

.slide-section h1 {
  font-family: 'Inter';
  font-size: 80px;
  font-weight: 500;
  line-height: 0.95;
  letter-spacing: -0.03em;
  margin: 0 0 20px;
  color: var(--ink);
  max-width: 85%;
}

.slide-section h2 {
  font-family: 'Inter';
  font-size: 22px;
  font-weight: 400;
  color: var(--ink-mid);
  margin: 0;
  max-width: 68%;
  line-height: 1.4;
}

/* ============ CONTENT (default) ============ */
.slide-content h1, .slide-screenshot h1, .slide-two-col h1 {
  font-family: 'Inter';
  font-size: 38px;
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.02em;
  margin: 0 0 10px;
  color: var(--ink);
}

.slide-content h2, .slide-screenshot h2, .slide-two-col h2 {
  font-family: 'Inter';
  font-size: 15px;
  font-weight: 500;
  color: var(--ink-muted);
  margin: 0 0 22px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.slide-content h3 {
  font-family: 'Inter';
  font-size: 17px;
  font-weight: 600;
  margin: 20px 0 8px;
  color: var(--ink-soft);
}

.slide-content p, .slide-screenshot p, .slide-two-col p {
  font-size: 16px;
  line-height: 1.6;
  margin: 0 0 12px;
  color: var(--ink-mid);
  max-width: 220mm;
}

.slide-content ul, .slide-content ol, .slide-two-col ul {
  font-size: 16px;
  line-height: 1.7;
  padding-left: 0;
  margin: 0 0 12px;
  color: var(--ink-mid);
  list-style: none;
}

.slide-content li, .slide-two-col li {
  margin-bottom: 9px;
  padding-left: 20px;
  position: relative;
}

.slide-content li::before, .slide-two-col li::before {
  content: "\\2013";
  position: absolute;
  left: 0;
  color: var(--accent);
  font-weight: 600;
}

/* ============ QUOTE ============ */
.slide-quote {
  background: var(--ink);
  color: #FAFAFA;
  justify-content: center;
  border-top: none;
}

.slide-quote .content { justify-content: center; padding: 28mm 28mm; }

.slide-quote blockquote {
  font-family: 'Inter';
  font-size: 44px;
  line-height: 1.2;
  font-weight: 400;
  font-style: italic;
  color: #FAFAFA;
  margin: 0 0 28px;
  padding: 0 0 0 28px;
  border-left: 3px solid var(--accent);
  background: none;
  letter-spacing: -0.01em;
  max-width: 90%;
}

.slide-quote blockquote p { margin: 0; }

.slide-quote p:not(blockquote p) {
  font-size: 15px;
  color: var(--accent);
  margin: 0 0 0 31px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-family: 'JetBrains Mono', monospace;
}

.slide-quote .page-meta { color: rgba(250,250,250,0.4); }
.slide-quote .page-meta .brand { color: #FAFAFA; }

/* ============ STATS ============ */
.slide-stats h1 {
  font-family: 'Inter';
  font-size: 34px;
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.015em;
  margin: 0 0 32px;
  color: var(--ink);
  max-width: 80%;
}

.slide-stats ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0;
  max-width: 100%;
  border-top: 1px solid var(--border);
  border-left: 1px solid var(--border);
}

.slide-stats ul li {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 20px;
  border-right: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

.slide-stats ul li > strong {
  font-family: 'JetBrains Mono', monospace;
  font-size: 46px;
  font-weight: 600;
  color: var(--accent);
  line-height: 1;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
  display: block;
  margin-bottom: 10px;
}

.slide-stats ul li {
  font-size: 12.5px;
  color: var(--ink-muted);
  line-height: 1.35;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* ============ SCREENSHOT ============ */
.slide-screenshot { padding: 14mm 22mm; }

.slide-screenshot h1 { font-size: 28px; margin-bottom: 2px; }
.slide-screenshot h2 { font-size: 13px; margin-bottom: 12px; }
.slide-screenshot p {
  font-size: 13.5px;
  line-height: 1.45;
  max-width: 200mm;
  color: var(--ink-mid);
}

.slide-screenshot img {
  display: block;
  max-width: 100%;
  max-height: 142mm;
  margin: 6px auto 8px;
  border-radius: 6px;
  border: 1px solid var(--border);
  box-shadow: 0 16px 40px -20px rgba(15,15,15,0.25);
}

/* ============ TWO-COL ============ */
.slide-two-col .content {
  flex-direction: row;
  gap: 16mm;
  align-items: flex-start;
}

.slide-two-col .col-text, .slide-two-col .col-img { flex: 1; min-width: 0; }

.slide-two-col img {
  width: 100%;
  max-height: 150mm;
  object-fit: cover;
  object-position: top;
  border-radius: 6px;
  border: 1px solid var(--border);
  box-shadow: 0 16px 40px -20px rgba(15,15,15,0.2);
}

/* ============ END ============ */
.slide-end {
  background: var(--ink);
  color: #FAFAFA;
  border-top: none;
}

.slide-end h1 {
  font-family: 'Inter';
  font-size: 72px;
  font-weight: 600;
  line-height: 1.02;
  letter-spacing: -0.03em;
  color: #FAFAFA;
  margin: 0 0 18px;
  max-width: 80%;
}

.slide-end h2 {
  font-family: 'Inter';
  font-size: 22px;
  font-weight: 400;
  color: rgba(250,250,250,0.75);
  margin: 0 0 28px;
  max-width: 72%;
  line-height: 1.4;
}

.slide-end p {
  font-size: 17px;
  color: var(--accent);
  line-height: 1.5;
  max-width: 60%;
  margin: 0;
  font-family: 'JetBrains Mono', monospace;
}

.slide-end .page-meta { color: rgba(250,250,250,0.4); }
.slide-end .page-meta .brand { color: #FAFAFA; }

/* ============ Generic ============ */
.slide blockquote {
  border-left: 3px solid var(--accent);
  padding: 10px 0 10px 18px;
  margin: 14px 0;
  font-style: italic;
  color: var(--ink-soft);
  background: var(--accent-tint);
  font-size: 15px;
}

.slide blockquote p { margin: 4px 0; }

.slide table {
  width: 100%;
  border-collapse: collapse;
  margin: 14px 0;
  font-size: 13px;
  border: 1px solid var(--border);
}

.slide table th {
  background: var(--ink);
  color: #FAFAFA;
  text-align: left;
  padding: 9px 12px;
  font-weight: 500;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  font-size: 10.5px;
}

.slide table td {
  padding: 9px 12px;
  border-bottom: 1px solid var(--border);
  border-right: 1px solid var(--border);
  background: var(--white);
  vertical-align: top;
  color: var(--ink-soft);
}

.slide table tr:last-child td { border-bottom: none; }

.slide code {
  background: var(--accent-tint);
  color: #3D3FA8;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 0.92em;
  font-family: 'JetBrains Mono', monospace;
}

.slide pre {
  background: var(--ink);
  color: #FAFAFA;
  padding: 16px;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 13px;
  font-family: 'JetBrains Mono', monospace;
}

.slide strong { font-weight: 600; color: var(--ink); }

.slide hr { display: none; }
"""

title = fm.get("title", INPUT.stem)

html = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>{title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>{css}</style>
</head>
<body>
{''.join(slides_html)}
</body>
</html>
"""

tmp_html = INPUT.parent / f".{INPUT.stem}.tmp.html"
tmp_html.write_text(html, encoding="utf-8")

with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context()
    page = context.new_page()
    page.goto(f"file://{tmp_html}", wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(1200)
    page.pdf(
        path=str(OUTPUT),
        width="297mm",
        height="210mm",
        margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
        print_background=True,
        prefer_css_page_size=True,
    )
    browser.close()

tmp_html.unlink(missing_ok=True)

size_kb = OUTPUT.stat().st_size // 1024
print(f"OK {OUTPUT.name} - {len(slides_md)} slides, {size_kb} KB")
