import fitz
import re
import json

doc = fitz.open("INV_彙整題庫1000題-章節分段版.pdf")
print("Total pages in doc:", len(doc))

chapter_map = {
    1: "第一章 投資型保險概論",
    2: "第二章 投資型保險商品種類與特性",
    3: "第三章 投資型保險條款解析",
    4: "第四章 投資型保險之銷售規範與自律",
    5: "第五章 投資型保險之租稅優惠與相關法規",
    6: "第六章 金融市場與金融工具",
    7: "第七章 債券評價與投資風險",
    8: "第八章 股票評價與分析",
    9: "第九章 投資組合理論與績效評估",
    10: "第十章 共同基金與衍生性商品"
}

# Define subject mapping
# 第一科：第一章～第四章
# 第二科：第五章～第十章
def get_subject(ch_name):
    for num in [1, 2, 3, 4]:
        if chapter_map[num] in ch_name or f"第{['一','二','三','四'][num-1]}章" in ch_name:
            return "第一科：投資型保險商品概要、金融體系概述"
    return "第二科：投資學概要、債券與證券之評價分析、投資組合管理"

def parse_options(opt_text):
    if not opt_text:
        return {}
    text = opt_text.strip().replace('（', '(').replace('）', ')')
    pattern = r'\(([A-D])\)\s*'
    parts = re.split(pattern, text)
    opts = {}
    if len(parts) >= 3:
        for i in range(1, len(parts), 2):
            letter = parts[i]
            val = parts[i+1].strip()
            # Clean up trailing spaces and any stray newlines
            val = re.sub(r'\s+', ' ', val).strip()
            opts[letter] = val
    return opts

current_chapter = "第一章 投資型保險概論"
questions = []

for pno in range(len(doc)):
    page = doc[pno]
    raw_text = page.get_text("text")
    for line in raw_text.split('\n'):
        line = line.strip()
        m = re.search(r'(第[一二三四五六七八九十]+章\s*[^頁\n]+)', line)
        if m:
            ch_candidate = m.group(1).strip()
            for k, v in chapter_map.items():
                if v.split()[0] in ch_candidate:
                    current_chapter = v
                    break

    tabs = page.find_tables()
    for tab in tabs.tables:
        rows = tab.extract()
        for r in rows:
            if not r or len(r) < 4:
                continue
            q_num_str = str(r[0]).strip() if r[0] is not None else ''
            if not re.match(r'^\d+$', q_num_str):
                continue
            
            q_id = int(q_num_str)
            q_text = str(r[1]).strip().replace('\n', '') if r[1] is not None else ''
            opt_raw = str(r[2]).strip() if r[2] is not None else ''
            ans_str = str(r[3]).strip().upper().replace('\n', '') if r[3] is not None else ''
            
            exp_str = ''
            if len(r) >= 5 and r[4] is not None:
                exp_str = str(r[4]).strip().replace('\n', '')
                if exp_str == '—' or exp_str == '-' or exp_str == '':
                    exp_str = ''

            options = parse_options(opt_raw)
            subject = get_subject(current_chapter)
            
            # Format clean cleaned question text
            q_text_clean = re.sub(r'\s+', ' ', q_text).strip()
            
            questions.append({
                "id": q_id,
                "subject": subject,
                "chapter": current_chapter,
                "question": q_text_clean,
                "options": options,
                "answer": ans_str,
                "explanation": exp_str,
                "page": pno + 1
            })

# Sort by id
questions.sort(key=lambda x: x["id"])

print(f"Total processed questions: {len(questions)}")

# Write to JSON
with open("inv_questions.json", "w", encoding="utf-8") as f:
    json.dump(questions, f, ensure_ascii=False, indent=2)

# Write to JS
with open("inv_questions.js", "w", encoding="utf-8") as f:
    f.write("// 投資型保險商品業務員資格測驗 完整題庫 (1000題)\n")
    f.write("window.INV_QUESTIONS = ")
    json.dump(questions, f, ensure_ascii=False, indent=2)
    f.write(";\n")

print("Successfully generated inv_questions.json and inv_questions.js!")
