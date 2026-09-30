#!/usr/bin/env python3
"""
Extract A-Z English verbs from the PDF:
"English Verbs with Forms and Meaning" by Majid Ali Lashari Baloch.

Output: verbs.json with the structure required by the app.
Also prints an extraction report.
"""
import json, re, sys, os
from collections import defaultdict
import pdfplumber

PDF_PATH = "/home/z/my-project/upload/A_to_Z_English_Verbs_Full_Pack.pdf"
OUT_PATH = "/home/z/my-project/public/verbs.json"
REPORT_PATH = "/home/z/my-project/extraction_report.json"

# ---- Sindhi Unicode range helper ----
SINDHI_RE = re.compile(r'[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+')

def is_sindhi(s):
    return bool(SINDHI_RE.search(s or ""))

def clean(s):
    if s is None:
        return ""
    return re.sub(r'\s+', ' ', str(s)).strip()

# ---------- Heuristic line parser ----------
# The book lists verbs roughly as:
#   VerbForm1   VerbForm2   VerbForm3   SindhiMeaning
# but PDFs often misalign columns, so we parse using text + positional cues.

def parse_line(text):
    """Try to extract a verb entry from a single text line."""
    t = clean(text)
    if not t:
        return None
    # drop page numbers / pure digits / headers
    if re.fullmatch(r'\d+', t):
        return None
    if len(t) < 3:
        return None
    # Skip obvious header/footer noise
    low = t.lower()
    if any(low == h for h in (
        'english verbs with forms and meaning', 'verb', 'first form',
        'second form', 'third form', 'sindhi meaning', 's.no', 's#')):
        return None
    return t

def extract_verb_from_tokens(tokens, sindhi_text, page):
    """
    Given the English tokens and the Sindhi portion, build an entry.
    English part typically: form1 form2 form3  (sometimes 1 or 2 forms if regular)
    """
    if not tokens:
        return None
    first = tokens[0]
    # guess the forms
    if len(tokens) >= 3:
        f1, f2, f3 = tokens[0], tokens[1], tokens[2]
    elif len(tokens) == 2:
        f1, f2, f3 = tokens[0], tokens[1], tokens[1]
    else:
        f1 = tokens[0]
        # regular verb guess
        if first.endswith('e'):
            f2 = first + 'd'
            f3 = first + 'd'
        elif first.endswith('y') and len(first) > 1 and first[-2] not in 'aeiou':
            f2 = first[:-1] + 'ied'
            f3 = first[:-1] + 'ied'
        else:
            f2 = first + 'ed'
            f3 = first + 'ed'
    # sanity: the first form must look like a word (letters only, maybe with hyphen)
    if not re.fullmatch(r"[A-Za-z][A-Za-z'-]*", f1):
        return None
    return {
        "first_form": f1.lower(),
        "second_form": f2.lower(),
        "third_form": f3.lower(),
        "sindhi_meaning": sindhi_text,
        "page": page,
    }

def split_english_sindhi(line):
    """
    Split a line into English part and Sindhi part.
    Sindhi script starts at the first Arabic-block character.
    """
    m = SINDHI_RE.search(line)
    if not m:
        return line, ""
    sindhi = line[m.start():]
    # extend sindhi backwards to capture full RTL run start
    # find where sindhi run begins (last non-sindhi char before)
    eng = line[:m.start()].strip()
    # Sindhi may have spaces inside; keep all from m.start() onward
    return eng, sindhi.strip()

