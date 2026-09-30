#!/usr/bin/env python3
"""
Extract verbs from every PDF page image using the z-ai vision CLI (VLM),
then merge, clean, and write the final verbs.json + extraction report.
"""
import json, os, re, subprocess, sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import defaultdict

PAGES_DIR = "/home/z/my-project/pdf_pages"
RAW_DIR = "/home/z/my-project/pdf_raw"
OUT_PATH = "/home/z/my-project/public/verbs.json"
REPORT_PATH = "/home/z/my-project/extraction_report.json"
os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)

PROMPT = (
    "This is a page from an English verbs learning book for Sindhi-speaking students. "
    "The page has a table with 4 columns: I Form (base form), II Form (past), "
    "III Form (past participle), and Meaning (Sindhi in Arabic script). "
    "Extract EVERY verb row on the page as a JSON array. "
    "Each element must be: {\"first_form\": \"\", \"second_form\": \"\", \"third_form\": \"\", \"sindhi_meaning\": \"\"}. "
    "Rules: copy the English forms EXACTLY as printed (lowercase, no 'To ' prefix, no trailing punctuation); "
    "if a regular verb shows the same word 3 times, copy it 3 times; "
    "preserve the Sindhi/Arabic-script text EXACTLY as printed (keep spaces, commas,،); "
    "do NOT translate Sindhi; do NOT skip any row; do NOT invent data. "
    "Output ONLY the JSON array inside a ```json code fence, no commentary."
)

def run_page(page_file):
    name = os.path.basename(page_file)
    out = os.path.join(RAW_DIR, name.replace(".png", ".json"))
    if os.path.exists(out) and os.path.getsize(out) > 50:
        return name, out, True
    import time
    last_err = ""
    for attempt in range(5):
        try:
            r = subprocess.run(
                ["z-ai", "vision", "-p", PROMPT, "-i", page_file, "-o", out],
                capture_output=True, text=True, timeout=240
            )
            if os.path.exists(out) and os.path.getsize(out) > 50:
                return name, out, True
            # likely 429 or error; wait and retry
            last_err = (r.stderr or r.stdout or "")[-200:]
            # longer backoff
            time.sleep(20 + attempt * 20)
        except Exception as e:
            last_err = str(e)
            time.sleep(20 + attempt * 20)
    return name, out, False

def parse_vlm_output(path):
    """Pull the JSON array out of a z-ai CLI output file."""
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception:
        return []
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    if not content:
        return []
    # strip code fences
    m = re.search(r'```(?:json)?\s*(\[.*?\])\s*```', content, re.DOTALL)
    if m:
        content = m.group(1)
    else:
        m = re.search(r'(\[.*\])', content, re.DOTALL)
        if m:
            content = m.group(1)
    try:
        arr = json.loads(content)
        if isinstance(arr, list):
            return arr
    except Exception:
        pass
    # last resort: find first { ... } blocks
    items = re.findall(r'\{[^{}]*\}', content, re.DOTALL)
    out = []
    for it in items:
        try:
            out.append(json.loads(it))
        except Exception:
            pass
    return out

def clean_form(s):
    if not s:
        return ""
    s = str(s).strip()
    # remove leading "To "
    s = re.sub(r'^(?:to|To)\s+', '', s)
    # remove trailing punctuation
    s = s.strip().strip('.,;:()')
    # lowercase first form
    return s