# ---------- Main extraction ----------
def main():
    entries = []
    needs_review = []
    page_count = 0

    with pdfplumber.open(PDF_PATH) as pdf:
        page_count = len(pdf.pages)
        for pageno, page in enumerate(pdf.pages, start=1):
            # Try table extraction first (most reliable for structured books)
            tables = page.extract_tables()
            lines_text = []
            if tables:
                for tbl in tables:
                    for row in tbl:
                        cells = [clean(c) for c in row if c is not None]
                        if cells:
                            lines_text.append(" | ".join(cells))
            # Also grab raw text lines
            raw = page.extract_text() or ""
            for ln in raw.split("\n"):
                lines_text.append(ln)

            for raw_line in lines_text:
                # If table line had pipes, join them
                line = raw_line.replace(" | ", " ").replace("|", " ")
                line = clean(line)
                if not line:
                    continue
                # Try to find Sindhi part
                eng, sind = split_english_sindhi(line)
                if not eng:
                    continue
                # Tokenise english: split on whitespace, keep letter tokens
                # Some lines have a leading serial number like "1." or "1) capture ..."
                eng2 = re.sub(r'^\s*\d+[\.\)]\s*', '', eng)
                toks = eng2.split()
                # Filter to tokens that look like verb forms (letters + optional hyphen)
                verb_toks = [t for t in toks if re.fullmatch(r"[A-Za-z][A-Za-z'-]*", t)]
                if not verb_toks:
                    continue
                # Heuristic: if there are non-letter tokens mixed (like '|'), skip
                ent = extract_verb_from_tokens(verb_toks, sind, pageno)
                if not ent:
                    continue
                # Validation flags
                uncertain = False
                if not sind:
                    uncertain = True
                # if 2nd/3rd forms look auto-generated and word is likely irregular
                if ent["second_form"] == ent["third_form"] and not (
                    ent["first_form"] + 'ed' == ent["second_form"]
                    or ent["first_form"] + 'd' == ent["second_form"]
                    or (ent["first_form"].endswith('y') and ent["second_form"].endswith('ied'))
                ):
                    # forms might be wrong (we guessed). mark review.
                    if ent["first_form"] not in (ent["second_form"], ent["third_form"]):
                        uncertain = True
                entries.append((ent, uncertain))

    # Deduplicate by first_form, prefer entries with sindhi meaning and explicit forms
    by_id = {}  # key -> (ent, uncertain, better)
    for ent, uncertain in entries:
        key = ent["first_form"]
        better = (bool(ent["sindhi_meaning"]), not uncertain)
        if key not in by_id or better > by_id[key][2]:
            by_id[key] = (ent, uncertain, better)
    final = []
    review_list = []
    for key, (ent, uncertain, better) in by_id.items():
        chapter = key[0].upper()
        # Detect irregular (compare generated regular forms)
        reg_ed = ent["first_form"] + 'ed'
        reg_d = ent["first_form"] + 'd'
        reg_ied = ent["first_form"][:-1] + 'ied' if ent["first_form"].endswith('y') else None
        irregular = not (ent["second_form"] in (reg_ed, reg_d, reg_ied)
                         and ent["third_form"] in (reg_ed, reg_d, reg_ied))
        record = {
            "id": key,
            "chapter": chapter,
            "book_data": {
                "first_form": ent["first_form"],
                "second_form": ent["second_form"],
                "third_form": ent["third_form"],
                "sindhi_meaning": ent["sindhi_meaning"],
                "page": ent["page"],
            },
            "additional_info": {
                "part_of_speech": "verb",
                "english_meaning": "",
                "pronunciation_uk": "",
                "pronunciation_us": "",
                "easy_pronunciation": "",
                "present_participle": "",
                "third_person_singular": "",
                "irregular": irregular,
                "difficulty": "medium",
                "frequency": "medium",
                "senses": [],
                "examples": {"easy": "", "medium": "", "advanced": ""},
                "collocations": [],
                "used_with": [],
                "synonyms": [],
                "antonyms": [],
                "common_mistakes": [],
                "related_words": [],
                "phrasal_verbs": [],
                "memory_tip": "",
            },
            "needs_review": uncertain,
        }
        final.append(record)
        if uncertain:
            review_list.append({"id": key, "page": ent["page"],
                                "reason": "missing sindhi or guessed forms"})

    # Sort A-Z by id
    final.sort(key=lambda r: r["id"])
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(final, f, ensure_ascii=False, indent=2)

    # Build report
    per_letter = defaultdict(int)
    for r in final:
        per_letter[r["chapter"]] += 1
    report = {
        "total_verbs": len(final),
        "pages_read": page_count,
        "per_letter": {k: per_letter[k] for k in sorted(per_letter)},
        "empty_letters": [c for c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ" if per_letter[c] == 0],
        "needs_review_count": len(review_list),
        "needs_review": review_list[:80],
    }
    with open(REPORT_PATH, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"\nWrote {len(final)} verbs to {OUT_PATH}")

if __name__ == "__main__":
    main()