def main():
    pages = sorted([os.path.join(PAGES_DIR, f) for f in os.listdir(PAGES_DIR) if f.endswith('.png')])
    # skip page 1 (title) — but include it just in case, it'll be empty
    print(f"Processing {len(pages)} pages with VLM (sequential, retry+backoff)...")
    results = {}
    import time
    for i, p in enumerate(pages):
        name, out, ok = run_page(p)
        results[name] = (out, ok)
        print(f"  [{i+1}/{len(pages)}] {name}: {'OK' if ok else 'FAIL'}")
        # gentle pacing between pages to avoid 429
        if i < len(pages) - 1:
            time.sleep(8)
    # Parse all
    all_entries = []
    page_status = {}
    for name in sorted(results):
        out, ok = results[name]
        page_no = int(re.search(r'\d+', name).group())
        if not ok:
            page_status[page_no] = "failed"
            continue
        arr = parse_vlm_output(out)
        page_status[page_no] = f"ok({len(arr)})"
        for e in arr:
            if not isinstance(e, dict):
                continue
            ff = clean_form(e.get("first_form", ""))
            sf = clean_form(e.get("second_form", ""))
            tf = clean_form(e.get("third_form", ""))
            sind = (e.get("sindhi_meaning") or "").strip()
            if not ff:
                continue
            if not sf:
                sf = ff
            if not tf:
                tf = sf
            all_entries.append({
                "first_form": ff.lower(),
                "second_form": sf.lower(),
                "third_form": tf.lower(),
                "sindhi_meaning": sind,
                "page": page_no,
            })
    # Deduplicate by first_form; prefer entries that have a sindhi meaning
    by_id = {}
    for e in all_entries:
        key = e["first_form"]
        if not key or not re.fullmatch(r"[a-z][a-z'-]*", key):
            continue
        has_sind = bool(e["sindhi_meaning"])
        if key not in by_id or (has_sind and not by_id[key]["sindhi_meaning"]):
            by_id[key] = e
        elif has_sind and by_id[key]["sindhi_meaning"] and len(e["sindhi_meaning"]) > len(by_id[key]["sindhi_meaning"]):
            by_id[key] = e
    # Build final records
    final = []
    review_list = []
    for key in sorted(by_id):
        e = by_id[key]
        chapter = key[0].upper()
        ff = e["first_form"]
        sf = e["second_form"]
        tf = e["third_form"]
        # irregular detection
        reg_ed = ff + 'ed'
        reg_d = ff + 'd'
        reg_ied = (ff[:-1] + 'ied') if ff.endswith('y') and len(ff) > 1 and ff[-2] not in 'aeiou' else None
        regular_guesses = {reg_ed, reg_d}
        if reg_ied:
            regular_guesses.add(reg_ied)
        irregular = not (sf in regular_guesses and tf in regular_guesses)
        # present participle / 3rd person singular
        def ing(w):
            if w.endswith('e') and len(w) > 1 and w[-2] not in 'aeiou':
                return w[:-1] + 'ing'
            if w.endswith('y'):
                return w[:-1] + 'ying' if len(w) > 1 and w[-2] not in 'aeiou' else w + 'ing'
            # consonant doubling heuristic (CVC)
            if len(w) >= 3 and w[-1] not in 'aeiou' and w[-2] in 'aeiou' and w[-3] not in 'aeiou' and w[-1] not in 'wxy':
                return w + w[-1] + 'ing'
            return w + 'ing'
        def s3(w):
            if w.endswith('s') or w.endswith('x') or w.endswith('ch') or w.endswith('sh') or w.endswith('z'):
                return w + 'es'
            if w.endswith('y') and len(w) > 1 and w[-2] not in 'aeiou':
                return w[:-1] + 'ies'
            if w.endswith('o') and len(w) > 1 and w[-2] not in 'aeiou':
                return w + 'es'
            return w + 's'
        uncertain = (not e["sindhi_meaning"]) or (irregular and sf == tf and sf == ff)
        record = {
            "id": key,
            "chapter": chapter,
            "book_data": {
                "first_form": ff,
                "second_form": sf,
                "third_form": tf,
                "sindhi_meaning": e["sindhi_meaning"],
                "page": e["page"],
            },
            "additional_info": {
                "part_of_speech": "verb",
                "english_meaning": "",
                "pronunciation_uk": "",
                "pronunciation_us": "",
                "easy_pronunciation": "",
                "present_participle": ing(ff),
                "third_person_singular": s3(ff),
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
            review_list.append({"id": key, "page": e["page"],
                                "reason": "missing sindhi or possibly-guessed forms"})

    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(final, f, ensure_ascii=False, indent=2)
    # Report
    per_letter = defaultdict(int)
    for r in final:
        per_letter[r["chapter"]] += 1
    report = {
        "total_verbs": len(final),
        "pages_processed": len(pages),
        "page_status": page_status,
        "per_letter": {k: per_letter[k] for k in sorted(per_letter)},
        "empty_letters": [c for c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ" if per_letter.get(c, 0) == 0],
        "needs_review_count": len(review_list),
        "needs_review": review_list,
        "sample_entries": [{"id": r["id"], "forms": [r["book_data"]["first_form"], r["book_data"]["second_form"], r["book_data"]["third_form"]], "sindhi": r["book_data"]["sindhi_meaning"], "page": r["book_data"]["page"]} for r in final[:15]],
    }
    with open(REPORT_PATH, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print("\n===== EXTRACTION REPORT =====")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"\nWrote {len(final)} verbs to {OUT_PATH}")

if __name__ == "__main__":
    main()
