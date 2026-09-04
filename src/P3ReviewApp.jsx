import { useState, useEffect, useRef } from "react";

/* ================= helpers ================= */
const T = (x, lg) =>
  x && typeof x === "object" && (x.th !== undefined || x.en !== undefined)
    ? (x[lg] ?? x.th ?? x.en)
    : x;

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const norm = (s) =>
  String(s).toLowerCase().trim().replace(/[,\s]/g, "").replace(/[.!?']/g, "");

/* ---- text-to-speech: reads Thai or English aloud using the device voice ---- */
const hasTTS = typeof window !== "undefined" && "speechSynthesis" in window;
const isThai = (s) => /[\u0E00-\u0E7F]/.test(String(s));
function speak(text, lg) {
  if (!hasTTS || !text) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    // choose language by the text itself (Thai chars => th), else fall back to app language
    u.lang = isThai(text) ? "th-TH" : (lg === "th" ? "th-TH" : "en-US");
    u.rate = 0.9;
    const voices = window.speechSynthesis.getVoices() || [];
    const v = voices.find((vo) => vo.lang && vo.lang.toLowerCase().startsWith(u.lang.slice(0, 2)));
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch (e) { /* ignore */ }
}

/* least-seen-first sampler: unseen questions come first, ties broken randomly */
const pickN = (pool, n, seen) =>
  shuffle(pool)
    .sort((a, b) => (seen[a.qid] || 0) - (seen[b.qid] || 0))
    .slice(0, Math.min(n, pool.length));

/* filter items by exam term: "all" | "1" | "2" (defaults treat missing term as 1) */
const byExam = (items, exam) =>
  (!exam || exam === "all") ? items : items.filter((x) => String(x.term || 1) === String(exam));

/* ================= persistent storage ================= */
const STORE_KEY = "p3review-v2";
async function loadStore() {
  try {
    if (!window.storage) return null;
    const r = await window.storage.get(STORE_KEY);
    return r ? JSON.parse(r.value) : null;
  } catch {
    return null;
  }
}
function saveStore(s) {
  try {
    if (window.storage) window.storage.set(STORE_KEY, JSON.stringify(s)).catch(() => {});
  } catch {}
}

/* ================= UI strings ================= */
const UI = {
  th: {
    appTitle: "ติวสอบ ป.3", appSub: "เตรียมสอบครั้งที่ 1 ปี 2569 • IEP",
    pickSubject: "เลือกวิชา",
    mock: "ข้อสอบเสมือนจริง", mockSub: "20 ข้อ คละวิชา ไม่ซ้ำรอบเดิม",
    timed: "เกมจับเวลา 60 วิ", timedSub: "ตอบเร็ว เก็บแต้ม ทำสตรีค!",
    redo: "ทบทวนข้อที่เคยผิด", redoSub: "ตอบถูกแล้วข้อจะหายไปจากลิสต์",
    read: "อ่านเนื้อหา", readSub: "สรุปเนื้อหาละเอียดทุกวิชา อ่านก่อนทำแบบฝึกหัด",
    flash: "การ์ดทบทวน", quiz: "แบบฝึกหัดปรนัย (10 ข้อ/รอบ)", match: "เกมจับคู่", fill: "เติมคำตอบ",
    back: "กลับ", next: "ถัดไป", check: "ตรวจคำตอบ", flip: "แตะเพื่อพลิกการ์ด",
    correct: "ถูกต้อง! 🎉", wrong: "ยังไม่ถูก", score: "คะแนน", time: "เวลา",
    finish: "สรุปผล", again: "เล่นอีกครั้ง (ชุดใหม่)", home: "หน้าแรก",
    great: "เก่งมาก! ได้ดาวสะสม ⭐", good: "ทำได้ดี ลองอีกรอบให้ได้ดาวนะ", keep: "ไม่เป็นไร ฝึกอีกนิดนะ 💪",
    streak: "สตรีค", answerKey: "เฉลย + คำอธิบาย", yourAns: "คำตอบของหนู",
    typeHere: "พิมพ์คำตอบที่นี่…", submitExam: "ส่งข้อสอบ", question: "ข้อ",
    matched: "จับคู่ครบแล้ว!", mistakes: "พลาด", starBar: "ดาวสะสม",
    report: "รายงานผล", reportSub: "ดูความแม่นแต่ละวิชา สำหรับพ่อแม่",
    accuracy: "ความแม่น", attempts: "ทำไป", correctN: "ถูก", notYet: "ยังไม่ได้ทำ",
    overall: "ภาพรวมทั้งหมด", weakest: "วิชาที่ควรทบทวนเพิ่ม", strong: "ทำได้ดีมาก",
    listen: "ฟังเสียงอ่าน", nightMode: "โหมดกลางคืน", dayMode: "โหมดกลางวัน",
    examAll: "ทั้งหมด", exam1: "สอบ 1", exam2: "สอบ 2", examLabel: "เลือกชุดสอบ",
    chooseMode: "เลือกรูปแบบฝึก", timeUp: "หมดเวลา!",
    seenProgress: "เคยฝึกแล้ว", noWrong: "ยังไม่มีข้อที่ตอบผิดค้างอยู่ 🎉",
    resetProgress: "ล้างประวัติการฝึก", resetConfirm: "แน่ใจนะ? ประวัติ+ดาวจะถูกล้างทั้งหมด",
    backup: "สำรองดาว (คัดลอกโค้ด)", restore: "กู้คืนดาว (วางโค้ด)",
    backupDone: "คัดลอกโค้ดแล้ว! เก็บโค้ดนี้ไว้ ถ้าดาวหายให้วางกลับ",
    backupPrompt: "โค้ดสำรอง (คัดลอกเก็บไว้):", restorePrompt: "วางโค้ดสำรองที่นี่:",
    restoreOk: "กู้คืนดาวสำเร็จ!", restoreFail: "โค้ดไม่ถูกต้อง",
    cleared: "เคลียร์ได้", left: "เหลือ",
  },
  en: {
    appTitle: "P.3 Exam Prep", appSub: "Term 1 Exam 2026 • IEP",
    pickSubject: "Pick a subject",
    mock: "Mock Exam", mockSub: "20 mixed questions, no repeats round-to-round",
    timed: "60s Speed Game", timedSub: "Answer fast, score points, build streaks!",
    redo: "Review my mistakes", redoSub: "Answer correctly to clear them from the list",
    read: "Read the lesson", readSub: "Detailed notes for every subject — read before you practise",
    flash: "Flashcards", quiz: "Quiz (10 per round)", match: "Matching Game", fill: "Fill-in",
    back: "Back", next: "Next", check: "Check", flip: "Tap to flip",
    correct: "Correct! 🎉", wrong: "Not quite", score: "Score", time: "Time",
    finish: "Results", again: "Play again (new set)", home: "Home",
    great: "Amazing! You earned a star ⭐", good: "Nice work — one more try for a star", keep: "Keep practicing 💪",
    streak: "Streak", answerKey: "Answer key + explanations", yourAns: "Your answer",
    typeHere: "Type your answer…", submitExam: "Submit exam", question: "Q",
    matched: "All matched!", mistakes: "Misses", starBar: "Stars",
    report: "Progress report", reportSub: "See accuracy per subject — for parents",
    accuracy: "Accuracy", attempts: "Done", correctN: "Correct", notYet: "Not started",
    overall: "Overall", weakest: "Needs more practice", strong: "Doing great",
    listen: "Listen", nightMode: "Night mode", dayMode: "Day mode",
    examAll: "All", exam1: "Exam 1", exam2: "Exam 2", examLabel: "Choose exam set",
    chooseMode: "Choose a practice mode", timeUp: "Time's up!",
    seenProgress: "Practiced", noWrong: "No wrong answers left to review 🎉",
    resetProgress: "Reset progress", resetConfirm: "Sure? All history + stars will be cleared",
    backup: "Back up stars (copy code)", restore: "Restore stars (paste code)",
    backupDone: "Code copied! Keep it safe — paste it back if stars are lost",
    backupPrompt: "Backup code (copy & keep):", restorePrompt: "Paste your backup code here:",
    restoreOk: "Stars restored!", restoreFail: "Invalid code",
    cleared: "cleared", left: "left",
  },
};

/* ================= QUESTION BANK (v2 — expanded) ================= */
const SUBJECTS = [
  {
    id: "english", icon: "📚", color: "#3E7BD6",
    name: { th: "English", en: "English" },
    flash: [
      { f: "What's your name?", b: "My name is … (ฉันชื่อ…)" },
      { f: "There is + ?", b: "เอกพจน์ 1 สิ่ง — There is a clock." },
      { f: "There are + ?", b: "พหูพจน์หลายสิ่ง — There are three books." },
      { f: "in / on / under / next to", b: "ใน / บน / ใต้ / ข้างๆ" },
      { f: "juice, cheese, salad", b: "นับไม่ได้ → ใช้ some (some juice)" },
      { f: "sandwich (พหูพจน์)", b: "sandwiches" },
      { f: "Have you got …?", b: "Yes, I have. / No, I haven't." },
      { f: "a / an", b: "an + สระ (an eraser, an apple) | a + อื่นๆ (a pen)" },
    ],
    mcq: [
      { q: "____ a clock on the wall.", c: ["There is", "There are", "It are", "They is"], a: 0, ex: { th: "clock มีสิ่งเดียว ใช้ There is", en: "One clock → There is" } },
      { q: "There ____ some olives.", c: ["is", "are", "am", "be"], a: 1, ex: { th: "olives พหูพจน์ ใช้ are", en: "olives is plural → are" } },
      { q: "The pen is ____ the desk. (บน)", c: ["in", "under", "on", "next"], a: 2, ex: { th: "บน = on", en: "on = on top of" } },
      { q: "Do you like cheese?", c: ["Yes, I like.", "Yes, I do.", "Yes, I am.", "Yes, it is."], a: 1, ex: { th: "ตอบคำถาม Do you…? ด้วย Yes, I do.", en: "Do you…? → Yes, I do." } },
      { q: "Which word is a school place?", c: ["pizza", "library", "ham", "blanket"], a: 1, ex: { th: "library = ห้องสมุด", en: "library is a place in school" } },
      { q: "I want ____ juice, please.", c: ["a", "an", "some", "many"], a: 2, ex: { th: "juice นับไม่ได้ ใช้ some", en: "juice is uncountable → some" } },
      { q: "11, 12, ____, 14", c: ["fifteen", "thirty", "thirteen", "three"], a: 2, ex: { th: "13 = thirteen", en: "13 = thirteen" } },
      { q: "Plural of 'sandwich' is…", c: ["sandwichs", "sandwiches", "sandwich", "sandwichies"], a: 1, ex: { th: "ลงท้าย ch เติม es", en: "words ending in -ch add -es" } },
      { q: "Which is a classroom object?", c: ["canteen", "glue", "salad", "river"], a: 1, ex: { th: "glue = กาว ใช้ในห้องเรียน", en: "glue is a classroom object" } },
      { q: "____ you got a pencil?", c: ["Do", "Have", "Are", "Is"], a: 1, ex: { th: "Have you got…?", en: "Have you got…?" } },
      { q: "There are two ____.", c: ["book", "books", "a book", "bookes"], a: 1, ex: { th: "two = พหูพจน์ เติม s", en: "two → plural books" } },
      { q: "'Goodbye' means…", c: [{ th: "สวัสดี", en: "Hello" }, { th: "ลาก่อน", en: "Farewell" }, { th: "ขอบคุณ", en: "Thanks" }, { th: "ขอโทษ", en: "Sorry" }], a: 1, ex: { th: "Goodbye = ลาก่อน", en: "Goodbye = farewell" } },
      { q: "Where do we read books at school?", c: ["gym", "library", "canteen", "toilet"], a: 1, ex: { th: "อ่านหนังสือที่ห้องสมุด", en: "we read in the library" } },
      { q: "20 = ?", c: ["twelve", "twenty", "two", "twelfth"], a: 1, ex: { th: "20 = twenty (12 = twelve)", en: "20 = twenty" } },
      { q: "I ____ like onions.", c: ["don't", "doesn't", "am not", "no"], a: 0, ex: { th: "I + don't", en: "I → don't" } },
      { q: "The ball is ____ the table. (ใต้)", c: ["on", "in", "under", "at"], a: 2, ex: { th: "ใต้ = under", en: "under = below" } },
      { q: "Which food goes on a pizza?", c: ["cheese", "blanket", "ruler", "clock"], a: 0, ex: { th: "cheese, tomato, mushrooms อยู่บนพิซซ่า", en: "cheese goes on pizza" } },
      { q: "'What's this?' — 'It's ____ eraser.'", c: ["a", "an", "some", "two"], a: 1, ex: { th: "eraser ขึ้นต้นเสียงสระ ใช้ an", en: "vowel sound → an" } },
    ],
    match: [
      ["ruler", "ไม้บรรทัด"], ["scissors", "กรรไกร"], ["playground", "สนามเด็กเล่น"],
      ["canteen", "โรงอาหาร"], ["basket", "ตะกร้า"], ["mushroom", "เห็ด"],
      ["glue", "กาว"], ["cheese", "เนยแข็ง/ชีส"], ["chicken", "ไก่"],
      ["library", "ห้องสมุด"], ["blanket", "ผ้าปูปิกนิก"], ["plate", "จาน"],
    ],
    fill: [
      { q: "There ____ two cats under the chair.", a: ["are"] },
      { q: "สีม่วง ภาษาอังกฤษคือ…", a: ["purple"] },
      { q: "H__lo! (คำทักทาย)", a: ["hello"] },
      { q: "The cake is ____ the basket. (ใน)", a: ["in"] },
      { q: "There ____ one dog in the garden.", a: ["is"] },
      { q: "15 = f______ (ตัวอักษร)", a: ["fifteen"] },
      { q: "I like pizza but I ____ like olives. (ไม่)", a: ["dont", "don't", "do not"] },
    ],
  },
  {
    id: "time", icon: "⏰", color: "#8E5BC6",
    name: { th: "เวลา + Adverbs", en: "Time + Adverbs" },
    flash: [
      { f: "3:00", b: "three o'clock" },
      { f: "3:30", b: "half past three" },
      { f: "3:15", b: "quarter past three" },
      { f: "3:45", b: "quarter to FOUR (ชั่วโมงถัดไป!)" },
      { f: "always / never", b: "100% / 0%" },
      { f: "usually / often / sometimes / rarely", b: "90% / 70% / 50% / 10%" },
      { f: { th: "adverb วางตรงไหน?", en: "Where does the adverb go?" }, b: { th: "หน้ากริยาแท้ / หลัง verb to be", en: "before main verb / after 'to be'" } },
      { f: { th: "เข็มสั้น / เข็มยาว", en: "short hand / long hand" }, b: { th: "ชั่วโมง / นาที", en: "hours / minutes" } },
    ],
    mcq: [
      { q: "9:30 = ?", c: ["nine o'clock", "half past nine", "quarter past nine", "quarter to nine"], a: 1, ex: { th: "เข็มยาวชี้ 6 = half past", en: ":30 = half past" } },
      { q: "6:45 = ?", c: ["quarter to six", "quarter past six", "quarter to seven", "half past seven"], a: 2, ex: { th: "45 นาที = quarter to ชั่วโมงถัดไป", en: ":45 = quarter to the NEXT hour" } },
      { q: "2:15 = ?", c: ["quarter past two", "quarter to two", "half past two", "two o'clock"], a: 0, ex: { th: "15 นาที = quarter past", en: ":15 = quarter past" } },
      { q: "'quarter to four' คือเวลาใด?", c: ["4:45", "3:45", "4:15", "3:15"], a: 1, ex: { th: "อีก 15 นาทีจะถึง 4 โมง = 3:45", en: "15 min before 4 = 3:45" } },
      { q: "He ____ late. (never)", c: ["never is", "is never", "never be", "be never"], a: 1, ex: { th: "adverb อยู่หลัง verb to be", en: "adverb goes AFTER 'to be'" } },
      { q: "I ____ breakfast. (always + eat)", c: ["eat always", "always eat", "always eats", "eating always"], a: 1, ex: { th: "adverb อยู่หน้ากริยาแท้", en: "adverb BEFORE main verb" } },
      { q: { th: "เรียงจากน้อย → มาก", en: "Order from least → most" }, c: ["never→sometimes→always", "always→never→sometimes", "sometimes→never→always", "never→always→sometimes"], a: 0, ex: { th: "0% → 50% → 100%", en: "0% → 50% → 100%" } },
      { q: "usually ≈ ?", c: ["0%", "10%", "50%", "90%"], a: 3, ex: { th: "usually บ่อยมาก ~90%", en: "usually ≈ 90%" } },
      { q: "12:00 = ?", c: ["twelve o'clock", "half past twelve", "quarter to twelve", "zero o'clock"], a: 0, ex: { th: "เข็มยาวชี้ 12 = o'clock", en: ":00 = o'clock" } },
      { q: "'half past seven' = ?", c: ["7:15", "7:30", "7:45", "6:30"], a: 1, ex: { th: "half past = 30 นาที", en: "half past = :30" } },
      { q: "4:15 = ?", c: ["quarter to four", "quarter past four", "half past four", "four o'clock"], a: 1, ex: { th: "15 นาที = quarter past", en: ":15 = quarter past" } },
      { q: "11:45 = ?", c: ["quarter to eleven", "quarter past eleven", "quarter to twelve", "half past eleven"], a: 2, ex: { th: "45 นาที → ชั่วโมงถัดไปคือ 12", en: "next hour is twelve" } },
      { q: { th: "เข็มสั้นบอกอะไร", en: "The short hand shows…" }, c: [{ th: "นาที", en: "minutes" }, { th: "ชั่วโมง", en: "hours" }, { th: "วินาที", en: "seconds" }, { th: "วัน", en: "days" }], a: 1, ex: { th: "เข็มสั้น = ชั่วโมง เข็มยาว = นาที", en: "short = hours, long = minutes" } },
      { q: "She ____ goes to bed late. (10%)", c: ["always", "rarely", "usually", "often"], a: 1, ex: { th: "rarely = นานๆ ครั้ง ~10%", en: "rarely ≈ 10%" } },
      { q: "We ____ play football on Sundays. (~70%)", c: ["often", "never", "rarely", "sometimes"], a: 0, ex: { th: "often = บ่อย ~70%", en: "often ≈ 70%" } },
      { q: "sometimes ≈ ?", c: ["100%", "50%", "0%", "90%"], a: 1, ex: { th: "sometimes = บางครั้ง ~50%", en: "sometimes ≈ 50%" } },
      { q: { th: "ประโยคใดถูกต้อง", en: "Which sentence is correct?" }, c: ["He always is happy.", "He is always happy.", "He is happy always.", "Always he is happy."], a: 1, ex: { th: "adverb หลัง is", en: "adverb after 'is'" } },
    ],
    match: [
      ["7:00", "seven o'clock"], ["8:30", "half past eight"], ["5:15", "quarter past five"],
      ["1:45", "quarter to two"], ["always", "100%"], ["never", "0%"],
      ["9:15", "quarter past nine"], ["6:30", "half past six"], ["10:45", "quarter to eleven"],
      ["usually", "~90%"], ["rarely", "~10%"], ["often", "~70%"],
    ],
    fill: [
      { q: "10:30 = half ____ ten", a: ["past"] },
      { q: "12:45 = quarter to ____ (ตัวเลขอังกฤษ)", a: ["one"] },
      { q: "She is ____ happy. (100%)", a: ["always"] },
      { q: "I ____ eat snails. (0%)", a: ["never"] },
      { q: "4:30 = ____ past four", a: ["half"] },
      { q: "often ≈ ____ % (ตัวเลข)", a: ["70"] },
    ],
  },
  {
    id: "math", icon: "🔢", color: "#E8574B",
    name: { th: "คณิตศาสตร์ ±100,000", en: "Math ±100,000" },
    flash: [
      { f: { th: "45,318 กระจายได้…", en: "Expand 45,318" }, b: "40,000 + 5,000 + 300 + 10 + 8" },
      { f: { th: "เลข 5 ใน 45,318 มีค่า", en: "Value of 5 in 45,318" }, b: { th: "5,000 (หลักพัน)", en: "5,000 (thousands)" } },
      { f: "30,027 (EN)", b: "thirty thousand, twenty-seven" },
      { f: { th: "คำว่า 'รวม/ทั้งหมด/เพิ่ม'", en: "'total / altogether / more'" }, b: { th: "→ การบวก", en: "→ addition" } },
      { f: { th: "คำว่า 'เหลือ/หายไป/ต่างกัน'", en: "'left / lost / difference'" }, b: { th: "→ การลบ", en: "→ subtraction" } },
      { f: "60,003 − 27,486", b: "32,517 (ยืมข้ามเลข 0!)" },
      { f: { th: "หลักจากขวา→ซ้าย", en: "Places right→left" }, b: { th: "หน่วย สิบ ร้อย พัน หมื่น แสน", en: "ones tens hundreds thousands ten-th. hundred-th." } },
    ],
    mcq: [
      { q: { th: "เลข 7 ใน 27,450 มีค่าเท่าไร", en: "Value of 7 in 27,450?" }, c: ["70", "700", "7,000", "70,000"], a: 2, ex: { th: "7 อยู่หลักพัน = 7,000", en: "7 is in the thousands place" } },
      { q: "12,500 + 8,750 = ?", c: ["20,250", "21,250", "21,350", "20,150"], a: 1, ex: { th: "ตั้งหลักให้ตรงแล้วบวกทด", en: "Line up and carry" } },
      { q: "46,758 + 25,467 = ?", c: ["72,225", "71,225", "72,125", "71,125"], a: 0, ex: { th: "8+7=15 ใส่ 5 ทด 1 ต่อเนื่อง", en: "carry through each column" } },
      { q: "60,003 − 27,486 = ?", c: ["32,517", "33,517", "32,617", "42,517"], a: 0, ex: { th: "ยืมข้ามเลข 0 อย่างระวัง!", en: "Borrow across the zeros carefully" } },
      { q: "50,000 − 12,345 = ?", c: ["37,655", "38,655", "37,755", "47,655"], a: 0, ex: { th: "ยืมข้าม 0 สี่หลัก", en: "borrow across four zeros" } },
      { q: { th: "ข้อใดมากที่สุด", en: "Which is greatest?" }, c: ["34,125", "34,251", "34,215", "34,152"], a: 1, ex: { th: "เทียบหลักร้อยและหลักสิบ", en: "compare hundreds then tens" } },
      { q: "15,000 − (4,300 + 2,700) = ?", c: ["8,000", "9,000", "7,000", "8,600"], a: 0, ex: { th: "ทำในวงเล็บก่อน = 7,000", en: "brackets first: 7,000" } },
      { q: { th: "สามหมื่นยี่สิบเจ็ด เขียนเป็นตัวเลข", en: "Write: thirty thousand twenty-seven" }, c: ["3,027", "30,270", "30,027", "300,27"], a: 2, ex: { th: "อย่าลืมใส่ 0 ในหลักที่ว่าง", en: "don't forget the zero placeholders" } },
      { q: { th: "โรงเรียนมีนักเรียน 1,250 คน เป็นชาย 680 คน หญิงกี่คน", en: "1,250 students, 680 boys. How many girls?" }, c: ["570", "670", "560", "580"], a: 0, ex: { th: "1,250 − 680 = 570", en: "1,250 − 680 = 570" } },
      { q: { th: "เลข 4 ใน 48,213 อยู่หลักใด", en: "The 4 in 48,213 is in which place?" }, c: [{ th: "หลักพัน", en: "thousands" }, { th: "หลักหมื่น", en: "ten-thousands" }, { th: "หลักร้อย", en: "hundreds" }, { th: "หลักแสน", en: "hundred-thousands" }], a: 1, ex: { th: "4 อยู่หลักหมื่น = 40,000", en: "4 = 40,000 (ten-thousands)" } },
      { q: "89,999 + 1 = ?", c: ["89,000", "90,000", "89,100", "100,000"], a: 1, ex: { th: "ทดต่อเนื่องจนถึงหลักหมื่น", en: "carry ripples to 90,000" } },
      { q: { th: "ข้อใดน้อยที่สุด", en: "Which is smallest?" }, c: ["56,789", "56,798", "56,879", "56,978"], a: 0, ex: { th: "เทียบทีละหลักจากซ้าย", en: "compare digit by digit" } },
      { q: { th: "เจ็ดหมื่นห้าร้อย เขียนเป็นตัวเลข", en: "Write: seventy thousand five hundred" }, c: ["70,500", "75,000", "70,050", "7,500"], a: 0, ex: { th: "7 หมื่น + 5 ร้อย = 70,500", en: "70,000 + 500" } },
      { q: "24,680 − 12,340 = ?", c: ["12,340", "12,440", "11,340", "12,240"], a: 0, ex: { th: "ลบทีละหลัก ไม่มีการยืม", en: "subtract each column" } },
      { q: "35,000 + 15,000 = ?", c: ["40,000", "50,000", "45,000", "55,000"], a: 1, ex: { th: "35+15 = 50 พัน", en: "35+15 = 50 thousands" } },
      { q: "100,000 − 1 = ?", c: ["99,999", "99,990", "90,999", "100,001"], a: 0, ex: { th: "ยืมข้ามทุกหลัก!", en: "borrow across every digit" } },
      { q: { th: "43,210 อ่านว่า", en: "43,210 in Thai reads…" }, c: ["สี่หมื่นสามพันสองร้อยสิบ", "สี่พันสามร้อยยี่สิบเอ็ด", "สี่หมื่นสามพันยี่สิบเอ็ด", "สี่แสนสามหมื่นสองพัน"], a: 0, ex: { th: "4 หมื่น 3 พัน 2 ร้อย 1 สิบ", en: "40,000+3,000+200+10" } },
      { q: { th: "มีเงิน 45,000 บาท ซื้อของ 18,750 บาท เหลือเท่าไร", en: "Have 45,000, spend 18,750. How much left?" }, c: ["26,250", "27,250", "26,350", "25,250"], a: 0, ex: { th: "45,000 − 18,750 = 26,250", en: "45,000 − 18,750 = 26,250" } },
      { q: "18,500 + 18,500 = ?", c: ["36,000", "37,000", "37,500", "36,500"], a: 1, ex: { th: "500+500 ทดเป็นพัน", en: "500+500 carries to 1,000" } },
    ],
    match: [
      ["10,000", { th: "หนึ่งหมื่น", en: "ten thousand" }], ["100,000", { th: "หนึ่งแสน", en: "hundred thousand" }],
      ["25,000 + 25,000", "50,000"], ["90,000 − 45,000", "45,000"],
      ["62,405 (TH)", "หกหมื่นสองพันสี่ร้อยห้า"], ["7,000 + 300 + 10", "7,310"],
      ["40,000 + 2,000", "42,000"], [{ th: "โจทย์ 'เพิ่มขึ้น'", en: "'more than'" }, { th: "การบวก", en: "addition" }],
      [{ th: "โจทย์ 'ลดลง/เหลือ'", en: "'left over'" }, { th: "การลบ", en: "subtraction" }],
      ["99,999 + 1", "100,000"], [{ th: "หลักหมื่น", en: "ten-thousands" }, "10,000"],
      [{ th: "เลข 5 ตัวหน้าใน 55,555", en: "first 5 in 55,555" }, "50,000"],
    ],
    fill: [
      { q: "34,000 + 6,000 = ?", a: ["40000", "40,000"] },
      { q: "80,000 − 35,000 = ?", a: ["45000", "45,000"] },
      { q: "29,999 + 1 = ?", a: ["30000", "30,000"] },
      { q: "70,005 − 6 = ?", a: ["69999", "69,999"] },
      { q: "12,000 + 8,000 = ?", a: ["20000", "20,000"] },
      { q: "100,000 − 50,000 = ?", a: ["50000", "50,000"] },
      { q: { th: "ใน 45,678 เลข 6 มีค่าเท่าไร", en: "Value of 6 in 45,678?" }, a: ["600"] },
      { q: "9,999 + 1 = ?", a: ["10000", "10,000"] },
    ],
  },
  {
    id: "science", icon: "🧬", color: "#3FA46A",
    name: { th: "Science: การเติบโตของมนุษย์", en: "Science: Human Growth" },
    flash: [
      { f: "Infancy (วัยทารก)", b: { th: "0–2 ปี กินนม หัดคลาน-เดิน ฟันน้ำนมขึ้น", en: "0–2 yrs: milk, crawl, walk, baby teeth" } },
      { f: "Childhood (วัยเด็ก)", b: { th: "2–12 ปี ฟันแท้ขึ้น ~6 ขวบ เรียนอ่านเขียน", en: "2–12 yrs: permanent teeth ~6, learn to read" } },
      { f: "Adolescence (วัยรุ่น)", b: { th: "12–20 ปี เข้าสู่ puberty โตเร็ว", en: "12–20 yrs: puberty, rapid growth" } },
      { f: "Adulthood (วัยผู้ใหญ่)", b: { th: "20–60 ปี โตเต็มที่ แข็งแรงที่สุด ทำงาน", en: "20–60 yrs: fully grown, strongest, works" } },
      { f: "Elderly (วัยชรา)", b: { th: "60+ ผมหงอก กระดูกเปราะ ต้องการการดูแล", en: "60+: grey hair, fragile bones, needs care" } },
      { f: "Puberty คือ?", b: { th: "ช่วงร่างกายเด็กเปลี่ยนเป็นผู้ใหญ่ จากฮอร์โมน", en: "when a child's body changes to an adult's (hormones)" } },
      { f: "Menstruation เริ่มช่วงอายุ", b: { th: "~9–16 ปี เป็นเรื่องปกติของการเติบโต", en: "~ages 9–16, a normal healthy sign of growing up" } },
    ],
    mcq: [
      { q: { th: "ฟันแท้เริ่มขึ้นเมื่ออายุประมาณ", en: "Permanent teeth appear around age…" }, c: ["2", "6", "12", "20"], a: 1, ex: { th: "ราว 6 ขวบ ในวัยเด็ก", en: "around 6, in childhood" } },
      { q: { th: "วัยใดร่างกายแข็งแรงที่สุด", en: "Which stage is the body strongest?" }, c: [{ th: "วัยทารก", en: "Infancy" }, { th: "วัยเด็ก", en: "Childhood" }, { th: "วัยผู้ใหญ่", en: "Adulthood" }, { th: "วัยชรา", en: "Elderly" }], a: 2, ex: { th: "ผู้ใหญ่ 20–60 ปี โตเต็มที่", en: "Adulthood 20–60: fully grown" } },
      { q: { th: "เสียงแตก/ทุ้มขึ้น เกิดกับใคร", en: "Whose voice gets deeper in puberty?" }, c: [{ th: "เด็กหญิง", en: "Girls" }, { th: "เด็กชาย", en: "Boys" }, { th: "ทั้งสองเท่ากัน", en: "Both equally" }, { th: "ผู้สูงอายุ", en: "Elderly" }], a: 1, ex: { th: "boys: เสียงแตก หนวดเครา ไหล่กว้าง", en: "boys: voice breaks, facial hair, broad shoulders" } },
      { q: { th: "ข้อใดเป็นการเปลี่ยนแปลงของเด็กหญิง", en: "Which change happens to girls?" }, c: [{ th: "มีหนวดเครา", en: "facial hair" }, { th: "ไหล่กว้าง", en: "broad shoulders" }, { th: "สะโพกผาย มีประจำเดือน", en: "wider hips, menstruation" }, { th: "เสียงทุ้ม", en: "deep voice" }], a: 2, ex: { th: "girls: หน้าอกขยาย สะโพกผาย ประจำเดือน", en: "girls: breasts, hips, menstruation" } },
      { q: { th: "อารมณ์แปรปรวนในวัยรุ่นเรียกว่า", en: "Mood swings in teens are called…" }, c: [{ th: "การเปลี่ยนแปลงทางอารมณ์", en: "emotional changes" }, { th: "การเจ็บป่วย", en: "sickness" }, { th: "นิสัยไม่ดี", en: "bad habits" }, { th: "ความผิดปกติ", en: "abnormality" }], a: 0, ex: { th: "เป็นเรื่องปกติของ puberty", en: "a normal part of puberty" } },
      { q: { th: "ความท้าทายของผู้สูงอายุคือ", en: "A challenge for elderly people is…" }, c: [{ th: "โตเร็วเกินไป", en: "growing too fast" }, { th: "กระดูกเปราะ สายตาแย่ลง", en: "fragile bones, weaker eyesight" }, { th: "ฟันน้ำนมขึ้น", en: "baby teeth growing" }, { th: "เสียงแตก", en: "voice breaking" }], a: 1, ex: { th: "ต้องการความช่วยเหลือและกำลังใจ", en: "they need help and companionship" } },
      { q: { th: "ลำดับช่วงวัยที่ถูกต้อง", en: "Correct order of stages" }, c: ["ทารก→เด็ก→รุ่น→ผู้ใหญ่→ชรา", "เด็ก→ทารก→รุ่น→ชรา→ผู้ใหญ่", "ทารก→รุ่น→เด็ก→ผู้ใหญ่→ชรา", "รุ่น→เด็ก→ทารก→ผู้ใหญ่→ชรา"], a: 0, ex: { th: "Infancy→Childhood→Adolescence→Adulthood→Elderly", en: "Infancy→Childhood→Adolescence→Adulthood→Elderly" } },
      { q: { th: "วัยที่มาต่อจากวัยทารกคือ", en: "Which stage comes right after infancy?" }, c: [{ th: "วัยรุ่น", en: "Adolescence" }, { th: "วัยเด็ก", en: "Childhood" }, { th: "วัยผู้ใหญ่", en: "Adulthood" }, { th: "วัยชรา", en: "Elderly" }], a: 1, ex: { th: "ทารก → เด็ก", en: "infancy → childhood" } },
      { q: { th: "วัยทารกคือช่วงอายุ", en: "Infancy is roughly ages…" }, c: ["0–2 ปี", "5–10 ปี", "12–20 ปี", "20–60 ปี"], a: 0, ex: { th: "แรกเกิดถึง ~2 ปี", en: "birth to ~2 years" } },
      { q: { th: "การเปลี่ยนแปลงในวัยรุ่นเกิดจาก", en: "Puberty changes are caused by…" }, c: [{ th: "อาหาร", en: "food" }, { th: "ฮอร์โมน", en: "hormones" }, { th: "อากาศ", en: "weather" }, { th: "การบ้าน", en: "homework" }], a: 1, ex: { th: "ฮอร์โมนสั่งให้ร่างกายเปลี่ยน", en: "hormones drive the changes" } },
      { q: { th: "Menstruation เป็นเรื่อง…", en: "Menstruation is…" }, c: [{ th: "น่าอาย", en: "shameful" }, { th: "อันตราย", en: "dangerous" }, { th: "ปกติของการเติบโต", en: "a normal part of growing up" }, { th: "โรคชนิดหนึ่ง", en: "a disease" }], a: 2, ex: { th: "เป็นสัญญาณสุขภาพดี ดูแลความสะอาด", en: "a healthy sign; keep good hygiene" } },
      { q: { th: "ข้อใดเกิดกับทั้งเด็กชายและเด็กหญิงในวัยรุ่น", en: "Which happens to BOTH boys and girls?" }, c: [{ th: "สูงขึ้นเร็ว", en: "growing taller fast" }, { th: "มีหนวด", en: "moustache" }, { th: "มีประจำเดือน", en: "menstruation" }, { th: "เสียงแตก", en: "voice breaking" }], a: 0, ex: { th: "ทั้งสองเพศสูงขึ้นเร็วในวัยรุ่น", en: "both grow taller quickly" } },
      { q: { th: "วัยใดเริ่มทำงานเลี้ยงครอบครัว", en: "Which stage do people work and raise families?" }, c: [{ th: "วัยเด็ก", en: "Childhood" }, { th: "วัยรุ่น", en: "Adolescence" }, { th: "วัยผู้ใหญ่", en: "Adulthood" }, { th: "วัยทารก", en: "Infancy" }], a: 2, ex: { th: "ผู้ใหญ่ทำงานและดูแลครอบครัว", en: "adults work and raise families" } },
      { q: { th: "เราควรปฏิบัติต่อผู้สูงอายุอย่างไร", en: "How should we treat elderly people?" }, c: [{ th: "ปล่อยให้อยู่ลำพัง", en: "leave them alone" }, { th: "ช่วยเหลือและให้กำลังใจ", en: "help and encourage them" }, { th: "ล้อเลียน", en: "tease them" }, { th: "ไม่ต้องสนใจ", en: "ignore them" }], a: 1, ex: { th: "ผู้สูงอายุต้องการความช่วยเหลือและเพื่อน", en: "they need help and companionship" } },
    ],
    match: [
      ["Infancy", { th: "วัยทารก 0–2 ปี", en: "0–2 yrs, drinks milk" }], ["Childhood", { th: "วัยเด็ก 2–12 ปี", en: "2–12 yrs, permanent teeth" }],
      ["Adolescence", { th: "วัยรุ่น 12–20 ปี", en: "12–20 yrs, puberty" }], ["Adulthood", { th: "วัยผู้ใหญ่ 20–60", en: "20–60 yrs, strongest" }],
      ["Elderly", { th: "วัยชรา 60+", en: "60+, grey hair" }], ["Puberty", { th: "วัยแรกรุ่น", en: "body changes to adult" }],
      ["hormones", "ฮอร์โมน"], ["voice breaks", { th: "เสียงแตก (ชาย)", en: "boys' change" }],
      ["menstruation", { th: "ประจำเดือน (หญิง)", en: "girls' change" }], ["grey hair", { th: "ผมหงอก (วัยชรา)", en: "elderly sign" }],
    ],
    fill: [
      { q: { th: "วัย 60 ปีขึ้นไป เรียกว่าวัย…", en: "The stage 60+ is called the ____ stage." }, a: ["ชรา", "สูงอายุ", "elderly", "วัยชรา"] },
      { q: { th: "วัยรุ่นโตเร็วเพราะเข้าสู่ช่วง p______", en: "Teens grow fast because of p______" }, a: ["puberty"] },
      { q: { th: "ทารกกิน…เป็นอาหารหลัก", en: "Babies mainly drink ____." }, a: ["นม", "milk"] },
      { q: { th: "วัยรุ่นคือช่วงอายุ 12–__ ปี (ตัวเลข)", en: "Adolescence is ages 12–__ (number)" }, a: ["20"] },
      { q: { th: "ฟันที่ขึ้นตอนทารกเรียกว่าฟัน…", en: "Baby teeth in Thai = ฟัน____" }, a: ["น้ำนม"] },
    ],
  },
  {
    id: "health", icon: "💪", color: "#F5B82E",
    name: { th: "สุขศึกษา Health", en: "Health" },
    flash: [
      { f: { th: "ปัจจัยการเติบโต 5 ข้อ", en: "5 growth factors" }, b: { th: "อาหาร ออกกำลังกาย พักผ่อน พันธุกรรม สิ่งแวดล้อม", en: "nutrition, exercise, sleep, heredity, environment" } },
      { f: "Heredity (พันธุกรรม)", b: { th: "พ่อแม่สูง ลูกมักสูง / ลูกหน้าเหมือนพ่อแม่", en: "children resemble their parents" } },
      { f: { th: "อาหารช่วยให้สูง", en: "Foods that help you grow" }, b: { th: "นม ไข่ ปลา ผัก (ครบ 5 หมู่)", en: "milk, eggs, fish, vegetables (5 food groups)" } },
      { f: { th: "เพื่อนที่ดี", en: "A good friend" }, b: { th: "แบ่งปัน มีน้ำใจ ซื่อสัตย์", en: "sharing, kindness, honesty" } },
      { f: { th: "เทียบการเติบโตกับอะไร", en: "Compare growth with…" }, b: { th: "เกณฑ์มาตรฐาน (growth chart)", en: "standard growth charts" } },
    ],
    mcq: [
      { q: { th: "ข้อใด 'ไม่ใช่' ปัจจัยการเติบโต", en: "Which is NOT a growth factor?" }, c: [{ th: "อาหาร", en: "nutrition" }, { th: "การนอน", en: "sleep" }, { th: "ดูทีวีดึก ๆ", en: "watching TV late" }, { th: "พันธุกรรม", en: "heredity" }], a: 2, ex: { th: "นอนดึกขัดขวางการเติบโต", en: "staying up late harms growth" } },
      { q: { th: "ทำไมลูกหน้าเหมือนพ่อแม่", en: "Why do children look like parents?" }, c: [{ th: "อาหาร", en: "food" }, { th: "พันธุกรรม", en: "heredity" }, { th: "อากาศ", en: "weather" }, { th: "การเรียน", en: "studying" }], a: 1, ex: { th: "heredity ถ่ายทอดจากพ่อแม่", en: "traits pass from parents" } },
      { q: { th: "การออกกำลังกายช่วยอะไร", en: "Exercise helps to…" }, c: [{ th: "เสริมกระดูกและกล้ามเนื้อ", en: "strengthen bones & muscles" }, { th: "ทำให้ง่วง", en: "make you sleepy" }, { th: "ตัวเตี้ยลง", en: "make you shorter" }, { th: "ไม่มีผล", en: "nothing" }], a: 0, ex: { th: "เล่น-วิ่ง-กีฬาสม่ำเสมอ", en: "regular play and sport" } },
      { q: { th: "ข้อใดคือครอบครัว", en: "Which word is family?" }, c: ["ruler", "grandmother", "canteen", "pizza"], a: 1, ex: { th: "grandmother = คุณย่า/คุณยาย", en: "grandmother" } },
      { q: { th: "เพื่อนที่ดีควร…", en: "A good friend should…" }, c: [{ th: "แย่งของเล่น", en: "grab toys" }, { th: "โกหก", en: "lie" }, { th: "แบ่งปันและซื่อสัตย์", en: "share and be honest" }, { th: "ล้อเลียน", en: "tease" }], a: 2, ex: { th: "sharing + honesty", en: "sharing + honesty" } },
      { q: { th: "อาหารหลักมีกี่หมู่", en: "How many food groups?" }, c: ["3", "4", "5", "6"], a: 2, ex: { th: "กินให้ครบ 5 หมู่ทุกวัน", en: "eat all 5 groups daily" } },
      { q: { th: "การนอนหลับให้พอช่วยเรื่องใด", en: "Enough sleep helps with…" }, c: [{ th: "การเจริญเติบโต", en: "growth" }, { th: "ทำให้เตี้ย", en: "getting shorter" }, { th: "ปวดฟัน", en: "toothache" }, { th: "ไม่มีผล", en: "nothing" }], a: 0, ex: { th: "ร่างกายซ่อมแซม-เติบโตตอนหลับ", en: "the body grows during sleep" } },
      { q: { th: "'sister' แปลว่า", en: "'sister' means…" }, c: [{ th: "พี่ชาย/น้องชาย", en: "brother" }, { th: "พี่สาว/น้องสาว", en: "female sibling" }, { th: "คุณแม่", en: "mother" }, { th: "คุณยาย", en: "grandmother" }], a: 1, ex: { th: "sister = พี่สาวหรือน้องสาว", en: "sister = female sibling" } },
      { q: { th: "สิ่งแวดล้อมที่ดีต่อการเติบโตคือ", en: "A good growth environment is…" }, c: [{ th: "อากาศและน้ำสะอาด", en: "clean air and water" }, { th: "เสียงดังตลอดเวลา", en: "constant noise" }, { th: "ควันบุหรี่", en: "cigarette smoke" }, { th: "ขยะเยอะ", en: "lots of garbage" }], a: 0, ex: { th: "บ้านสะอาดปลอดภัย", en: "a clean, safe home" } },
      { q: { th: "เพื่อนลืมดินสอ ควรทำอย่างไร", en: "Your friend forgot a pencil. You should…" }, c: [{ th: "หัวเราะเยาะ", en: "laugh at them" }, { th: "แบ่งให้ยืม", en: "lend them one" }, { th: "ไม่สนใจ", en: "ignore them" }, { th: "ฟ้องครู", en: "tell the teacher off" }], a: 1, ex: { th: "การแบ่งปันคือเพื่อนที่ดี", en: "sharing makes a good friend" } },
      { q: { th: "ใช้อะไรเปรียบเทียบว่าเราโตตามเกณฑ์", en: "What do we compare our growth with?" }, c: [{ th: "เกณฑ์มาตรฐานการเจริญเติบโต", en: "standard growth charts" }, { th: "การ์ตูน", en: "cartoons" }, { th: "เกม", en: "games" }, { th: "ราคาขนม", en: "snack prices" }], a: 0, ex: { th: "ชั่งน้ำหนัก-วัดส่วนสูงเทียบเกณฑ์", en: "weigh & measure against the chart" } },
      { q: { th: "ใครอยู่ใน 'ครอบครัว'", en: "Who is in a family?" }, c: [{ th: "พ่อ แม่ พี่ น้อง", en: "father, mother, siblings" }, { th: "ครูทุกคน", en: "all teachers" }, { th: "เพื่อนบ้านทุกคน", en: "all neighbors" }, { th: "คนแปลกหน้า", en: "strangers" }], a: 0, ex: { th: "รวมปู่ย่าตายายด้วย", en: "grandparents too" } },
    ],
    match: [
      [{ th: "อาหาร", en: "nutrition" }, { th: "กินครบ 5 หมู่", en: "eat 5 food groups" }],
      [{ th: "ออกกำลังกาย", en: "exercise" }, { th: "กระดูกแข็งแรง", en: "strong bones" }],
      [{ th: "พักผ่อน", en: "sleep" }, { th: "นอนให้พอ", en: "sleep enough" }],
      [{ th: "พันธุกรรม", en: "heredity" }, { th: "เหมือนพ่อแม่", en: "like parents" }],
      [{ th: "สิ่งแวดล้อม", en: "environment" }, { th: "อากาศ-น้ำสะอาด", en: "clean air & water" }],
      ["father", "พ่อ"], ["grandmother", "ย่า/ยาย"], ["honesty", "ความซื่อสัตย์"], ["sharing", "การแบ่งปัน"],
    ],
    fill: [
      { q: { th: "ปัจจัยการเติบโตมีทั้งหมดกี่ข้อ (ตัวเลข)", en: "How many growth factors? (number)" }, a: ["5", "ห้า", "five"] },
      { q: { th: "ดื่ม…ช่วยให้กระดูกแข็งแรงและสูง", en: "Drinking ____ helps bones grow." }, a: ["นม", "milk"] },
      { q: { th: "กินอาหารให้ครบ __ หมู่ (ตัวเลข)", en: "Eat all __ food groups (number)" }, a: ["5", "ห้า", "five"] },
      { q: { th: "'brother' แปลว่า พี่ชาย/น้อง…", en: "'brother' = พี่ชาย/น้อง____" }, a: ["ชาย"] },
    ],
  },
  {
    id: "thai", icon: "🇹🇭", color: "#E86FA4",
    name: { th: "ภาษาไทย", en: "Thai Language" },
    flash: [
      { f: "อักษรกลาง 9 ตัว", b: "ก จ ฎ ฏ ด ต บ ป อ — ไก่จิกเด็กตายบนปากโอ่ง (ผันครบ 5 เสียง)" },
      { f: "อักษรสูง 11 ตัว", b: "ข ฃ ฉ ฐ ถ ผ ฝ ศ ษ ส ห (ผันได้ 3 เสียง: เอก โท จัตวา)" },
      { f: "อักษรต่ำเดี่ยว 10 ตัว", b: "งูใหญ่นอนอยู่ ณ ริมวัดโมฬีโลก (ผันได้ 3 เสียง: สามัญ โท ตรี)" },
      { f: "แม่กก", b: "เสียง /ก/ : ก ข ค ฆ — นก สุข เมฆ" },
      { f: "แม่กด", b: "เสียง /ด/ : ด ต จ ช ศ ษ ส ฯลฯ — รถ พุธ ก๊าซ" },
      { f: "แม่กน / แม่กบ", b: "กน: น ณ ญ ร ล ฬ (บ้าน สาร) | กบ: บ ป พ ฟ ภ (รูป ภาพ)" },
      { f: "คำนาม / สรรพนาม / กริยา", b: "ชื่อคนสัตว์สิ่งของ / คำแทนนาม (ฉัน เธอ) / คำแสดงอาการ (วิ่ง กิน)" },
      { f: "วรรณยุกต์", b: "4 รูป (่ ้ ๊ ๋) แต่มี 5 เสียง (สามัญ เอก โท ตรี จัตวา)" },
    ],
    mcq: [
      { q: "\"จ\" เป็นอักษรหมู่ใด", c: ["อักษรสูง", "อักษรกลาง", "อักษรต่ำ", "อักษรพิเศษ"], a: 1, ex: { th: "ไก่ จิก เด็ก… จ อยู่ในอักษรกลาง", en: "จ is a mid-class consonant" } },
      { q: "อักษรสูงผันได้กี่เสียง", c: ["5 เสียง", "4 เสียง", "3 เสียง", "2 เสียง"], a: 2, ex: { th: "เอก โท จัตวา", en: "3 tones: low, falling, rising" } },
      { q: "\"ค่า\" ออกเสียงวรรณยุกต์ใด", c: ["เอก", "โท", "ตรี", "จัตวา"], a: 1, ex: { th: "อักษรต่ำ รูปเอกแต่เสียงโท!", en: "low-class: low mark but falling tone" } },
      { q: "\"เมฆ\" อยู่มาตราตัวสะกดใด", c: ["แม่กก", "แม่กด", "แม่กน", "แม่กบ"], a: 0, ex: { th: "ฆ เสียง /ก/ = แม่กก (ไม่ตรงมาตรา)", en: "ฆ sounds /k/ → แม่กก" } },
      { q: "\"รูป\" อยู่มาตราใด", c: ["แม่กก", "แม่กด", "แม่กบ", "แม่กน"], a: 2, ex: { th: "ป เสียง /บ/ = แม่กบ", en: "ป sounds /b/ → แม่กบ" } },
      { q: "\"สาร\" อยู่มาตราใด", c: ["แม่กน", "แม่กด", "แม่กก", "แม่กบ"], a: 0, ex: { th: "ร เสียง /น/ = แม่กน", en: "ร sounds /n/ → แม่กน" } },
      { q: "\"แมวจับหนู\" คำใดเป็นกริยา", c: ["แมว", "จับ", "หนู", "ไม่มี"], a: 1, ex: { th: "จับ = คำแสดงอาการ", en: "จับ (catch) is the verb" } },
      { q: "\"เธอไปโรงเรียนไหม\" เป็นประโยคชนิดใด", c: ["บอกเล่า", "ปฏิเสธ", "คำถาม", "คำสั่ง"], a: 2, ex: { th: "ลงท้าย 'ไหม' = คำถาม", en: "'ไหม' marks a question" } },
      { q: "\"ฉัน\" เป็นสรรพนามบุรุษที่เท่าไร", c: ["ที่ 1", "ที่ 2", "ที่ 3", "ไม่ใช่สรรพนาม"], a: 0, ex: { th: "ผู้พูด = บุรุษที่ 1", en: "the speaker = 1st person" } },
      { q: "กา ก่า ก้า ก๊า ก๋า ผันได้ครบเพราะ ก เป็น…", c: ["อักษรต่ำ", "อักษรสูง", "อักษรกลาง", "ตัวสะกด"], a: 2, ex: { th: "อักษรกลางผันได้ครบ 5 เสียง", en: "mid-class conjugates all 5 tones" } },
      { q: "ข้อใดเป็นอักษรสูงทั้งหมด", c: ["ข ฉ ถ", "ก จ ด", "ค ง ท", "น ม ร"], a: 0, ex: { th: "ข ฉ ถ อยู่ใน 'ผีเศรษฐีฝากถุงข้าวสาร…'", en: "ข ฉ ถ are high-class" } },
      { q: "\"ป\" เป็นอักษรหมู่ใด", c: ["สูง", "กลาง", "ต่ำ", "พิเศษ"], a: 1, ex: { th: "…บน 'ปาก' โอ่ง = อักษรกลาง", en: "ป is mid-class" } },
      { q: "\"นก\" อยู่มาตราใด", c: ["แม่กก", "แม่กด", "แม่กน", "แม่กบ"], a: 0, ex: { th: "ก เสียง /ก/ = แม่กก", en: "ends with /k/ sound" } },
      { q: "\"พุธ\" อยู่มาตราใด", c: ["แม่กก", "แม่กด", "แม่กน", "แม่กบ"], a: 1, ex: { th: "ธ เสียง /ด/ = แม่กด (ไม่ตรงมาตรา)", en: "ธ sounds /d/ → แม่กด" } },
      { q: "\"กาล\" อยู่มาตราใด", c: ["แม่กน", "แม่กก", "แม่กด", "แม่กบ"], a: 0, ex: { th: "ล เสียง /น/ = แม่กน", en: "ล sounds /n/ → แม่กน" } },
      { q: "\"ยีราฟ\" อยู่มาตราใด", c: ["แม่กบ", "แม่กด", "แม่กก", "แม่กน"], a: 0, ex: { th: "ฟ เสียง /บ/ = แม่กบ", en: "ฟ sounds /b/ → แม่กบ" } },
      { q: "\"โรงเรียน\" เป็นคำชนิดใด", c: ["คำนาม", "คำสรรพนาม", "คำกริยา", "คำวิเศษณ์"], a: 0, ex: { th: "ชื่อสถานที่ = คำนาม", en: "a place name = noun" } },
      { q: "\"เขา\" เป็นคำชนิดใด", c: ["คำนาม", "คำสรรพนาม", "คำกริยา", "คำบุพบท"], a: 1, ex: { th: "ใช้แทนคน = สรรพนามบุรุษที่ 3", en: "replaces a person = pronoun" } },
      { q: "\"กรุณาปิดประตู\" เป็นประโยคชนิดใด", c: ["บอกเล่า", "คำถาม", "ปฏิเสธ", "ขอร้อง"], a: 3, ex: { th: "'กรุณา' = ขอร้อง", en: "'please' marks a request" } },
      { q: "ข้อใดเป็นประโยคปฏิเสธ", c: ["ฉันกินข้าว", "ฉันไม่กินผัก", "เธอกินอะไร", "กินข้าวเถอะ"], a: 1, ex: { th: "มีคำว่า 'ไม่' = ปฏิเสธ", en: "'ไม่' = negative" } },
    ],
    match: [
      ["นก", "แม่กก"], ["รถ", "แม่กด"], ["บ้าน", "แม่กน"], ["ภาพ", "แม่กบ"],
      ["ครู", "คำนาม"], ["วิ่ง", "คำกริยา"],
      ["สุข", "แม่กก (ไม่ตรงมาตรา)"], ["ก๊าซ", "แม่กด"], ["ฉัน เธอ", "สรรพนาม"],
      ["โต๊ะ", "คำนาม"], ["อ่าน", "กริยา"], ["ห", "อักษรสูง"],
    ],
    fill: [
      { q: "อักษรกลางมีกี่ตัว (ตัวเลข)", a: ["9", "เก้า"] },
      { q: "อักษรสูงมีกี่ตัว (ตัวเลข)", a: ["11", "สิบเอ็ด"] },
      { q: "คำแทนชื่อคน เช่น ฉัน เธอ เขา เรียกว่าคำ…", a: ["สรรพนาม", "คำสรรพนาม"] },
      { q: "\"กิน นอน วิ่ง\" เป็นคำชนิดใด", a: ["กริยา", "คำกริยา"] },
      { q: "อักษรต่ำมีกี่ตัว (ตัวเลข)", a: ["24", "ยี่สิบสี่"] },
      { q: "วรรณยุกต์มีกี่เสียง (ตัวเลข)", a: ["5", "ห้า"] },
      { q: "วรรณยุกต์มีกี่รูป (ตัวเลข)", a: ["4", "สี่"] },
    ],
  },
  {
    id: "scith", icon: "🦋", color: "#3FA46A",
    name: { th: "วิทยาศาสตร์: วัฏจักรชีวิต", en: "Science (TH): Life Cycles" },
    flash: [
      { f: "ปัจจัยจำเป็นต่อชีวิต 4 อย่าง", b: "อาหาร น้ำ อากาศ ที่อยู่อาศัย" },
      { f: "วัฏจักรผีเสื้อ (4 ระยะ)", b: "ไข่ → หนอน → ดักแด้ → ตัวเต็มวัย" },
      { f: "วัฏจักรไก่ (3 ระยะ)", b: "ไข่ → ลูกไก่ → ไก่ตัวเต็มวัย" },
      { f: "วัฏจักรกบ", b: "ไข่ → ลูกอ๊อด → กบ" },
      { f: "สัตว์ออกลูกเป็นตัว", b: "สุนัข แมว โลมา (ลูกคล้ายพ่อแม่)" },
      { f: "วัฏจักรชีวิตคือ?", b: "เกิด → เติบโต → สืบพันธุ์ → เกิดรุ่นใหม่ หมุนเวียนไป" },
    ],
    mcq: [
      { q: "วัฏจักรชีวิตผีเสื้อมีกี่ระยะ", c: ["2", "3", "4", "5"], a: 2, ex: { th: "ไข่ หนอน ดักแด้ ตัวเต็มวัย", en: "egg, larva, pupa, adult" } },
      { q: "ลูกกบตอนเล็กเรียกว่า", c: ["ลูกไก่", "ลูกอ๊อด", "หนอน", "ดักแด้"], a: 1, ex: { th: "ลูกอ๊อดอยู่ในน้ำ มีหาง", en: "tadpole lives in water" } },
      { q: "สัตว์ใดออกลูกเป็น 'ตัว'", c: ["ไก่", "ผีเสื้อ", "โลมา", "กบ"], a: 2, ex: { th: "โลมาเป็นสัตว์เลี้ยงลูกด้วยนม", en: "dolphins are mammals" } },
      { q: "ระยะใดมาก่อน 'ตัวเต็มวัย' ของผีเสื้อ", c: ["ไข่", "หนอน", "ดักแด้", "ลูกอ๊อด"], a: 2, ex: { th: "ดักแด้ → ตัวเต็มวัย", en: "pupa comes right before adult" } },
      { q: "ข้อใด 'ไม่ใช่' ปัจจัยจำเป็นต่อชีวิต", c: ["อาหาร", "น้ำ", "ของเล่น", "อากาศ"], a: 2, ex: { th: "4 อย่าง: อาหาร น้ำ อากาศ ที่อยู่", en: "food, water, air, shelter" } },
      { q: "วัฏจักรชีวิตหมายถึง", c: ["การนอนของสัตว์", "เกิด→เติบโต→สืบพันธุ์→เกิดรุ่นใหม่", "การกินอาหาร", "การอพยพ"], a: 1, ex: { th: "หมุนเวียนต่อเนื่องเป็นวงจร", en: "a repeating cycle of life" } },
      { q: "ระยะที่ 2 ของผีเสื้อคือ", c: ["ไข่", "หนอน", "ดักแด้", "ตัวเต็มวัย"], a: 1, ex: { th: "ไข่ → หนอน (ตัวอ่อน)", en: "egg → larva (caterpillar)" } },
      { q: "วัฏจักรชีวิตไก่มีกี่ระยะ", c: ["2", "3", "4", "5"], a: 1, ex: { th: "ไข่ ลูกไก่ ตัวเต็มวัย", en: "egg, chick, adult" } },
      { q: "สัตว์ใดออกลูกเป็น 'ไข่'", c: ["แมว", "สุนัข", "กบ", "โลมา"], a: 2, ex: { th: "กบวางไข่ในน้ำ", en: "frogs lay eggs in water" } },
      { q: "ลูกอ๊อดอาศัยอยู่ที่ใด", c: ["บนต้นไม้", "ในน้ำ", "ใต้ดิน", "ในอากาศ"], a: 1, ex: { th: "ลูกอ๊อดหายใจในน้ำ มีหาง", en: "tadpoles live in water" } },
      { q: "สัตว์เลี้ยงลูกด้วยนม ลูกที่เกิดมาจะ…", c: ["คล้ายพ่อแม่", "เป็นหนอนก่อน", "เป็นไข่", "เป็นดักแด้"], a: 0, ex: { th: "เช่น ลูกแมวคล้ายแมว", en: "kittens look like cats" } },
      { q: "สิ่งมีชีวิตต้องการอะไรเพื่อหายใจ", c: ["อาหาร", "อากาศ", "ของเล่น", "แสงไฟ"], a: 1, ex: { th: "อากาศ (ออกซิเจน) ใช้หายใจ", en: "air (oxygen) for breathing" } },
      { q: "ที่อยู่อาศัยของสัตว์มีไว้เพื่อ", c: ["ขายของ", "หลบภัย พักผ่อน เลี้ยงลูก", "เล่นเกม", "ดูโทรทัศน์"], a: 1, ex: { th: "บ้านของสัตว์ = ปลอดภัย", en: "shelter keeps animals safe" } },
    ],
    match: [
      ["ไข่ผีเสื้อ", "ระยะที่ 1"], ["หนอน", "ระยะที่ 2"], ["ดักแด้", "ระยะที่ 3"],
      ["ผีเสื้อ", "ตัวเต็มวัย"], ["ลูกอ๊อด", "ลูกของกบ"], ["โลมา", "ออกลูกเป็นตัว"],
      ["ไก่", "3 ระยะ"], ["ผีเสื้อ (วัฏจักร)", "4 ระยะ"], ["แมว", "ออกลูกเป็นตัว"], ["เต่า", "ออกลูกเป็นไข่"],
    ],
    fill: [
      { q: "ปัจจัยจำเป็นต่อชีวิตมีกี่อย่าง (ตัวเลข)", a: ["4", "สี่"] },
      { q: "ผีเสื้อระยะที่ 3 คือ…", a: ["ดักแด้"] },
      { q: "ไก่ออกลูกเป็น…", a: ["ไข่"] },
      { q: "ผีเสื้อระยะที่ 2 คือ…", a: ["หนอน", "ตัวหนอน"] },
      { q: "สัตว์ต้องการอาหาร น้ำ อากาศ และที่…", a: ["อยู่อาศัย", "อยู่"] },
    ],
  },
  {
    id: "social", icon: "🛕", color: "#F5B82E",
    name: { th: "สังคม + จริยะ", en: "Social + Ethics" },
    flash: [
      { f: "สงกรานต์", b: "13–15 เม.ย. ปีใหม่ไทย รดน้ำดำหัวผู้ใหญ่" },
      { f: "ลอยกระทง", b: "ขึ้น 15 ค่ำ เดือน 12 ขอขมาพระแม่คงคา" },
      { f: "วันพ่อ / วันแม่", b: "5 ธันวาคม / 12 สิงหาคม" },
      { f: "วันจักรี / วันปิยมหาราช", b: "6 เมษายน / 23 ตุลาคม" },
      { f: "ประชาธิปไตย", b: "ยึดเสียงส่วนใหญ่ เคารพเสียงส่วนน้อย" },
      { f: "พระพุทธเจ้าตรัสรู้", b: "35 พรรษา ใต้ต้นศรีมหาโพธิ์ — อริยสัจ 4" },
      { f: "อริยสัจ 4", b: "ทุกข์ สมุทัย นิโรธ มรรค" },
      { f: "วันวิสาขบูชา", b: "ประสูติ ตรัสรู้ ปรินิพพาน ตรงกันวันเดียว (ขึ้น 15 ค่ำ เดือน 6)" },
    ],
    mcq: [
      { q: "วันแม่แห่งชาติตรงกับวันใด", c: ["5 ธ.ค.", "12 ส.ค.", "6 เม.ย.", "23 ต.ค."], a: 1, ex: { th: "12 สิงหาคม", en: "12 August" } },
      { q: "ประเพณีขอขมาพระแม่คงคาคือ", c: ["สงกรานต์", "ลอยกระทง", "แห่เทียน", "วันจักรี"], a: 1, ex: { th: "ลอยกระทง เดือน 12", en: "Loy Krathong" } },
      { q: "การเลือกหัวหน้าห้องเป็นประชาธิปไตยแบบใด", c: ["ออกเสียงโดยตรง", "เลือกตัวแทน", "จับสลาก", "ครูเลือกให้"], a: 1, ex: { th: "เลือกคนไปทำหน้าที่แทนเรา", en: "choosing a representative" } },
      { q: "พระพุทธเจ้าตรัสรู้เมื่อพระชนมายุ", c: ["29", "35", "45", "80"], a: 1, ex: { th: "ตรัสรู้ 35 / ปรินิพพาน 80", en: "enlightened at 35, passed at 80" } },
      { q: "พระพุทธเจ้าปรินิพพานเมื่อพระชนมายุ", c: ["35", "60", "80", "100"], a: 2, ex: { th: "80 พรรษา ณ กุสินารา", en: "age 80 at Kusinara" } },
      { q: "ธรรมที่ตรัสรู้คือ", c: ["ศีล 5", "อริยสัจ 4", "พรหมวิหาร 4", "มงคล 38"], a: 1, ex: { th: "ทุกข์ สมุทัย นิโรธ มรรค", en: "the Four Noble Truths" } },
      { q: "สงกรานต์ตรงกับเดือนใด", c: ["มกราคม", "เมษายน", "สิงหาคม", "ธันวาคม"], a: 1, ex: { th: "13–15 เมษายน", en: "13–15 April" } },
      { q: "วันปิยมหาราชตรงกับวันใด", c: ["23 ต.ค.", "5 ธ.ค.", "6 เม.ย.", "12 ส.ค."], a: 0, ex: { th: "23 ตุลาคม รำลึก ร.5", en: "23 October" } },
      { q: "วันจักรีตรงกับวันใด", c: ["13 เม.ย.", "6 เม.ย.", "1 ม.ค.", "23 ต.ค."], a: 1, ex: { th: "6 เมษายน", en: "6 April" } },
      { q: "รดน้ำดำหัวผู้ใหญ่ทำในประเพณีใด", c: ["ลอยกระทง", "สงกรานต์", "เข้าพรรษา", "ตรุษจีน"], a: 1, ex: { th: "สงกรานต์ = แสดงความเคารพผู้ใหญ่", en: "Songkran tradition" } },
      { q: "การไหว้จัดเป็น", c: ["กีฬา", "มารยาทไทย", "อาหาร", "ของเล่น"], a: 1, ex: { th: "มารยาทงามของไทย", en: "the wai is Thai etiquette" } },
      { q: "ทุกคนยกมือลงคะแนนเอง เรียกว่า", c: ["เลือกตัวแทน", "ออกเสียงโดยตรง", "จับสลาก", "การสั่งการ"], a: 1, ex: { th: "ลงคะแนนด้วยตนเองทุกคน", en: "everyone votes directly" } },
      { q: "พระพุทธเจ้าประสูติเมื่อใด", c: ["ขึ้น 15 ค่ำ เดือน 6", "ขึ้น 15 ค่ำ เดือน 12", "แรม 1 ค่ำ เดือน 8", "ขึ้น 8 ค่ำ เดือน 3"], a: 0, ex: { th: "ณ สวนลุมพินีวัน", en: "at Lumbini garden" } },
      { q: "พระราชบิดาของเจ้าชายสิทธัตถะคือ", c: ["พระเจ้าสุทโธทนะ", "พระเจ้าอโศก", "พระเจ้าปเสนทิ", "พระเจ้าพิมพิสาร"], a: 0, ex: { th: "พระมารดาคือพระนางสิริมหามายา", en: "King Suddhodana" } },
      { q: "พระพุทธเจ้าปรินิพพานที่เมืองใด", c: ["พาราณสี", "กุสินารา", "ราชคฤห์", "สาวัตถี"], a: 1, ex: { th: "ณ สาลวโนทยาน เมืองกุสินารา", en: "at Kusinara" } },
    ],
    match: [
      ["สงกรานต์", "เมษายน"], ["ลอยกระทง", "เดือน 12"], ["วันพ่อ", "5 ธ.ค."],
      ["วันแม่", "12 ส.ค."], ["ตรัสรู้", "35 พรรษา"], ["ปรินิพพาน", "80 พรรษา"],
      ["ประสูติ", "ลุมพินีวัน"], ["ตรัสรู้ (สถานที่)", "ต้นศรีมหาโพธิ์"],
      ["ปรินิพพาน (เมือง)", "กุสินารา"], ["วันปิยมหาราช", "23 ต.ค."],
    ],
    fill: [
      { q: "อริยสัจมีกี่ข้อ (ตัวเลข)", a: ["4", "สี่"] },
      { q: "พระพุทธเจ้าประสูติที่สวน…", a: ["ลุมพินีวัน", "ลุมพินี"] },
      { q: "ประชาธิปไตยยึดเสียงส่วน…", a: ["ใหญ่", "ส่วนใหญ่"] },
      { q: "พระมารดาคือพระนางสิริมหา…", a: ["มายา"] },
      { q: "สงกรานต์เริ่มวันที่เท่าไรของเดือนเมษายน (ตัวเลข)", a: ["13", "สิบสาม"] },
    ],
  },
  {
    id: "history", icon: "📜", color: "#8E5BC6",
    name: { th: "ประวัติศาสตร์", en: "History" },
    flash: [
      { f: "พ.ศ. → ค.ศ.", b: "พ.ศ. − 543 = ค.ศ." },
      { f: "ค.ศ. → พ.ศ.", b: "ค.ศ. + 543 = พ.ศ." },
      { f: "พ.ศ. 2569", b: "= ค.ศ. 2026" },
      { f: "เส้นเวลา (Timeline)", b: "เรียงเหตุการณ์จากอดีต → ปัจจุบัน" },
      { f: "แหล่งข้อมูลประวัติชุมชน", b: "คำบอกเล่าผู้เฒ่า ภาพถ่ายเก่า เอกสาร ป้ายประวัติ" },
    ],
    mcq: [
      { q: "พ.ศ. 2569 = ค.ศ. ใด", c: ["2025", "2026", "2027", "3112"], a: 1, ex: { th: "2569 − 543 = 2026", en: "2569 − 543 = 2026" } },
      { q: "ค.ศ. 2000 = พ.ศ. ใด", c: ["1457", "2543", "2500", "2600"], a: 1, ex: { th: "2000 + 543 = 2543", en: "2000 + 543 = 2543" } },
      { q: "แปลง พ.ศ. เป็น ค.ศ. ต้องทำอย่างไร", c: ["บวก 543", "ลบ 543", "บวก 100", "ลบ 100"], a: 1, ex: { th: "ค.ศ. ตัวเลขน้อยกว่า จึงต้องลบ", en: "CE numbers are smaller → subtract" } },
      { q: "เครื่องมือเรียงลำดับเหตุการณ์คือ", c: ["แผนที่", "เส้นเวลา", "ตาราง", "กราฟ"], a: 1, ex: { th: "Timeline เรียงอดีต→ปัจจุบัน", en: "a timeline orders events" } },
      { q: "ข้อใดเป็นแหล่งข้อมูลประวัติชุมชน", c: ["ภาพถ่ายเก่า", "เกมมือถือ", "การ์ตูน", "ของเล่น"], a: 0, ex: { th: "ภาพถ่าย เอกสาร คำบอกเล่า", en: "old photos, documents, oral history" } },
      { q: "พ.ศ. 2500 = ค.ศ. ใด", c: ["1957", "1857", "2043", "1975"], a: 0, ex: { th: "2500 − 543 = 1957", en: "2500 − 543 = 1957" } },
      { q: "พ.ศ. 2400 = ค.ศ. ใด", c: ["1857", "1757", "1957", "2943"], a: 0, ex: { th: "2400 − 543 = 1857", en: "2400 − 543 = 1857" } },
      { q: "ค.ศ. 2026 = พ.ศ. ใด", c: ["2568", "2569", "2570", "1483"], a: 1, ex: { th: "2026 + 543 = 2569", en: "2026 + 543 = 2569" } },
      { q: "เหตุการณ์ใดเกิด 'ก่อน'", c: ["พ.ศ. 2560", "พ.ศ. 2500", "พ.ศ. 2565", "พ.ศ. 2569"], a: 1, ex: { th: "ตัวเลขน้อยกว่า = เกิดก่อน", en: "smaller year = earlier" } },
      { q: "คำบอกเล่าของผู้เฒ่าผู้แก่จัดเป็น", c: ["นิทาน", "แหล่งข้อมูลบุคคล", "การ์ตูน", "โฆษณา"], a: 1, ex: { th: "ข้อมูลจากผู้รู้เห็นเหตุการณ์จริง", en: "oral history from witnesses" } },
      { q: "บนเส้นเวลา เหตุการณ์เก่าสุดอยู่ด้านใด", c: ["ขวาสุด", "ซ้ายสุด (จุดเริ่ม)", "ตรงกลาง", "ที่ไหนก็ได้"], a: 1, ex: { th: "เริ่มจากอดีต (ซ้าย) ไปปัจจุบัน (ขวา)", en: "past on the left, present on the right" } },
      { q: "ปีนี้ พ.ศ. 2569 ปีหน้าคือ พ.ศ. ใด", c: ["2568", "2570", "2600", "2579"], a: 1, ex: { th: "บวกทีละ 1 ปี", en: "add one year" } },
    ],
    match: [
      ["พ.ศ. 2569", "ค.ศ. 2026"], ["พ.ศ. 2543", "ค.ศ. 2000"], ["ค.ศ. 2020", "พ.ศ. 2563"],
      ["พ.ศ. → ค.ศ.", "ลบ 543"], ["ค.ศ. → พ.ศ.", "บวก 543"],
      ["ค.ศ. 1957", "พ.ศ. 2500"], ["เอกสารเก่า", "แหล่งข้อมูล"], ["อดีต", "ซ้ายสุดของเส้นเวลา"],
    ],
    fill: [
      { q: "พ.ศ. กับ ค.ศ. ต่างกันกี่ปี (ตัวเลข)", a: ["543"] },
      { q: "พ.ศ. 2570 = ค.ศ. ? (ตัวเลข)", a: ["2027"] },
      { q: "ค.ศ. 2010 = พ.ศ. ? (ตัวเลข)", a: ["2553"] },
      { q: "ค.ศ. 1990 = พ.ศ. ? (ตัวเลข)", a: ["2533"] },
      { q: "พ.ศ. 2543 = ค.ศ. ? (ตัวเลข)", a: ["2000"] },
    ],
  },
  {
    id: "arts", icon: "🎨", color: "#E8574B",
    name: { th: "การงาน + ดนตรี + ศิลปะ", en: "Work + Music + Art" },
    flash: [
      { f: "ขั้นตอนการทำงาน", b: "วางแผน → ลงมือทำ → ประเมินผล" },
      { f: "ค่าตัวโน้ต", b: "กลม 4 | ขาว 2 | ดำ 1 | เขบ็ต ½ จังหวะ" },
      { f: "กลุ่มเครื่องดนตรี", b: "เครื่องสาย (กีตาร์) เครื่องเป่า (ขลุ่ย ทรัมเป็ต) เครื่องตี (กลอง ระนาด)" },
      { f: "ทัศนธาตุ", b: "จุด เส้น สี รูปร่าง รูปทรง พื้นผิว" },
      { f: "รูปร่าง vs รูปทรง", b: "รูปร่าง = 2 มิติ (แบน) | รูปทรง = 3 มิติ (มีความหนา)" },
      { f: "ประเภทรูปร่าง", b: "ธรรมชาติ (คน สัตว์) เรขาคณิต (วงกลม) อิสระ (เมฆ ควัน)" },
    ],
    mcq: [
      { q: "ขั้นตอนแรกของการทำงานคือ", c: ["ลงมือทำ", "วางแผน", "ประเมินผล", "พักผ่อน"], a: 1, ex: { th: "วางแผนก่อนเสมอ", en: "plan first" } },
      { q: "โน้ตตัวกลมยาวกี่จังหวะ", c: ["1", "2", "4", "8"], a: 2, ex: { th: "กลม 4 → ขาว 2 → ดำ 1", en: "whole note = 4 beats" } },
      { q: "ตัวขาว 1 ตัว เท่ากับตัวดำกี่ตัว", c: ["1", "2", "3", "4"], a: 1, ex: { th: "ขาว 2 จังหวะ = ดำ 2 ตัว", en: "half note = 2 quarter notes" } },
      { q: "กีตาร์อยู่กลุ่มเครื่องดนตรีใด", c: ["เครื่องตี", "เครื่องเป่า", "เครื่องสาย", "เครื่องหยุด"], a: 2, ex: { th: "มีสาย = เครื่องสาย", en: "guitar is a string instrument" } },
      { q: "รูปทรงต่างจากรูปร่างอย่างไร", c: ["ไม่ต่าง", "รูปทรงมี 3 มิติ", "รูปทรงแบนกว่า", "รูปทรงเล็กกว่า"], a: 1, ex: { th: "รูปทรง = กว้าง×ยาว×หนา", en: "form has depth (3D)" } },
      { q: "เมฆ หยดน้ำ ควัน จัดเป็นรูปร่างประเภทใด", c: ["เรขาคณิต", "ธรรมชาติ", "อิสระ", "สี่เหลี่ยม"], a: 2, ex: { th: "รูปร่างอิสระ ไม่มีรูปแบบตายตัว", en: "free-form shapes" } },
      { q: "ข้อใดเป็นทัศนธาตุ", c: ["เส้นและสี", "เสียงเพลง", "กลิ่นหอม", "รสชาติ"], a: 0, ex: { th: "จุด เส้น สี รูปร่าง รูปทรง พื้นผิว", en: "dot, line, color, shape, form, texture" } },
      { q: "ขั้นตอนสุดท้ายของการทำงานคือ", c: ["วางแผน", "ลงมือทำ", "ประเมินผล", "เริ่มใหม่"], a: 2, ex: { th: "ตรวจว่างานดีหรือควรปรับ", en: "check and improve" } },
      { q: "เขบ็ต 1 ชั้น ยาวกี่จังหวะ", c: ["2", "1", "ครึ่งจังหวะ", "4"], a: 2, ex: { th: "ดำ 1 → เขบ็ตครึ่งจังหวะ", en: "eighth note = half a beat" } },
      { q: "ตัวกลม 1 ตัว = ตัวขาวกี่ตัว", c: ["1", "2", "3", "4"], a: 1, ex: { th: "4 จังหวะ = ขาว 2 ตัว", en: "4 beats = two half notes" } },
      { q: "ระนาดอยู่กลุ่มเครื่องดนตรีใด", c: ["เครื่องสาย", "เครื่องเป่า", "เครื่องตี", "เครื่องดีด"], a: 2, ex: { th: "ใช้ไม้ตี = เครื่องตี", en: "played by striking" } },
      { q: "เครื่องหมายพักเสียงเรียกว่า", c: ["ตัวโน้ต", "ตัวหยุด", "ตัวเลข", "กุญแจ"], a: 1, ex: { th: "พักเสียงตามจังหวะที่กำหนด", en: "a rest = silence" } },
      { q: "ลูกบอลเป็นรูปทรงใด", c: ["ทรงกลม", "ทรงกระบอก", "วงกลม", "สี่เหลี่ยม"], a: 0, ex: { th: "3 มิติ = ทรงกลม (วงกลมคือ 2 มิติ)", en: "a ball is a sphere (3D)" } },
      { q: "สามเหลี่ยม วงกลม เป็นรูปร่างประเภทใด", c: ["ธรรมชาติ", "เรขาคณิต", "อิสระ", "รูปทรง"], a: 1, ex: { th: "รูปเรขาคณิตมีรูปแบบแน่นอน", en: "geometric shapes" } },
      { q: "งานบ้านช่วยฝึกอะไร", c: ["ความขี้เกียจ", "ความรับผิดชอบ", "การนอน", "การเล่นเกม"], a: 1, ex: { th: "รับผิดชอบ + แบ่งเบาครอบครัว", en: "responsibility" } },
    ],
    match: [
      ["ตัวกลม", "4 จังหวะ"], ["ตัวขาว", "2 จังหวะ"], ["ตัวดำ", "1 จังหวะ"],
      ["ไวโอลิน", "เครื่องสาย"], ["ขลุ่ย", "เครื่องเป่า"], ["กลอง", "เครื่องตี"],
      ["เขบ็ต 1 ชั้น", "ครึ่งจังหวะ"], ["ทรัมเป็ต", "เครื่องเป่า"],
      ["ทรงกระบอก", "รูปทรง 3 มิติ"], ["วงกลม", "รูปร่าง 2 มิติ"], ["ที่ตักผง", "เครื่องมือทำความสะอาด"],
    ],
    fill: [
      { q: "เครื่องมือใช้กวาดพื้นคือ ไม้…", a: ["กวาด", "ไม้กวาด"] },
      { q: "โน้ตตัวดำยาวกี่จังหวะ (ตัวเลข)", a: ["1", "หนึ่ง"] },
      { q: "รูปร่างมีกี่มิติ (ตัวเลข)", a: ["2", "สอง"] },
      { q: "โน้ตตัวกลม = ตัวดำกี่ตัว (ตัวเลข)", a: ["4", "สี่"] },
      { q: "ขั้นตอนการทำงาน: วางแผน → ลงมือทำ → ประเมิน…", a: ["ผล"] },
    ],
  },
];

/* ================= LESSON CONTENT (read-along notes) =================
   Each subject id maps to an array of "sections".
   section = { h: heading, p: [paragraphs], k: [key bullets], ex: [[q,a]], tip: warning }
   Any field may be a {th,en} object or a plain string. */
const LESSONS = {
  english: [
    {
      h: { th: "Unit 0 — Meet the Explorers (ทักทาย & พื้นฐาน)", en: "Unit 0 — Meet the Explorers" },
      p: [
        { th: "หน่วยเปิดเรื่อง เด็ก ๆ จะได้รู้จักตัวละคร \"นักสำรวจ\" และฝึกทักทาย บอกชื่อ บอกสี และนับเลข 1–20 เป็นพื้นฐานที่ใช้ต่อในทุกหน่วย", en: "The opening unit: children meet the recurring 'explorer' characters and practise greetings, giving their name, colours, and numbers 1–20 — the base used in every later unit." },
      ],
      k: [
        { th: "ทักทาย: Hello / Hi / Goodbye", en: "Greetings: Hello / Hi / Goodbye" },
        { th: "ถามชื่อ: What's your name? — My name is …", en: "Name: What's your name? — My name is …" },
        { th: "ถามสารทุกข์: How are you? — I'm fine, thank you.", en: "How are you? — I'm fine, thank you." },
        { th: "ตัวเลข one–twenty (1–20)", en: "Numbers one–twenty (1–20)" },
        { th: "สี: red, blue, green, yellow, orange, purple, pink, black, white, brown", en: "Colours: red, blue, green, yellow, orange, purple, pink, black, white, brown" },
      ],
      ex: [
        [{ th: "\"What's your name?\" ตอบว่า", en: "\"What's your name?\" →" }, "My name is ___."],
        ["11, 12, __, 14", "13 (thirteen)"],
      ],
      tip: { th: "อย่าสับสน How are you? (ถามความรู้สึก) กับ Who are you? (ถามว่าเป็นใคร) และชื่อคนต้องขึ้นต้นด้วยตัวใหญ่", en: "Don't confuse How are you? (feelings) with Who are you? (identity). Personal names start with a capital letter." },
    },
    {
      h: { th: "Unit 1 — Our school (โรงเรียนของเรา)", en: "Unit 1 — Our school" },
      p: [
        { th: "คำศัพท์ของใช้ในห้องเรียน สถานที่ในโรงเรียน และวิชาเรียน พร้อมการบอกว่ามีอะไรอยู่ในห้องด้วย There is / There are", en: "Classroom objects, places in school, and school subjects — plus describing what is in the room using There is / There are." },
      ],
      k: [
        { th: "ของใช้: pen, pencil, ruler, rubber/eraser, book, notebook, bag, crayon, glue, scissors, desk, chair, board, clock", en: "Objects: pen, pencil, ruler, eraser, book, notebook, bag, crayon, glue, scissors, desk, chair, board, clock" },
        { th: "สถานที่: classroom, library, playground, canteen, gym, office, toilet", en: "Places: classroom, library, playground, canteen, gym, office, toilet" },
        { th: "วิชา: English, Maths, Science, Art, Music, P.E., Thai", en: "Subjects: English, Maths, Science, Art, Music, P.E., Thai" },
        { th: "ไวยากรณ์: There is (เอกพจน์) / There are (พหูพจน์); Have you got …? — Yes, I have / No, I haven't; บุพบท in / on / under / next to", en: "Grammar: There is (singular) / There are (plural); Have you got …?; prepositions in / on / under / next to" },
      ],
      ex: [
        ["___ a clock on the wall.", "There is"],
        [{ th: "The pen is ___ the desk. (บน)", en: "The pen is ___ the desk. (on top)" }, "on"],
      ],
      tip: { th: "\"There is\" ห้ามตามด้วยพหูพจน์ และอย่าลืมเติม -s ที่คำนามพหูพจน์ (three books ไม่ใช่ three book)", en: "Never put a plural after \"There is\", and don't drop the plural -s (three books, not three book)." },
    },
    {
      h: { th: "Unit 2 — The Picnic (ปิกนิก)", en: "Unit 2 — The Picnic" },
      p: [
        { th: "คำศัพท์อาหารและของไปปิกนิก การบอกว่าชอบ/ไม่ชอบ และการบอกตำแหน่งของสิ่งของ", en: "Food and picnic vocabulary, saying what you like or don't like, and telling where things are." },
      ],
      k: [
        { th: "อาหาร: ham, juice, mushrooms, onions, peppers, pizza, fish, olives, salad, chicken, tomato, cheese, cake", en: "Food: ham, juice, mushrooms, onions, peppers, pizza, fish, olives, salad, chicken, tomato, cheese, cake" },
        { th: "ของปิกนิก: blanket, basket, plate, cup, sandwich, fruit", en: "Picnic items: blanket, basket, plate, cup, sandwich, fruit" },
        { th: "ไวยากรณ์: I like / I don't like; There is/are กับอาหาร; คำนามนับไม่ได้ (juice, cheese, salad) ใช้ some", en: "Grammar: I like / I don't like; There is/are with food; uncountable nouns (juice, cheese, salad) take some" },
      ],
      ex: [
        ["There ___ some olives.", "are"],
        [{ th: "The cake is ___ the basket. (ใน)", en: "The cake is ___ the basket. (inside)" }, "in"],
        [{ th: "พหูพจน์ของ sandwich", en: "Plural of sandwich" }, "sandwiches"],
      ],
      tip: { th: "a juice / a cheese ผิด! คำนามนับไม่ได้ใช้ some juice, some cheese", en: "\"a juice / a cheese\" is wrong — uncountable nouns use some juice, some cheese." },
    },
    {
      h: { th: "Smart Learning — การบอกเวลา (Telling the time)", en: "Smart Learning — Telling the time" },
      p: [
        { th: "เข็มสั้นบอกชั่วโมง เข็มยาวบอกนาที ตำแหน่งของเข็มยาวเป็นตัวกำหนดคำที่ใช้", en: "The short hand shows hours, the long hand shows minutes. Where the long hand points decides the phrase you use." },
      ],
      k: [
        { th: "เข็มยาวชี้ 12 → o'clock (3:00 = three o'clock)", en: "Long hand on 12 → o'clock (3:00 = three o'clock)" },
        { th: "เข็มยาวชี้ 6 → half past (3:30 = half past three)", en: "on 6 → half past (3:30 = half past three)" },
        { th: "เข็มยาวชี้ 3 → quarter past (3:15 = quarter past three)", en: "on 3 → quarter past (3:15 = quarter past three)" },
        { th: "เข็มยาวชี้ 9 → quarter to \"ชั่วโมงถัดไป\" (3:45 = quarter to four)", en: "on 9 → quarter to the NEXT hour (3:45 = quarter to four)" },
      ],
      ex: [
        ["9:30", "half past nine"],
        ["6:45", "quarter to seven"],
      ],
      tip: { th: "quarter to four = 3:45 ไม่ใช่ 4:45! ต้องบวกไปชั่วโมงถัดไป — จุดผิดยอดฮิต", en: "quarter to four = 3:45, NOT 4:45 — you move to the next hour. A very common mistake." },
    },
    {
      h: { th: "Smart Learning — Adverbs of frequency (คำบอกความถี่)", en: "Smart Learning — Adverbs of frequency" },
      p: [
        { th: "คำที่บอกว่าทำสิ่งนั้นบ่อยแค่ไหน ใช้กับ Present Simple ตำแหน่งการวางสำคัญมาก", en: "Words that say how often something happens, used with the present simple. Word position matters a lot." },
      ],
      k: [
        { th: "ระดับความถี่: always (100%) > usually (~90%) > often (~70%) > sometimes (~50%) > rarely (~10%) > never (0%)", en: "always (100%) > usually (~90%) > often (~70%) > sometimes (~50%) > rarely (~10%) > never (0%)" },
        { th: "วางหน้ากริยาแท้: I always brush my teeth.", en: "Before a main verb: I always brush my teeth." },
        { th: "วางหลัง verb to be: She is never late.", en: "After the verb to be: She is never late." },
      ],
      ex: [
        [{ th: "I ___ eat breakfast. (usually)", en: "I ___ eat breakfast. (usually)" }, "I usually eat breakfast."],
        [{ th: "He is ___ happy. (always)", en: "He is ___ happy. (always)" }, "He is always happy."],
      ],
      tip: { th: "\"I brush always\" ผิด (ต้องอยู่หน้ากริยาแท้) และ \"She always is late\" ผิด (ต้องอยู่หลัง is)", en: "\"I brush always\" is wrong (goes before the main verb); \"She always is late\" is wrong (goes after 'is')." },
    },
  ],

  time: [
    {
      h: { th: "อ่านนาฬิกาแบบเข็ม (Analog clock)", en: "Reading an analog clock" },
      p: [
        { th: "นาฬิกาแบบเข็มมีเข็มสั้น (ชั่วโมง) และเข็มยาว (นาที) ส่วนนาฬิกาดิจิทัลบอกเป็นตัวเลข เช่น 3:00", en: "An analog clock has a short hand (hours) and a long hand (minutes); a digital clock shows numbers like 3:00." },
      ],
      k: [
        { th: "o'clock ใช้เมื่อเข็มยาวชี้ 12 พอดี", en: "Use o'clock when the long hand is exactly on 12" },
        { th: "past = เลยไปแล้ว (นาที 1–30) เช่น quarter past = 15 นาที, half past = 30 นาที", en: "past = after the hour (min 1–30): quarter past = :15, half past = :30" },
        { th: "to = อีกกี่นาทีจะถึงชั่วโมงถัดไป (นาที 31–59) เช่น quarter to = อีก 15 นาที", en: "to = minutes before the next hour (min 31–59): quarter to = 15 min before" },
      ],
      ex: [
        ["2:15", "quarter past two"],
        ["10:45", "quarter to eleven"],
      ],
      tip: { th: "เมื่อเจอ \"to\" ให้เปลี่ยนไปพูดชั่วโมงถัดไปเสมอ (7:50 = ten to eight ไม่ใช่ ten to seven)", en: "With \"to\", always say the NEXT hour (7:50 = ten to eight, not seven)." },
    },
    {
      h: { th: "คำบอกความถี่และตำแหน่งในประโยค", en: "Adverbs of frequency & their position" },
      p: [
        { th: "ทบทวนอีกครั้ง: adverb of frequency บอกว่าเกิดบ่อยแค่ไหน และมีกฎการวางที่ชัดเจน", en: "A quick review: adverbs of frequency say how often, and follow a clear placement rule." },
      ],
      k: [
        { th: "เรียงจากน้อยไปมาก: never → rarely → sometimes → often → usually → always", en: "Least → most: never → rarely → sometimes → often → usually → always" },
        { th: "หน้ากริยาแท้ / หลัง is-am-are", en: "Before the main verb / after is-am-are" },
      ],
      ex: [
        [{ th: "เรียง: sometimes, never, always", en: "Order: sometimes, never, always" }, "never → sometimes → always"],
      ],
      tip: { th: "verb to be (is/am/are) เป็นข้อยกเว้น — adverb อยู่ \"หลัง\" เสมอ", en: "The verb to be (is/am/are) is the exception — the adverb goes AFTER it." },
    },
  ],

  math: [
    {
      h: { th: "หลักและค่าประจำหลัก (ถึงหลักแสน)", en: "Place value (up to hundred-thousands)" },
      p: [
        { th: "อ่านหลักจากขวาไปซ้าย: หน่วย สิบ ร้อย พัน หมื่น แสน เลขตัวเดียวกันอยู่คนละหลักมีค่าต่างกัน", en: "Read places right→left: ones, tens, hundreds, thousands, ten-thousands, hundred-thousands. The same digit has a different value in a different place." },
      ],
      k: [
        { th: "45,318 = 40,000 + 5,000 + 300 + 10 + 8 (เขียนแบบกระจาย)", en: "45,318 = 40,000 + 5,000 + 300 + 10 + 8 (expanded form)" },
        { th: "เลข 5 ใน 45,318 อยู่หลักพัน มีค่า 5,000", en: "The 5 in 45,318 is in the thousands place → 5,000" },
        { th: "อ่านตัวเลข: 30,027 = thirty thousand, twenty-seven", en: "30,027 = thirty thousand, twenty-seven" },
      ],
      ex: [
        [{ th: "เลข 7 ใน 27,450 มีค่า", en: "Value of 7 in 27,450" }, "7,000"],
      ],
      tip: { th: "ตอนเขียนจากคำอ่าน อย่าลืมใส่ 0 ในหลักที่ไม่มีค่า: สามหมื่นยี่สิบเจ็ด = 30,027 ไม่ใช่ 3,027", en: "When writing from words, keep zero placeholders: thirty thousand twenty-seven = 30,027, not 3,027." },
    },
    {
      h: { th: "การบวกมีการทด (Addition with regrouping)", en: "Addition with regrouping" },
      p: [
        { th: "ตั้งหลักให้ตรงกัน บวกจากขวาไปซ้าย ถ้าผลรวมในหลักใดเกิน 9 ให้ทด 1 ไปหลักถัดไป", en: "Line up the places, add right→left, and carry 1 to the next column whenever a column total exceeds 9." },
      ],
      k: [
        { th: "ตัวอย่างละเอียด: 46,758 + 25,467 → 8+7=15 เขียน 5 ทด 1 → ทำต่อทุกหลัก = 72,225", en: "Worked: 46,758 + 25,467 → 8+7=15, write 5 carry 1, continue = 72,225" },
      ],
      ex: [
        ["12,500 + 8,750 =", "21,250"],
        ["18,500 + 18,500 =", "37,000"],
      ],
      tip: { th: "ตั้งหลักไม่ตรงคือสาเหตุผิดอันดับ 1 — เขียนหน่วยให้ตรงหน่วย สิบตรงสิบเสมอ", en: "Misaligned columns are the #1 error — keep ones under ones, tens under tens." },
    },
    {
      h: { th: "การลบมีการกระจาย/ยืม (Subtraction with borrowing)", en: "Subtraction with borrowing" },
      p: [
        { th: "ถ้าตัวตั้งในหลักใดน้อยกว่าตัวลบ ให้ยืม 1 จากหลักถัดไป ระวังเป็นพิเศษเมื่อต้องยืมข้ามเลข 0", en: "If a top digit is smaller than the bottom one, borrow 1 from the next place. Take extra care when borrowing across zeros." },
      ],
      k: [
        { th: "ตัวอย่าง: 60,003 − 27,486 = 32,517 (ต้องยืมต่อเนื่องข้ามเลข 0 หลายหลัก)", en: "Worked: 60,003 − 27,486 = 32,517 (borrow across several zeros)" },
      ],
      ex: [
        ["50,000 − 12,345 =", "37,655"],
        ["100,000 − 1 =", "99,999"],
      ],
      tip: { th: "การยืมข้ามเลข 0 คือจุดที่พลาดมากที่สุด — ฝึกซ้ำหลาย ๆ ข้อจนคล่อง", en: "Borrowing across zeros is where most marks are lost — drill it repeatedly." },
    },
    {
      h: { th: "เปรียบเทียบจำนวน โจทย์ระคน และโจทย์ปัญหา", en: "Comparing, mixed operations & word problems" },
      p: [
        { th: "เปรียบเทียบ: ดูจำนวนหลักก่อน ถ้าเท่ากันให้เทียบเลขตัวซ้ายสุดที่ต่างกัน | โจทย์ระคน: ทำในวงเล็บก่อนเสมอ", en: "Comparing: count digits first, then compare the leftmost differing place. Mixed problems: do the brackets first." },
      ],
      k: [
        { th: "34,251 > 34,125 (หลักร้อย 2 > 1)", en: "34,251 > 34,125 (hundreds 2 > 1)" },
        { th: "คำสำคัญ: รวม/ทั้งหมด/เพิ่ม → บวก | เหลือ/หายไป/มากกว่ากันเท่าไร → ลบ", en: "Keywords: total/altogether/more → add | left/lost/difference → subtract" },
      ],
      ex: [
        ["15,000 − (4,300 + 2,700) =", "15,000 − 7,000 = 8,000"],
        [{ th: "มีเงิน 45,000 ซื้อของ 18,750 เหลือ", en: "Have 45,000, spend 18,750 → left" }, "26,250"],
      ],
      tip: { th: "อ่านโจทย์ให้จบก่อนคำนวณ — \"มากกว่ากันเท่าไร\" คือการลบ ไม่ใช่การบวก", en: "Read the whole problem first — \"how much more\" means subtract, not add." },
    },
  ],

  science: [
    {
      h: { th: "5 ช่วงวัยของมนุษย์ (Five stages of growth)", en: "The five stages of human growth" },
      p: [
        { th: "มนุษย์เติบโตเป็นลำดับ 5 ช่วงวัย แต่ละวัยมีลักษณะเด่นต่างกัน ช่วงอายุเป็นค่าประมาณ ให้จำ \"ลักษณะเด่น\" เป็นหลัก", en: "Humans grow through five stages, each with its own features. The age ranges are approximate — remember the key features, not exact cut-offs." },
      ],
      k: [
        { th: "Infancy วัยทารก (0–2 ปี): กินนม หัดนั่ง คลาน เดิน ฟันน้ำนมขึ้น ~6 เดือน", en: "Infancy (0–2 yrs): drinks milk, sits, crawls, walks; baby teeth ~6 months" },
        { th: "Childhood วัยเด็ก (2–12 ปี): โต ~4–5 ซม./ปี ฟันแท้ขึ้น ~6 ขวบ เรียนอ่านเขียน", en: "Childhood (2–12 yrs): ~4–5 cm/yr, permanent teeth ~6, learns to read/write" },
        { th: "Adolescence วัยรุ่น (12–20 ปี): เข้าสู่ puberty โตเร็ว ร่างกายเปลี่ยนแปลง", en: "Adolescence (12–20 yrs): puberty, rapid growth, body changes" },
        { th: "Adulthood วัยผู้ใหญ่ (20–60 ปี): โตเต็มที่ แข็งแรงที่สุด ทำงาน", en: "Adulthood (20–60 yrs): fully grown, strongest, works" },
        { th: "Elderly วัยชรา (60+ ปี): ผมหงอก ผิวเหี่ยว กระดูก-กล้ามเนื้ออ่อนแอ ประสาทสัมผัสถดถอย", en: "Elderly (60+): grey hair, wrinkles, weaker bones/muscles, declining senses" },
      ],
      ex: [
        [{ th: "ฟันแท้เริ่มขึ้นตอนอายุประมาณ", en: "Permanent teeth appear about age" }, "6 ขวบ / age 6"],
        [{ th: "วัยที่แข็งแรงที่สุด", en: "Strongest stage" }, "Adulthood วัยผู้ใหญ่"],
      ],
      tip: { th: "ข้อสอบชอบสลับลำดับวัย ท่องให้แม่น: ทารก → เด็ก → รุ่น → ผู้ใหญ่ → ชรา", en: "Exams love to scramble the order — memorise: infancy → childhood → adolescence → adulthood → elderly." },
    },
    {
      h: { th: "วัยแรกรุ่น (Puberty) และการเปลี่ยนแปลง", en: "Puberty and its changes" },
      p: [
        { th: "Puberty คือช่วงที่ร่างกายเด็กเปลี่ยนเป็นผู้ใหญ่ เกิดจากฮอร์โมน แต่ละคนเปลี่ยนช้า-เร็วไม่เท่ากัน เป็นเรื่องปกติทั้งหมด", en: "Puberty is when a child's body changes into an adult's, driven by hormones. Everyone develops at a different pace — all of it is normal." },
      ],
      k: [
        { th: "เด็กชาย: เสียงแตก/ทุ้ม มีหนวดเครา ไหล่กว้าง กล้ามเนื้อโต สูงขึ้นเร็ว", en: "Boys: voice deepens, facial hair, broad shoulders, muscles, taller" },
        { th: "เด็กหญิง: หน้าอกขยาย สะโพกผาย เริ่มมีประจำเดือน (~9–16 ปี)", en: "Girls: breasts develop, hips widen, menstruation begins (~9–16 yrs)" },
        { th: "Menstruation เป็นสัญญาณปกติของการเติบโต ต้องดูแลความสะอาด", en: "Menstruation is a normal, healthy sign of growing up; hygiene matters" },
        { th: "อารมณ์: แปรปรวน อยากเป็นตัวของตัวเอง สนใจความเห็นเพื่อน (ปกติ)", en: "Emotions: mood swings, wanting independence, caring about friends (normal)" },
        { th: "ผู้สูงอายุ: สายตา-การได้ยินแย่ลง กระดูกเปราะ ต้องการความช่วยเหลือและกำลังใจ", en: "Elderly: weaker sight/hearing, fragile bones, need help and companionship" },
      ],
      ex: [
        [{ th: "เสียงแตกเกิดกับใคร", en: "Whose voice breaks?" }, "เด็กผู้ชาย / boys"],
        [{ th: "ประจำเดือนเริ่มช่วงอายุ", en: "Menstruation starts around ages" }, "9–16 ปี"],
      ],
      tip: { th: "ข้อสอบชอบสลับการเปลี่ยนแปลงของชาย-หญิง อ่านให้ดีว่าถาม boys หรือ girls", en: "Exams often swap boys' and girls' changes — read carefully whether it asks about boys or girls." },
    },
  ],

  health: [
    {
      h: { th: "การเจริญเติบโตตามวัย (Growth by age)", en: "Growth according to age" },
      p: [
        { th: "รูปร่าง ส่วนสูง น้ำหนัก เปลี่ยนตามวัยและต่างกันตามเพศ เราชั่งน้ำหนัก-วัดส่วนสูงแล้วเทียบกับเกณฑ์มาตรฐาน", en: "Body shape, height, and weight change with age and differ by sex; we weigh and measure ourselves and compare with standard growth charts." },
      ],
      k: [
        { th: "เทียบตนเองกับเกณฑ์มาตรฐานเพื่อดูว่าโตสมวัยหรือไม่", en: "Compare yourself with the standard chart to see if you're growing well" },
      ],
      ex: [],
      tip: null,
    },
    {
      h: { th: "ปัจจัยที่มีผลต่อการเจริญเติบโต 5 ข้อ", en: "The 5 growth factors" },
      p: [
        { th: "การเติบโตขึ้นกับหลายปัจจัยร่วมกัน ท่องให้ครบทั้ง 5 ข้อ", en: "Growth depends on several factors together — memorise all five." },
      ],
      k: [
        { th: "1. อาหาร (Nutrition): กินครบ 5 หมู่ นม ไข่ ปลา ผัก ช่วยให้สูง", en: "1. Nutrition: eat the 5 food groups; milk, eggs, fish, vegetables help height" },
        { th: "2. การออกกำลังกาย (Exercise): เสริมกระดูกและกล้ามเนื้อ", en: "2. Exercise: strengthens bones and muscles" },
        { th: "3. การพักผ่อน (Sleep): นอนพอช่วยการเจริญเติบโต", en: "3. Sleep: enough rest helps growth" },
        { th: "4. พันธุกรรม (Heredity): พ่อแม่สูง ลูกมักสูง", en: "4. Heredity: tall parents → child likely tall" },
        { th: "5. สิ่งแวดล้อม (Environment): อากาศ-น้ำสะอาด บ้านปลอดภัย", en: "5. Environment: clean air/water, a safe home" },
      ],
      ex: [
        [{ th: "ทำไมลูกหน้าเหมือนพ่อแม่", en: "Why do children look like parents?" }, "พันธุกรรม / heredity"],
        [{ th: "บอกสิ่งที่ช่วยให้สูง 2 อย่าง", en: "Two things that help you grow" }, "อาหารดี + ออกกำลังกาย/นอนพอ"],
      ],
      tip: { th: "ท่องลำดับง่าย ๆ: อาหาร–ออกกำลังกาย–พักผ่อน–พันธุกรรม–สิ่งแวดล้อม (5 ข้อ)", en: "Chant the five: nutrition–exercise–sleep–heredity–environment." },
    },
    {
      h: { th: "ครอบครัวและเพื่อน (Family & friends)", en: "Family and friends" },
      p: [
        { th: "รู้จักสมาชิกครอบครัว บทบาทหน้าที่ และการเป็นเพื่อนที่ดี", en: "Know your family members, their roles, and how to be a good friend." },
      ],
      k: [
        { th: "สมาชิก: father, mother, brother, sister, grandfather, grandmother", en: "Members: father, mother, brother, sister, grandfather, grandmother" },
        { th: "ช่วยงานบ้าน เคารพผู้ใหญ่ ดูแลกัน", en: "Help at home, respect elders, care for one another" },
        { th: "เพื่อนที่ดี: แบ่งปัน (sharing) มีน้ำใจ (kindness) ซื่อสัตย์ (honesty)", en: "A good friend: sharing, kindness, honesty" },
      ],
      ex: [
        [{ th: "คุณสมบัติเพื่อนที่ดี 2 ข้อ", en: "Two qualities of a good friend" }, "แบ่งปัน / ซื่อสัตย์"],
      ],
      tip: null,
    },
  ],

  thai: [
    {
      h: { th: "อักษรสามหมู่ (ไตรยางศ์) และการผันวรรณยุกต์", en: "The three consonant classes & tone conjugation" },
      p: [
        { th: "วรรณยุกต์มี 4 รูป (่ ้ ๊ ๋) แต่มี 5 เสียง (สามัญ เอก โท ตรี จัตวา) พยัญชนะแบ่งเป็น 3 หมู่ แต่ละหมู่ผันได้ไม่เท่ากัน", en: "There are 4 tone marks but 5 tones (mid, low, falling, high, rising). Consonants split into three classes that conjugate differently." },
      ],
      k: [
        { th: "อักษรกลาง 9 ตัว: ก จ ฎ ฏ ด ต บ ป อ — \"ไก่จิกเด็กตายบนปากโอ่ง\" — ผันครบ 5 เสียง", en: "Mid-class (9): ก จ ฎ ฏ ด ต บ ป อ — produces all 5 tones" },
        { th: "อักษรสูง 11 ตัว: ข ฃ ฉ ฐ ถ ผ ฝ ศ ษ ส ห — \"ผีเศรษฐีฝากถุงข้าวสารให้ฉัน\" — ผัน 3 เสียง (เอก โท จัตวา)", en: "High-class (11): produces 3 tones (low, falling, rising)" },
        { th: "อักษรต่ำ 24 ตัว (ต่ำเดี่ยว 10: \"งูใหญ่นอนอยู่ ณ ริมวัดโมฬีโลก\") — ผัน 3 เสียง (สามัญ โท ตรี)", en: "Low-class (24): produces 3 tones (mid, falling, high)" },
        { th: "ตัวอย่างอักษรกลาง: กา ก่า ก้า ก๊า ก๋า (ครบ 5 เสียง)", en: "Mid example: กา ก่า ก้า ก๊า ก๋า (all 5 tones)" },
      ],
      ex: [
        [{ th: "\"จ\" เป็นอักษรหมู่ใด", en: "Which class is จ?" }, "อักษรกลาง / mid-class"],
        [{ th: "\"ค่า\" (ไม้เอก) ออกเสียงวรรณยุกต์ใด", en: "\"ค่า\" (low mark) — which tone?" }, "เสียงโท / falling"],
      ],
      tip: { th: "อักษรต่ำ \"รูปไม่ตรงเสียง\"! ค่า(ไม้เอก)=เสียงโท, ค้า(ไม้โท)=เสียงตรี — จุดผิดยอดฮิตที่สุดของข้อสอบ", en: "Low-class: the mark ≠ the tone! ค่า (low mark) = falling, ค้า (falling mark) = high. The #1 exam trap." },
    },
    {
      h: { th: "มาตราตัวสะกด กก กด กน กบ", en: "Final-consonant categories" },
      p: [
        { th: "มาตราตัวสะกดคือกลุ่มเสียงพยัญชนะท้ายคำ บางคำสะกด \"ไม่ตรงมาตรา\" แต่ออกเสียงเดียวกัน ให้ฟังเสียงท้ายคำเป็นหลัก", en: "Final-consonant categories group words by their ending sound. Some words are spelled 'off-pattern' but sound the same — listen to the final sound." },
      ],
      k: [
        { th: "แม่กก (เสียง /ก/): ก ข ค ฆ — นก มาก สุข เมฆ", en: "แม่กก (/k/): นก มาก สุข เมฆ" },
        { th: "แม่กด (เสียง /ด/): ด ต ถ ท ธ จ ช ซ ศ ษ ส ฯลฯ — กด รถ พุธ ก๊าซ", en: "แม่กด (/d/): กด รถ พุธ ก๊าซ" },
        { th: "แม่กน (เสียง /น/): น ณ ญ ร ล ฬ — กิน บ้าน สาร กาล", en: "แม่กน (/n/): กิน บ้าน สาร กาล" },
        { th: "แม่กบ (เสียง /บ/): บ ป พ ฟ ภ — กบ รูป ภาพ ยีราฟ", en: "แม่กบ (/b/): กบ รูป ภาพ ยีราฟ" },
      ],
      ex: [
        [{ th: "\"รูป\" อยู่มาตราใด", en: "\"รูป\" belongs to?" }, "แม่กบ"],
        [{ th: "\"เมฆ\" อยู่มาตราใด", en: "\"เมฆ\" belongs to?" }, "แม่กก (ฆ ไม่ตรงมาตรา)"],
      ],
      tip: { th: "คำไม่ตรงมาตรา เช่น สุข(ข) เมฆ(ฆ) รถ(ถ) ภาพ(พ) — ให้ฟัง \"เสียงท้ายคำ\" ไม่ใช่ดูตัวอักษร", en: "Off-pattern words (สุข, เมฆ, รถ, ภาพ) — judge by the final SOUND, not the letter." },
    },
    {
      h: { th: "ชนิดของคำ และการแต่งประโยค", en: "Parts of speech & sentence building" },
      p: [
        { th: "คำมีหลายชนิด และประโยคสมบูรณ์ต้องมีประธาน + กริยา (+ กรรม)", en: "Words come in types, and a complete sentence needs a subject + verb (+ object)." },
      ],
      k: [
        { th: "คำนาม: ชื่อคน สัตว์ สิ่งของ สถานที่ (ครู แมว โต๊ะ โรงเรียน)", en: "Noun: names of people, animals, things, places" },
        { th: "คำสรรพนาม: ใช้แทนนาม (ฉัน เธอ เขา มัน เรา) — บุรุษที่ 1/2/3", en: "Pronoun: replaces a noun (ฉัน เธอ เขา) — 1st/2nd/3rd person" },
        { th: "คำกริยา: แสดงอาการ (กิน วิ่ง นอน เขียน)", en: "Verb: shows action (eat, run, sleep, write)" },
        { th: "ชนิดประโยค: บอกเล่า / ปฏิเสธ / คำถาม / คำสั่ง-ขอร้อง", en: "Sentence types: statement / negative / question / command-request" },
      ],
      ex: [
        [{ th: "\"แมวจับหนู\" — กริยาคือ", en: "\"แมวจับหนู\" — the verb is" }, "จับ"],
        [{ th: "\"เธอไปโรงเรียนไหม\" เป็นประโยค", en: "\"เธอไปโรงเรียนไหม\" is a" }, "ประโยคคำถาม / question"],
      ],
      tip: { th: "อ่านนิทานแล้วฝึกตอบ ใคร-ทำอะไร-ที่ไหน-เมื่อไร-ผลอย่างไร และหา \"ข้อคิด\" ของเรื่องทุกครั้ง", en: "After reading a fable, practise who-did-what-where-when-outcome, and always find the moral." },
    },
  ],

  scith: [
    {
      h: { th: "ปัจจัยจำเป็นต่อการดำรงชีวิต", en: "Necessities for living" },
      p: [
        { th: "มนุษย์และสัตว์ต้องการสิ่งจำเป็นเพื่อเจริญเติบโตและมีชีวิตอยู่", en: "Humans and animals need certain things to grow and stay alive." },
      ],
      k: [
        { th: "4 อย่าง: อาหาร น้ำ อากาศ ที่อยู่อาศัย", en: "Four things: food, water, air, shelter" },
      ],
      ex: [
        [{ th: "ปัจจัยจำเป็นต่อชีวิตมีอะไรบ้าง", en: "What are life's necessities?" }, "อาหาร น้ำ อากาศ ที่อยู่อาศัย"],
      ],
      tip: null,
    },
    {
      h: { th: "วัฏจักรชีวิตของสัตว์ (หน้า 54–89)", en: "Animal life cycles" },
      p: [
        { th: "วัฏจักรชีวิตคือการเปลี่ยนแปลงตั้งแต่เกิด → เติบโต → สืบพันธุ์ → เกิดรุ่นใหม่ หมุนเวียนต่อเนื่องเป็นวงจร", en: "A life cycle is the change from birth → growth → reproduction → a new generation, repeating in a loop." },
      ],
      k: [
        { th: "สัตว์ออกลูกเป็นไข่: ไก่ (3 ระยะ) ไข่ → ลูกไก่ → ตัวเต็มวัย", en: "Egg-layers: chicken (3 stages) egg → chick → adult" },
        { th: "ผีเสื้อ (4 ระยะ): ไข่ → หนอน → ดักแด้ → ตัวเต็มวัย", en: "Butterfly (4 stages): egg → larva → pupa → adult" },
        { th: "กบ: ไข่ → ลูกอ๊อด → กบ", en: "Frog: egg → tadpole → frog" },
        { th: "สัตว์ออกลูกเป็นตัว: สุนัข แมว โลมา (ลูกคล้ายพ่อแม่)", en: "Live-bearers: dog, cat, dolphin (young resemble parents)" },
      ],
      ex: [
        [{ th: "วัฏจักรผีเสื้อมีกี่ระยะ", en: "Butterfly cycle — how many stages?" }, "4 ระยะ"],
        [{ th: "สัตว์ใดออกลูกเป็นตัว: ไก่/โลมา/ผีเสื้อ", en: "Which is a live-bearer?" }, "โลมา / dolphin"],
      ],
      tip: { th: "เรียงวัฏจักรผีเสื้อให้ถูก: ไข่ → หนอน → ดักแด้ → ตัวเต็มวัย (ดักแด้มาก่อนตัวเต็มวัย)", en: "Order the butterfly cycle: egg → larva → pupa → adult (pupa comes before adult)." },
    },
  ],

  social: [
    {
      h: { th: "ประเพณี วัฒนธรรมไทย และวันสำคัญ", en: "Thai traditions & important days" },
      p: [
        { th: "ประเพณีไทยสะท้อนความกตัญญูและความเชื่อของคนไทย ควรจำเดือน/ความหมายของแต่ละงาน", en: "Thai traditions reflect gratitude and belief; remember each festival's month and meaning." },
      ],
      k: [
        { th: "สงกรานต์ (13–15 เม.ย.): ปีใหม่ไทย รดน้ำดำหัวผู้ใหญ่", en: "Songkran (13–15 Apr): Thai New Year, pouring water to honour elders" },
        { th: "ลอยกระทง (ขึ้น 15 ค่ำ เดือน 12): ขอขมาพระแม่คงคา", en: "Loy Krathong (full moon, 12th lunar month): thanking the water goddess" },
        { th: "วันพ่อ/วันชาติ 5 ธ.ค. | วันแม่ 12 ส.ค. | วันจักรี 6 เม.ย. | วันปิยมหาราช 23 ต.ค.", en: "Father's/National Day 5 Dec | Mother's 12 Aug | Chakri 6 Apr | Chulalongkorn 23 Oct" },
        { th: "วันสำคัญทางพุทธ: วิสาขบูชา มาฆบูชา อาสาฬหบูชา", en: "Buddhist days: Visakha, Makha, Asalha Bucha" },
      ],
      ex: [
        [{ th: "วันแม่ตรงกับ", en: "Mother's Day is" }, "12 สิงหาคม"],
        [{ th: "ประเพณีขอขมาพระแม่คงคา", en: "Festival thanking the water goddess" }, "ลอยกระทง"],
      ],
      tip: { th: "อย่าสับสน: สงกรานต์ = เมษายน, ลอยกระทง = เดือน 12 (ราวพฤศจิกายน)", en: "Don't mix up: Songkran = April, Loy Krathong = 12th lunar month (around November)." },
    },
    {
      h: { th: "ประชาธิปไตยในชั้นเรียน โรงเรียน ชุมชน", en: "Democracy in class, school, community" },
      p: [
        { th: "การอยู่ร่วมกันแบบประชาธิปไตย ยึดเสียงส่วนใหญ่และเคารพเสียงส่วนน้อย", en: "Living together democratically means following the majority while respecting the minority." },
      ],
      k: [
        { th: "ออกเสียงโดยตรง: ทุกคนยกมือลงคะแนนเอง", en: "Direct vote: everyone raises a hand to vote" },
        { th: "เลือกตัวแทน: เช่น เลือกหัวหน้าห้อง", en: "Choosing a representative: e.g. electing a class monitor" },
        { th: "สมาชิกที่ดีมีส่วนร่วมในกิจกรรมของห้อง โรงเรียน ชุมชน", en: "Good members take part in class, school, and community activities" },
      ],
      ex: [
        [{ th: "การเลือกหัวหน้าห้องเป็นประชาธิปไตยแบบ", en: "Electing a class monitor is…" }, "การเลือกตัวแทน"],
      ],
      tip: null,
    },
    {
      h: { th: "พุทธประวัติ (จริยะ)", en: "Life of the Buddha (Ethics)" },
      p: [
        { th: "เจ้าชายสิทธัตถะ พระราชโอรสของพระเจ้าสุทโธทนะและพระนางสิริมหามายา ต่อมาตรัสรู้เป็นพระพุทธเจ้า", en: "Prince Siddhartha, son of King Suddhodana and Queen Sirimahamaya, later became enlightened as the Buddha." },
      ],
      k: [
        { th: "ประสูติ: ขึ้น 15 ค่ำ เดือน 6 ณ สวนลุมพินีวัน", en: "Born: full moon, 6th lunar month, at Lumbini garden" },
        { th: "ตรัสรู้: พระชนมายุ 35 พรรษา ใต้ต้นศรีมหาโพธิ์ (พุทธคยา) — ธรรมคือ อริยสัจ 4", en: "Enlightened: age 35, under the Bodhi tree — the Four Noble Truths" },
        { th: "ปรินิพพาน: พระชนมายุ 80 พรรษา ณ เมืองกุสินารา", en: "Passed away: age 80, at Kusinara" },
        { th: "ทั้ง 3 เหตุการณ์ตรงกับวันวิสาขบูชา | อริยสัจ 4 = ทุกข์ สมุทัย นิโรธ มรรค", en: "All three fall on Visakha Bucha | Four Noble Truths = suffering, cause, cessation, path" },
      ],
      ex: [
        [{ th: "ตรัสรู้เมื่อพระชนมายุ", en: "Enlightened at age" }, "35 พรรษา"],
        [{ th: "อริยสัจ 4 ได้แก่", en: "The Four Noble Truths are" }, "ทุกข์ สมุทัย นิโรธ มรรค"],
      ],
      tip: { th: "ตรัสรู้ 35 พรรษา / ปรินิพพาน 80 พรรษา — ข้อสอบชอบสลับตัวเลขสองตัวนี้", en: "Enlightened at 35 / passed at 80 — exams love to swap these two numbers." },
    },
  ],

  history: [
    {
      h: { th: "การเทียบศักราช พ.ศ. ↔ ค.ศ.", en: "Converting Buddhist ↔ Christian era" },
      p: [
        { th: "พ.ศ. (พุทธศักราช) มากกว่า ค.ศ. (คริสต์ศักราช) อยู่ 543 ปีเสมอ", en: "The Buddhist era (BE) is always 543 years ahead of the Christian era (CE)." },
      ],
      k: [
        { th: "พ.ศ. − 543 = ค.ศ.", en: "BE − 543 = CE" },
        { th: "ค.ศ. + 543 = พ.ศ.", en: "CE + 543 = BE" },
        { th: "ตัวอย่าง: พ.ศ. 2569 − 543 = ค.ศ. 2026", en: "Example: BE 2569 − 543 = CE 2026" },
      ],
      ex: [
        ["พ.ศ. 2569 = ค.ศ. ?", "2026"],
        ["ค.ศ. 2000 = พ.ศ. ?", "2543"],
      ],
      tip: { th: "จำง่าย ๆ: แปลงเป็น ค.ศ. ให้ \"ลบ\" (ค.ศ. ตัวเลขน้อยกว่า) — สลับบวกลบคือข้อผิดคลาสสิก", en: "Remember: to get CE, subtract (CE numbers are smaller). Swapping +/− is the classic error." },
    },
    {
      h: { th: "ลำดับเหตุการณ์และแหล่งข้อมูล", en: "Ordering events & sources" },
      p: [
        { th: "เรียงเหตุการณ์สำคัญของโรงเรียน/ชุมชนด้วยเส้นเวลา (Timeline) จากอดีตไปปัจจุบัน", en: "Order key school/community events on a timeline, from past to present." },
      ],
      k: [
        { th: "บนเส้นเวลา อดีตอยู่ซ้าย ปัจจุบันอยู่ขวา (ปี พ.ศ. น้อย = เก่ากว่า)", en: "On a timeline, past is on the left, present on the right (smaller BE year = older)" },
        { th: "แหล่งข้อมูล: คำบอกเล่าผู้เฒ่า ภาพถ่ายเก่า เอกสาร ป้ายประวัติ", en: "Sources: oral history from elders, old photos, documents, history plaques" },
      ],
      ex: [
        [{ th: "เครื่องมือเรียงลำดับเหตุการณ์ตามเวลา", en: "Tool for ordering events by time" }, "เส้นเวลา / timeline"],
      ],
      tip: null,
    },
  ],

  arts: [
    {
      h: { th: "การงานอาชีพ: หนูช่วยงานบ้าน (หน้า 4–26)", en: "Work skills: helping at home" },
      p: [
        { th: "งานบ้านคือการช่วยเหลือตนเอง ครอบครัว และส่วนรวม ฝึกความรับผิดชอบ", en: "Housework means helping yourself, your family, and everyone — it builds responsibility." },
      ],
      k: [
        { th: "ขั้นตอนการทำงาน: วางแผน → ลงมือทำตามแผน → ประเมินผล", en: "Work steps: plan → do → evaluate" },
        { th: "เครื่องมือทำความสะอาด: ไม้กวาด ไม้ถูพื้น ผ้าเช็ด ที่ตักผง", en: "Cleaning tools: broom, mop, cloth, dustpan" },
        { th: "ประโยชน์: รับผิดชอบ ประหยัด แบ่งเบาภาระครอบครัว", en: "Benefits: responsibility, thrift, easing the family's load" },
      ],
      ex: [
        [{ th: "ขั้นตอนแรกของการทำงาน", en: "First step of working" }, "การวางแผน / planning"],
      ],
      tip: null,
    },
    {
      h: { th: "ดนตรี: เครื่องดนตรีและค่าตัวโน้ต", en: "Music: instruments & note values" },
      p: [
        { th: "เครื่องดนตรีแต่ละชนิดมีรูปร่างและเสียงต่างกัน ตัวโน้ตบอกความยาวของเสียง (จังหวะ)", en: "Instruments differ in shape and sound; notes tell how long a sound lasts (beats)." },
      ],
      k: [
        { th: "กลุ่ม: เครื่องสาย (กีตาร์ ไวโอลิน) เครื่องเป่า (ขลุ่ย ฟลูต ทรัมเป็ต) เครื่องตี (กลอง ระนาด)", en: "Groups: strings (guitar, violin), wind (flute, recorder, trumpet), percussion (drum, ranat)" },
        { th: "ค่าตัวโน้ต: ตัวกลม 4 | ตัวขาว 2 | ตัวดำ 1 | เขบ็ต 1 ชั้น ½ จังหวะ", en: "Note values: whole 4 | half 2 | quarter 1 | eighth ½ beat" },
        { th: "ตัวหยุด = เครื่องหมายพักเสียงตามจังหวะนั้น ๆ", en: "A rest = silence for that number of beats" },
      ],
      ex: [
        [{ th: "โน้ตตัวกลมยาวกี่จังหวะ", en: "How many beats is a whole note?" }, "4 จังหวะ"],
        [{ th: "ตัวขาว 1 ตัว = ตัวดำกี่ตัว", en: "One half note = how many quarter notes?" }, "2 ตัว"],
      ],
      tip: { th: "ค่าตัวโน้ตลดลงทีละครึ่ง: กลม 4 → ขาว 2 → ดำ 1 → เขบ็ต ½", en: "Values halve each step: whole 4 → half 2 → quarter 1 → eighth ½." },
    },
    {
      h: { th: "ศิลปะ: ทัศนธาตุ / รูปร่าง-รูปทรง", en: "Art: visual elements, shape vs form" },
      p: [
        { th: "ทัศนธาตุคือส่วนประกอบของงานทัศนศิลป์ที่เห็นได้ในสิ่งแวดล้อมรอบตัว", en: "Visual elements are the building blocks of art, seen in the world around us." },
      ],
      k: [
        { th: "ทัศนธาตุ: จุด เส้น สี รูปร่าง รูปทรง พื้นผิว", en: "Visual elements: dot, line, colour, shape, form, texture" },
        { th: "รูปร่าง (Shape) = 2 มิติ (กว้าง×ยาว) เช่น วงกลม สามเหลี่ยม", en: "Shape = 2D (width×length) e.g. circle, triangle" },
        { th: "รูปทรง (Form) = 3 มิติ (กว้าง×ยาว×หนา) เช่น ทรงกลม ทรงกระบอก", en: "Form = 3D (width×length×depth) e.g. sphere, cylinder" },
        { th: "ประเภทรูปร่าง: ธรรมชาติ (คน สัตว์) เรขาคณิต (วงกลม) อิสระ (เมฆ หยดน้ำ)", en: "Shape types: natural (people, animals), geometric (circle), free-form (clouds, drops)" },
      ],
      ex: [
        [{ th: "รูปร่างต่างจากรูปทรงอย่างไร", en: "Shape vs form?" }, "รูปร่าง 2 มิติ / รูปทรง 3 มิติ"],
        [{ th: "เมฆจัดเป็นรูปร่างประเภทใด", en: "A cloud is which shape type?" }, "รูปร่างอิสระ / free-form"],
      ],
      tip: { th: "รูปร่าง = แบน (2 มิติ), รูปทรง = มีความหนา (3 มิติ) — สลับกันบ่อยในข้อสอบ", en: "Shape = flat (2D), form = has depth (3D) — often swapped in exams." },
    },
  ],
};

/* ================= LESSON EXPANSION (v3) =================
   Extra read-along sections appended to each subject.
   Adds worked examples, memory tricks (mem), and finer sub-topics. */
const LESSONS_MORE = {
  english: [
    {
      h: { th: "เทคนิค: There is / There are + คำบอกตำแหน่ง", en: "Trick: There is/are + prepositions" },
      p: [
        { th: "รวมสองเรื่องที่ออกสอบบ่อยเข้าด้วยกัน: การบอกว่า 'มีอะไร' และ 'อยู่ตรงไหน' ในภาพเดียว", en: "Two frequently-tested skills combined: saying what there is, and where it is, in one picture." },
      ],
      k: [
        { th: "มี 1 สิ่ง → There is a/an … | มีหลายสิ่ง → There are (จำนวน) …s", en: "One thing → There is a/an … | many → There are (number) …s" },
        { th: "in = ข้างใน | on = บนพื้นผิว | under = ข้างใต้ | next to = ข้าง ๆ", en: "in = inside | on = on a surface | under = below | next to = beside" },
      ],
      ex: [
        [{ th: "There ___ a cat on the chair.", en: "There ___ a cat on the chair." }, "is"],
        [{ th: "There ___ five books in the bag.", en: "There ___ five books in the bag." }, "are"],
        [{ th: "The ball is ___ the box. (ข้างใต้)", en: "The ball is ___ the box. (below)" }, "under"],
      ],
      mem: { th: "จำว่า 'is' คู่กับ 'a' (ตัวเดียว) เสมอ — เห็น a/an ให้ใช้ is; เห็นตัวเลข 2 ขึ้นไปให้ใช้ are", en: "Remember: 'is' pairs with 'a' (one). See a/an → is; see a number 2+ → are." },
      tip: { th: "ระวัง There is books ✗ — พหูพจน์ต้อง There are books ✓", en: "Avoid 'There is books' — plural needs 'There are books'." },
    },
    {
      h: { th: "เทคนิค: คำนามนับได้ vs นับไม่ได้", en: "Trick: countable vs uncountable nouns" },
      p: [
        { th: "อาหารบางอย่างนับเป็นชิ้นได้ (an apple, two eggs) บางอย่างนับไม่ได้ (juice, cheese, water) ต้องใช้คำนำหน้าต่างกัน", en: "Some foods can be counted (an apple, two eggs); others cannot (juice, cheese, water) and take different words." },
      ],
      k: [
        { th: "นับได้: a / an / ตัวเลข + เติม s (two apples)", en: "Countable: a/an/number + plural -s (two apples)" },
        { th: "นับไม่ได้: some (some juice) — ห้ามใช้ a หรือเติม s", en: "Uncountable: some (some juice) — no 'a', no -s" },
      ],
      ex: [
        [{ th: "I want ___ water.", en: "I want ___ water." }, "some"],
        [{ th: "There are two ___. (egg)", en: "There are two ___. (egg)" }, "eggs"],
      ],
      mem: { th: "ของเหลว/ผง (juice, water, cheese, salad) = นับไม่ได้ → some เสมอ", en: "Liquids/soft foods (juice, water, cheese, salad) = uncountable → always 'some'." },
      tip: null,
    },
  ],
  time: [
    {
      h: { th: "เทคนิคอ่านเวลา: จำหน้าปัดเป็น 4 จุด", en: "Trick: split the clock into 4 points" },
      p: [
        { th: "แบ่งหน้าปัดเป็น 4 จุดง่าย ๆ แล้วจำคำคู่กับแต่ละจุด จะอ่านเวลาได้เร็วขึ้นมาก", en: "Split the clock face into 4 easy points and pair a phrase with each — you'll read time much faster." },
      ],
      k: [
        { th: "12 บน = o'clock | 3 ขวา = quarter past | 6 ล่าง = half past | 9 ซ้าย = quarter to", en: "12 top = o'clock | 3 right = quarter past | 6 bottom = half past | 9 left = quarter to" },
      ],
      ex: [
        ["4:00", "four o'clock"],
        ["4:15", "quarter past four"],
        ["4:30", "half past four"],
        ["4:45", "quarter to five"],
      ],
      mem: { th: "ท่อง: 'บน-นาฬิกา / ขวา-past / ล่าง-half / ซ้าย-to(ถัดไป)' และจำว่าเข็มไปทางซ้าย = พูดชั่วโมงถัดไป", en: "Chant: 'top-o'clock / right-past / bottom-half / left-to(next)'. Left side = say the NEXT hour." },
      tip: { th: "ฝั่งซ้าย (to) ต้องบวกชั่วโมงถัดไปเสมอ — จุดพลาดที่พบมากที่สุด", en: "The left side (to) always means the next hour — the most common slip." },
    },
  ],
  math: [
    {
      h: { th: "เทคนิคการยืมข้ามเลข 0 (สำคัญมาก!)", en: "Trick: borrowing across zeros (very important!)" },
      p: [
        { th: "เมื่อเจอเลข 0 หลายตัวในตัวตั้ง เช่น 60,003 − 27,486 ให้ยืมทีละหลักจากซ้ายมาขวา 0 จะกลายเป็น 9 ต่อ ๆ กัน", en: "With several zeros on top (e.g. 60,003 − 27,486), borrow step by step; each 0 becomes 9 in a chain." },
      ],
      k: [
        { th: "ขั้นที่ 1: หน่วย 3 ลบ 6 ไม่ได้ ต้องยืม แต่หลักข้าง ๆ เป็น 0 หมด", en: "Step 1: ones 3−6 impossible, must borrow, but neighbours are all 0" },
        { th: "ขั้นที่ 2: ยืมจากหลักหมื่น (6) → หลักพัน/ร้อย/สิบ กลายเป็น 9,9,9 หน่วยได้ 13", en: "Step 2: borrow from the ten-thousands (6) → the 0s become 9,9,9; ones becomes 13" },
        { th: "ขั้นที่ 3: ค่อยลบทีละหลักตามปกติ = 32,517", en: "Step 3: subtract each column normally = 32,517" },
      ],
      ex: [
        ["60,003 − 27,486 =", "32,517"],
        ["70,000 − 8,888 =", "61,112"],
        ["50,002 − 19,999 =", "30,003"],
      ],
      mem: { th: "จำภาพว่า '0 ที่ถูกยืมจะแปลงร่างเป็น 9' เรียงกันไปจนถึงหลักที่มีเลขให้ยืมจริง", en: "Picture each borrowed 0 'transforming into a 9' in a row until you reach a real digit." },
      tip: { th: "ตรวจคำตอบด้วยการบวกกลับ: 32,517 + 27,486 ต้องได้ 60,003", en: "Check by adding back: 32,517 + 27,486 must equal 60,003." },
    },
    {
      h: { th: "เทคนิคอ่านโจทย์ปัญหา: หา 'คำสำคัญ'", en: "Trick: word problems — find the keyword" },
      p: [
        { th: "โจทย์ปัญหามักซ่อนคำที่บอกว่าต้อง 'บวก' หรือ 'ลบ' อ่านให้เจอคำสำคัญก่อนคำนวณ", en: "Word problems hide a keyword telling you to add or subtract — spot it before calculating." },
      ],
      k: [
        { th: "บวก: รวม ทั้งหมด เพิ่มขึ้น มากขึ้น ได้มาอีก", en: "Add: total, altogether, more, increased, gained" },
        { th: "ลบ: เหลือ หายไป ใช้ไป ต่างกัน มากกว่ากันเท่าไร", en: "Subtract: left, lost, spent, difference, how much more" },
      ],
      ex: [
        [{ th: "มีเงิน 8,000 ได้มาอีก 3,500 รวมมี", en: "Have 8,000, gain 3,500, total?" }, "11,500 (บวก)"],
        [{ th: "มีดินสอ 500 แจกไป 180 เหลือ", en: "500 pencils, give 180, left?" }, "320 (ลบ)"],
      ],
      mem: { th: "ขีดเส้นใต้คำสำคัญในโจทย์ทุกครั้งก่อนลงมือคิด", en: "Underline the keyword in every problem before you start." },
      tip: null,
    },
  ],
  science: [
    {
      h: { th: "เทคนิคจำ 5 ช่วงวัย", en: "Trick: remembering the 5 stages" },
      p: [
        { th: "ท่องลำดับวัยด้วยประโยคสั้น ๆ แล้วนึกภาพคน ๆ หนึ่งเติบโตจากทารกจนแก่", en: "Chant the order with a short phrase and picture one person growing from baby to elder." },
      ],
      k: [
        { th: "ทารก → เด็ก → รุ่น → ผู้ใหญ่ → ชรา (5 วัย เรียงตามอายุ)", en: "Infancy → Childhood → Adolescence → Adulthood → Elderly" },
        { th: "จุดสังเกตเร็ว: ทารก=กินนม | เด็ก=ฟันแท้ | รุ่น=puberty | ผู้ใหญ่=แข็งแรงสุด | ชรา=ผมหงอก", en: "Quick tags: infant=milk | child=adult teeth | teen=puberty | adult=strongest | elder=grey hair" },
      ],
      ex: [
        [{ th: "วัยที่ผมหงอก กระดูกเปราะ", en: "Stage with grey hair, fragile bones" }, "วัยชรา / Elderly"],
        [{ th: "วัยที่เริ่ม puberty", en: "Stage puberty begins" }, "วัยรุ่น / Adolescence"],
      ],
      mem: { th: "จำคำเดียวต่อวัย: นม–ฟัน–รุ่น–แรง–หงอก", en: "One word per stage: milk–teeth–puberty–strong–grey." },
      tip: { th: "ช่วงอายุเป็นค่าประมาณ ข้อสอบเน้น 'ลักษณะเด่น' มากกว่าตัวเลข", en: "Ages are approximate; exams test the key feature more than the number." },
    },
  ],
  health: [
    {
      h: { th: "เทคนิคจำปัจจัยการเติบโต 5 ข้อ", en: "Trick: remembering the 5 growth factors" },
      p: [
        { th: "ใช้คำย่อช่วยจำ: อา-ออก-พัก-พันธุ์-แวด (อาหาร ออกกำลังกาย พักผ่อน พันธุกรรม สิ่งแวดล้อม)", en: "Use a mnemonic for the five: nutrition, exercise, sleep, heredity, environment." },
      ],
      k: [
        { th: "3 ข้อที่เราควบคุมเองได้: อาหาร ออกกำลังกาย พักผ่อน", en: "3 we control: nutrition, exercise, sleep" },
        { th: "2 ข้อที่มาจากภายนอก/ติดตัว: พันธุกรรม สิ่งแวดล้อม", en: "2 from outside/inherited: heredity, environment" },
      ],
      ex: [
        [{ th: "ปัจจัยที่ทำให้ลูกหน้าเหมือนพ่อแม่", en: "Factor making children resemble parents" }, "พันธุกรรม / heredity"],
        [{ th: "ปัจจัยที่เราเลือกทำเองได้ 3 ข้อ", en: "3 factors we choose ourselves" }, "อาหาร ออกกำลังกาย พักผ่อน"],
      ],
      mem: { th: "ท่อง 'อา-ออก-พัก-พันธุ์-แวด' 5 พยางค์ = 5 ปัจจัย", en: "Chant the 5-syllable mnemonic = 5 factors." },
      tip: null,
    },
  ],
  thai: [
    {
      h: { th: "เทคนิคแยกอักษร 3 หมู่ด้วยประโยคช่วยจำ", en: "Trick: the 3 classes via memory phrases" },
      p: [
        { th: "จำพยัญชนะแต่ละหมู่ด้วยประโยคสั้น ๆ ที่ครูไทยใช้กันมานาน จำได้แม่นและเร็ว", en: "Memorise each class with the classic Thai mnemonic phrases — fast and reliable." },
      ],
      k: [
        { th: "กลาง (9): 'ไก่จิกเด็กตายบนปากโอ่ง' = ก จ ด(ฎ) ต(ฏ) บ ป อ", en: "Mid (9): mnemonic 'ไก่จิกเด็กตายบนปากโอ่ง'" },
        { th: "สูง (11): 'ผีฝากถุงข้าวสารให้ฉันเศรษฐี' = ผ ฝ ถ(ฐ) ข(ฃ) ส ศ ษ ห ฉ", en: "High (11): mnemonic 'ผีฝากถุงข้าวสาร…'" },
        { th: "ต่ำเดี่ยว (10): 'งูใหญ่นอนอยู่ ณ ริมวัดโมฬีโลก' = ง ญ น ย ณ ร ว ม ฬ ล", en: "Low-single (10): 'งูใหญ่นอนอยู่ ณ ริมวัดโมฬีโลก'" },
      ],
      ex: [
        [{ th: "'ป' อยู่หมู่ใด", en: "Which class is ป?" }, "กลาง (…ปากโอ่ง)"],
        [{ th: "'ผ' อยู่หมู่ใด", en: "Which class is ผ?" }, "สูง (ผีฝาก…)"],
      ],
      mem: { th: "ท่องประโยคช่วยจำวันละรอบ แล้วนึกว่าตัวอักษรที่เจออยู่ในประโยคไหน", en: "Recite the phrases daily, then match any letter to its phrase." },
      tip: { th: "หมู่ของพยัญชนะเป็นตัวกำหนดว่าคำนั้นผันได้กี่เสียง จึงต้องจำให้แม่น", en: "The class decides how many tones a word can take — so memorise it well." },
    },
    {
      h: { th: "เทคนิคหาเสียงวรรณยุกต์จริง (อักษรต่ำ)", en: "Trick: finding the true tone (low-class)" },
      p: [
        { th: "อักษรต่ำ 'รูปกับเสียงไม่ตรงกัน' เป็นจุดยากที่สุด ให้จำคู่ไม้เอก=โท / ไม้โท=ตรี", en: "Low-class words: the mark ≠ the tone — the hardest part. Learn: low mark = falling, falling mark = high." },
      ],
      k: [
        { th: "อักษรต่ำ + ไม้เอก (่) → เสียงโท เช่น ค่า ง่า พ่อ", en: "Low + low mark (่) → falling tone (ค่า, พ่อ)" },
        { th: "อักษรต่ำ + ไม้โท (้) → เสียงตรี เช่น ค้า ม้า น้ำ", en: "Low + falling mark (้) → high tone (ค้า, ม้า, น้ำ)" },
        { th: "อักษรต่ำ ไม่มีรูป → เสียงสามัญ เช่น คา มา นา", en: "Low, no mark → mid tone (คา, มา, นา)" },
      ],
      ex: [
        [{ th: "'พ่อ' เสียงวรรณยุกต์ใด", en: "'พ่อ' — which tone?" }, "โท (ต่ำ+ไม้เอก)"],
        [{ th: "'ม้า' เสียงวรรณยุกต์ใด", en: "'ม้า' — which tone?" }, "ตรี (ต่ำ+ไม้โท)"],
      ],
      mem: { th: "จำคาถา 'ต่ำ-เอก-โท, ต่ำ-โท-ตรี' (รูปเลื่อนขึ้นหนึ่งขั้นเสมอ)", en: "Chant 'low-lowmark-falling, low-fallingmark-high' (the tone shifts up one step)." },
      tip: { th: "อักษรกลาง/สูง รูปตรงกับเสียง แต่อักษรต่ำไม่ตรง — ระวังเฉพาะอักษรต่ำ", en: "Mid/high classes match; only low-class is offset — watch low-class especially." },
    },
  ],
  scith: [
    {
      h: { th: "เทคนิคเรียงวัฏจักรผีเสื้อ", en: "Trick: ordering the butterfly cycle" },
      p: [
        { th: "จำ 4 ระยะด้วยภาพต่อเนื่อง: ไข่เล็ก ๆ → หนอนคลาน → ดักแด้นิ่ง ๆ → ผีเสื้อบิน", en: "Remember 4 stages as a story: tiny egg → crawling caterpillar → still pupa → flying butterfly." },
      ],
      k: [
        { th: "ไข่ → หนอน → ดักแด้ → ตัวเต็มวัย (ผีเสื้อ)", en: "egg → larva → pupa → adult (butterfly)" },
        { th: "ระยะที่คนมักสลับคือ 'ดักแด้' ต้องมาก่อน 'ตัวเต็มวัย'", en: "The often-swapped pair: 'pupa' comes before 'adult'." },
      ],
      ex: [
        [{ th: "ระยะที่ 3 ของผีเสื้อ", en: "3rd stage of butterfly" }, "ดักแด้ / pupa"],
        [{ th: "สัตว์ที่มี 4 ระยะเหมือนผีเสื้อไหม: ไก่", en: "Does chicken have 4 stages like butterfly?" }, "ไม่ (ไก่มี 3 ระยะ)"],
      ],
      mem: { th: "ท่อง 'ไข่-หนอน-ดักแด้-โต' 4 คำเรียงกัน", en: "Chant 'egg-larva-pupa-adult'." },
      tip: null,
    },
  ],
  social: [
    {
      h: { th: "เทคนิคจำพุทธประวัติ 3 เหตุการณ์", en: "Trick: the Buddha's 3 key events" },
      p: [
        { th: "จำ 3 เหตุการณ์สำคัญพร้อมอายุและสถานที่ ทั้งหมดตรงกับวันวิสาขบูชา", en: "Learn the 3 events with age and place — all fall on Visakha Bucha." },
      ],
      k: [
        { th: "ประสูติ — สวนลุมพินีวัน", en: "Born — Lumbini garden" },
        { th: "ตรัสรู้ — 35 พรรษา ใต้ต้นศรีมหาโพธิ์ (ธรรม = อริยสัจ 4)", en: "Enlightened — age 35, under the Bodhi tree (Four Noble Truths)" },
        { th: "ปรินิพพาน — 80 พรรษา เมืองกุสินารา", en: "Passed away — age 80, Kusinara" },
      ],
      ex: [
        [{ th: "ตรัสรู้เมื่ออายุ / ปรินิพพานเมื่ออายุ", en: "Enlightened at / passed at" }, "35 / 80 พรรษา"],
        [{ th: "3 เหตุการณ์ตรงกับวันใด", en: "3 events fall on which day?" }, "วันวิสาขบูชา"],
      ],
      mem: { th: "จำเลขคู่ '35 ตรัสรู้, 80 ปรินิพพาน' — เลขน้อยมาก่อน", en: "Remember '35 enlightened, 80 passed' — smaller number first." },
      tip: { th: "ข้อสอบชอบสลับ 35 กับ 80 — ตรัสรู้ตัวเลขน้อยกว่าเสมอ", en: "Exams swap 35 and 80 — enlightenment is the smaller number." },
    },
  ],
  history: [
    {
      h: { th: "เทคนิคแปลงศักราชไม่ให้สับสน", en: "Trick: converting eras without confusion" },
      p: [
        { th: "กุญแจสำคัญ: ค.ศ. เป็นตัวเลข 'น้อยกว่า' พ.ศ. เสมอ 543 ปี ดังนั้นเวลาแปลงเป็น ค.ศ. ต้อง 'ลบ'", en: "Key idea: CE is always 543 LESS than BE, so converting to CE means subtracting." },
      ],
      k: [
        { th: "พ.ศ. → ค.ศ. : ลบ 543 (ผลน้อยลง)", en: "BE → CE: subtract 543 (result smaller)" },
        { th: "ค.ศ. → พ.ศ. : บวก 543 (ผลมากขึ้น)", en: "CE → BE: add 543 (result larger)" },
      ],
      ex: [
        ["พ.ศ. 2569 → ค.ศ.", "2569 − 543 = 2026"],
        ["ค.ศ. 2020 → พ.ศ.", "2020 + 543 = 2563"],
      ],
      mem: { th: "จำว่า 'พ.ศ. โตกว่า ค.ศ.' → ลดเป็น ค.ศ. ต้องลบ, เพิ่มเป็น พ.ศ. ต้องบวก", en: "'BE is bigger than CE' → to get CE subtract, to get BE add." },
      tip: { th: "ถ้าลืมทิศทาง ให้นึกปีปัจจุบัน: พ.ศ. 2569 = ค.ศ. 2026 (พ.ศ. ตัวเลขมากกว่า)", en: "If unsure, anchor on now: BE 2569 = CE 2026 (BE is the bigger number)." },
    },
  ],
  arts: [
    {
      h: { th: "เทคนิคจำค่าตัวโน้ต", en: "Trick: remembering note values" },
      p: [
        { th: "ค่าตัวโน้ตลดลง 'ทีละครึ่ง' ทุกขั้น จำเป็นบันไดลงจากตัวกลม", en: "Note values halve at each step — picture a staircase down from the whole note." },
      ],
      k: [
        { th: "ตัวกลม 4 → ตัวขาว 2 → ตัวดำ 1 → เขบ็ต 1 ชั้น ½", en: "Whole 4 → half 2 → quarter 1 → eighth ½" },
        { th: "แปลงกลับ: 1 ตัวกลม = 2 ขาว = 4 ดำ = 8 เขบ็ต", en: "Reverse: 1 whole = 2 halves = 4 quarters = 8 eighths" },
      ],
      ex: [
        [{ th: "ตัวกลม = ตัวดำกี่ตัว", en: "Whole = how many quarters?" }, "4 ตัว"],
        [{ th: "ตัวขาว = เขบ็ตกี่ตัว", en: "Half = how many eighths?" }, "4 ตัว"],
      ],
      mem: { th: "ท่อง '4-2-1-ครึ่ง' ไล่จากตัวใหญ่ไปเล็ก", en: "Chant '4-2-1-half' from big to small." },
      tip: { th: "เครื่องดนตรีจำ 3 กลุ่ม: สาย(ดีด/สี) เป่า(ลม) ตี(เคาะ)", en: "3 instrument groups: string, wind, percussion." },
    },
    {
      h: { th: "เทคนิคแยกรูปร่าง (2D) กับรูปทรง (3D)", en: "Trick: shape (2D) vs form (3D)" },
      p: [
        { th: "รูปร่างแบนเหมือนวาดบนกระดาษ ส่วนรูปทรงจับต้องได้มีความหนา ลองนึกของจริงเทียบกับภาพวาด", en: "A shape is flat like a drawing; a form is solid with depth. Compare a real object with its drawing." },
      ],
      k: [
        { th: "รูปร่าง 2 มิติ: วงกลม สามเหลี่ยม สี่เหลี่ยม (แบน)", en: "Shape (2D): circle, triangle, square (flat)" },
        { th: "รูปทรง 3 มิติ: ทรงกลม ทรงกระบอก ลูกบาศก์ (มีความหนา)", en: "Form (3D): sphere, cylinder, cube (has depth)" },
      ],
      ex: [
        [{ th: "ลูกบอลเป็นรูป___", en: "A ball is a ___" }, "ทรงกลม (3 มิติ)"],
        [{ th: "รูปวงกลมบนกระดาษเป็นรูป___", en: "A circle on paper is a ___" }, "รูปร่าง (2 มิติ)"],
      ],
      mem: { th: "จำ 'ร่าง=แบน (2), ทรง=หนา (3)'", en: "Remember 'shape=flat (2), form=fat (3)'." },
      tip: null,
    },
  ],
};

/* merge lesson expansion into base lessons */
Object.keys(LESSONS_MORE).forEach((id) => {
  if (LESSONS[id]) LESSONS[id] = LESSONS[id].concat(LESSONS_MORE[id]);
});

/* ================= EXPANSION PACK (v3) =================
   Additional MCQs and fill-ins appended to each subject to enlarge the bank.
   Same shape as existing items. Merged in at load time. */
const MORE = {
  english: {
    mcq: [
      { q: "Which is a colour?", c: ["desk", "purple", "library", "seven"], a: 1, ex: { th: "purple = สีม่วง", en: "purple is a colour" } },
      { q: "'Hi' is a word to…", c: [{ th: "ลาจาก", en: "say goodbye" }, { th: "ทักทาย", en: "greet" }, { th: "ขอบคุณ", en: "thank" }, { th: "ขอโทษ", en: "apologise" }], a: 1, ex: { th: "Hi = ทักทาย", en: "Hi is a greeting" } },
      { q: "There ___ four crayons.", c: ["is", "am", "are", "be"], a: 2, ex: { th: "four = พหูพจน์ → are", en: "plural → are" } },
      { q: "The cat is ___ the box. (ข้าง ๆ)", c: ["on", "in", "under", "next to"], a: 3, ex: { th: "ข้าง ๆ = next to", en: "next to = beside" } },
      { q: "I've got ___ apple.", c: ["a", "an", "some", "two a"], a: 1, ex: { th: "apple เสียงสระ → an", en: "vowel sound → an" } },
      { q: "Where do we eat lunch at school?", c: ["library", "canteen", "office", "playground"], a: 1, ex: { th: "canteen = โรงอาหาร", en: "canteen = where we eat" } },
      { q: "Plural of 'box' is…", c: ["boxs", "boxies", "boxes", "box"], a: 2, ex: { th: "ลงท้าย x เติม es", en: "-x → add -es" } },
      { q: "'orange' can be a colour and a…", c: [{ th: "สัตว์", en: "animal" }, { th: "ผลไม้", en: "fruit" }, { th: "รถ", en: "car" }, { th: "สี", en: "shape" }], a: 1, ex: { th: "orange เป็นผลไม้ด้วย", en: "orange is also a fruit" } },
      { q: "Do you like fish? — No, ___.", c: ["I don't", "I do", "I am", "I like"], a: 0, ex: { th: "ปฏิเสธ = No, I don't", en: "negative short answer" } },
      { q: "10 + 3 = ?", c: ["thirty", "thirteen", "thirty-three", "three"], a: 1, ex: { th: "13 = thirteen", en: "13 = thirteen" } },
      { q: "Which is a picnic food?", c: ["ruler", "sandwich", "board", "chair"], a: 1, ex: { th: "sandwich = อาหารปิกนิก", en: "sandwich is picnic food" } },
      { q: "'How are you?' — ___", c: ["My name is Sam", "I'm fine, thank you", "It's blue", "I'm seven"], a: 1, ex: { th: "ตอบความรู้สึก", en: "answer about feelings" } },
      { q: "We do sport in the ___.", c: ["library", "canteen", "gym", "office"], a: 2, ex: { th: "gym = โรงยิม", en: "gym for sport" } },
      { q: "There is ___ milk in the cup.", c: ["a", "an", "some", "many"], a: 2, ex: { th: "milk นับไม่ได้ → some", en: "milk uncountable → some" } },
      { q: "___ is your name?", c: ["Where", "What", "When", "Who"], a: 1, ex: { th: "ถามชื่อใช้ What", en: "What's your name?" } },
    ],
    fill: [
      { q: "The book is ___ the bag. (ใน)", a: ["in"] },
      { q: "สีดำ ภาษาอังกฤษคือ…", a: ["black"] },
      { q: "18 = e______ (ตัวอักษร)", a: ["eighteen"] },
      { q: "There ___ three pens. (is/are)", a: ["are"] },
      { q: "Plural of 'class' is cl____", a: ["classes"] },
      { q: "I want ___ cheese. (a/some)", a: ["some"] },
    ],
  },
  time: {
    mcq: [
      { q: "1:00 = ?", c: ["one o'clock", "half past one", "quarter to one", "quarter past one"], a: 0, ex: { th: ":00 = o'clock", en: ":00 = o'clock" } },
      { q: "5:30 = ?", c: ["half past five", "half past six", "quarter past five", "five o'clock"], a: 0, ex: { th: ":30 = half past", en: ":30 = half past" } },
      { q: "8:15 = ?", c: ["quarter to eight", "quarter past eight", "half past eight", "eight o'clock"], a: 1, ex: { th: ":15 = quarter past", en: ":15 = quarter past" } },
      { q: "10:45 = ?", c: ["quarter to ten", "quarter to eleven", "quarter past ten", "half past ten"], a: 1, ex: { th: "→ ชั่วโมงถัดไป = eleven", en: "next hour = eleven" } },
      { q: "'quarter to nine' = ?", c: ["9:15", "8:45", "9:45", "8:15"], a: 1, ex: { th: "อีก 15 นาทีถึง 9 = 8:45", en: "15 before 9 = 8:45" } },
      { q: "She ___ eats candy. (~10%)", c: ["always", "usually", "rarely", "often"], a: 2, ex: { th: "rarely = นาน ๆ ครั้ง", en: "rarely ≈ 10%" } },
      { q: "They ___ are happy. — ผิดตรงไหน?", c: [{ th: "ถูกแล้ว", en: "it's correct" }, { th: "always ต้องอยู่หลัง are", en: "adverb after 'are'" }, { th: "ต้องมี s", en: "needs -s" }, { th: "ต้องมี to", en: "needs 'to'" }], a: 1, ex: { th: "They are always happy.", en: "adverb goes after 'are'" } },
      { q: "12:30 = ?", c: ["half past twelve", "half past one", "quarter to twelve", "twelve o'clock"], a: 0, ex: { th: ":30 = half past twelve", en: ":30 = half past twelve" } },
      { q: "เข็มยาวชี้เลข 3 หมายถึง", c: ["o'clock", "quarter past", "half past", "quarter to"], a: 1, ex: { th: "ชี้ 3 = 15 นาที = quarter past", en: "on 3 = quarter past" } },
      { q: "never อยู่ระดับความถี่เท่าไร", c: ["100%", "50%", "10%", "0%"], a: 3, ex: { th: "never = ไม่เคยเลย 0%", en: "never = 0%" } },
      { q: "3:45 = ?", c: ["quarter to three", "quarter to four", "quarter past three", "half past three"], a: 1, ex: { th: "→ ชั่วโมงถัดไป = four", en: "next hour = four" } },
      { q: "We ___ brush our teeth. (100%)", c: ["never", "rarely", "always", "sometimes"], a: 2, ex: { th: "always = ทุกครั้ง", en: "always = 100%" } },
    ],
    fill: [
      { q: "2:30 = ___ past two", a: ["half"] },
      { q: "6:15 = quarter ___ six (past/to)", a: ["past"] },
      { q: "always = ___ % (ตัวเลข)", a: ["100"] },
      { q: "9:45 = quarter to ___ (ตัวเลขอังกฤษ)", a: ["ten"] },
      { q: "He is ___ tired. (0% = ไม่เคย)", a: ["never"] },
    ],
  },
  math: {
    mcq: [
      { q: "23,000 + 17,000 = ?", c: ["40,000", "30,000", "41,000", "39,000"], a: 0, ex: { th: "23+17 = 40 พัน", en: "23+17 = 40 thousands" } },
      { q: "56,000 − 6,000 = ?", c: ["50,000", "51,000", "49,000", "60,000"], a: 0, ex: { th: "ลบหลักพัน", en: "subtract thousands" } },
      { q: { th: "เลข 8 ใน 82,140 มีค่า", en: "Value of 8 in 82,140?" }, c: ["8,000", "800", "80,000", "8"], a: 2, ex: { th: "หลักหมื่น = 80,000", en: "ten-thousands = 80,000" } },
      { q: { th: "ข้อใดมากที่สุด", en: "Which is greatest?" }, c: ["71,900", "72,000", "71,990", "71,099"], a: 1, ex: { th: "72,000 มากสุด", en: "72,000 is largest" } },
      { q: "40,000 + 8,000 + 500 + 20 + 3 = ?", c: ["48,523", "40,853", "48,253", "40,523"], a: 0, ex: { th: "รวมแบบกระจาย = 48,523", en: "combine expanded form" } },
      { q: "99,000 + 1,000 = ?", c: ["99,100", "100,000", "90,100", "91,000"], a: 1, ex: { th: "= หนึ่งแสน", en: "= 100,000" } },
      { q: "75,320 − 25,320 = ?", c: ["50,000", "50,320", "40,000", "51,000"], a: 0, ex: { th: "ต่างกันเฉพาะหลักหมื่น", en: "difference in ten-thousands only" } },
      { q: { th: "หกหมื่นสามร้อย เขียนเป็น", en: "Write: sixty thousand three hundred" }, c: ["6,300", "60,300", "60,030", "63,000"], a: 1, ex: { th: "6 หมื่น + 3 ร้อย", en: "60,000 + 300" } },
      { q: "12,345 + 54,321 = ?", c: ["66,666", "66,660", "65,666", "76,666"], a: 0, ex: { th: "บวกไม่มีทด = 66,666", en: "no carrying = 66,666" } },
      { q: "30,000 − 15,600 = ?", c: ["14,400", "15,400", "14,600", "24,400"], a: 0, ex: { th: "ยืมข้ามศูนย์", en: "borrow across zeros" } },
      { q: { th: "จำนวนที่อยู่ระหว่าง 45,000 กับ 46,000", en: "A number between 45,000 and 46,000" }, c: ["44,500", "45,500", "46,500", "47,000"], a: 1, ex: { th: "45,500 อยู่ระหว่าง", en: "45,500 is in between" } },
      { q: "10,000 × ? = 50,000", c: ["3", "4", "5", "6"], a: 2, ex: { th: "10,000 × 5 = 50,000", en: "10,000 × 5 = 50,000" } },
      { q: { th: "โจทย์: มีส้ม 3,450 ผล ขายไป 1,200 เหลือ", en: "3,450 oranges, sell 1,200, left?" }, c: ["2,250", "2,150", "2,350", "4,650"], a: 0, ex: { th: "3,450 − 1,200 = 2,250", en: "3,450 − 1,200 = 2,250" } },
      { q: { th: "48,215 ปัดเป็นหลักพันได้", en: "Round 48,215 to nearest thousand" }, c: ["48,000", "49,000", "48,200", "50,000"], a: 0, ex: { th: "215 < 500 ปัดลง = 48,000", en: "215<500 → round down" } },
    ],
    fill: [
      { q: "26,000 + 4,000 = ?", a: ["30000", "30,000"] },
      { q: "60,000 − 20,000 = ?", a: ["40000", "40,000"] },
      { q: { th: "เลข 3 ใน 43,000 มีค่า", en: "Value of 3 in 43,000" }, a: ["3000", "3,000"] },
      { q: "49,999 + 1 = ?", a: ["50000", "50,000"] },
      { q: "88,000 − 8,000 = ?", a: ["80000", "80,000"] },
      { q: "5,000 + 500 + 50 + 5 = ?", a: ["5555", "5,555"] },
    ],
  },
  science: {
    mcq: [
      { q: { th: "วัยเด็กโตประมาณปีละกี่ ซม.", en: "Children grow about how many cm/year?" }, c: ["1–2", "4–5", "10–12", "20"], a: 1, ex: { th: "ราวปีละ 4–5 ซม.", en: "about 4–5 cm a year" } },
      { q: { th: "ฟันน้ำนมเริ่มขึ้นตอนอายุประมาณ", en: "Baby teeth start at about…" }, c: [{ th: "6 เดือน", en: "6 months" }, { th: "6 ปี", en: "6 years" }, { th: "2 ปี", en: "2 years" }, { th: "แรกเกิด", en: "at birth" }], a: 0, ex: { th: "ราว 6 เดือน", en: "around 6 months" } },
      { q: { th: "วัยใดเรียนอ่านและเขียน", en: "Which stage learns to read & write?" }, c: [{ th: "ทารก", en: "Infancy" }, { th: "เด็ก", en: "Childhood" }, { th: "ชรา", en: "Elderly" }, { th: "ผู้ใหญ่", en: "Adulthood" }], a: 1, ex: { th: "วัยเด็ก 2–12 ปี", en: "childhood 2–12" } },
      { q: { th: "ข้อใดไม่ใช่การเปลี่ยนแปลงในวัยรุ่น", en: "NOT a puberty change?" }, c: [{ th: "สูงขึ้นเร็ว", en: "growing fast" }, { th: "ผมหงอก", en: "hair turns grey" }, { th: "เสียงเปลี่ยน", en: "voice changes" }, { th: "อารมณ์แปรปรวน", en: "mood swings" }], a: 1, ex: { th: "ผมหงอกคือวัยชรา", en: "grey hair is elderly" } },
      { q: { th: "ผู้สูงอายุควรได้รับ", en: "Elderly people should get…" }, c: [{ th: "การดูแลและกำลังใจ", en: "care and support" }, { th: "การล้อเลียน", en: "teasing" }, { th: "การทอดทิ้ง", en: "neglect" }, { th: "งานหนัก", en: "hard labour" }], a: 0, ex: { th: "ช่วยเหลือด้วยความเคารพ", en: "help with respect" } },
      { q: { th: "การเจริญเติบโตของแต่ละคน", en: "Each person's growth is…" }, c: [{ th: "เท่ากันทุกคน", en: "the same for all" }, { th: "ช้า-เร็วต่างกัน เป็นเรื่องปกติ", en: "different pace, and normal" }, { th: "ผิดปกติ", en: "abnormal" }, { th: "หยุดตอน 10 ขวบ", en: "stops at age 10" }], a: 1, ex: { th: "แต่ละคนไม่เท่ากัน ปกติ", en: "everyone differs; normal" } },
      { q: { th: "สิ่งใดช่วยให้วัยรุ่นเติบโตแข็งแรง", en: "What helps teens grow strong?" }, c: [{ th: "อดอาหาร", en: "skipping meals" }, { th: "กินดี ออกกำลังกาย นอนพอ", en: "good food, exercise, sleep" }, { th: "นอนดึกทุกวัน", en: "staying up late" }, { th: "ไม่ออกกำลังกาย", en: "no exercise" }], a: 1, ex: { th: "ปัจจัยการเติบโตที่ดี", en: "healthy growth habits" } },
      { q: { th: "ลูกอ่อนของมนุษย์อยู่ในวัย", en: "A human baby is in which stage?" }, c: ["Infancy", "Childhood", "Adulthood", "Elderly"], a: 0, ex: { th: "วัยทารก", en: "infancy" } },
    ],
    fill: [
      { q: { th: "มนุษย์มีทั้งหมดกี่ช่วงวัย (ตัวเลข)", en: "How many human life stages? (number)" }, a: ["5", "ห้า"] },
      { q: { th: "วัยผู้ใหญ่คือช่วงอายุ 20–__ ปี", en: "Adulthood is ages 20–__" }, a: ["60"] },
      { q: { th: "การเปลี่ยนแปลงในวัยรุ่นเกิดจาก h______ (อังกฤษ)", en: "Puberty is caused by h______" }, a: ["hormones", "hormone"] },
      { q: { th: "เด็กหญิงเริ่มมีป_________ ในวัยรุ่น", en: "Girls begin m________ in puberty" }, a: ["ประจำเดือน", "menstruation"] },
    ],
  },
  health: {
    mcq: [
      { q: { th: "อาหารหมู่ที่ให้พลังงานหลักคือ", en: "Which food group gives main energy?" }, c: [{ th: "ข้าว-แป้ง", en: "rice/carbohydrates" }, { th: "ผลไม้", en: "fruit" }, { th: "น้ำ", en: "water" }, { th: "เกลือ", en: "salt" }], a: 0, ex: { th: "ข้าว แป้ง ให้พลังงาน", en: "carbs give energy" } },
      { q: { th: "ควรนอนวันละประมาณกี่ชั่วโมง (เด็ก)", en: "Children should sleep about… hours/day" }, c: ["3–4", "5–6", "9–11", "15"], a: 2, ex: { th: "เด็กควรนอน ~9–11 ชม.", en: "kids ~9–11 hrs" } },
      { q: { th: "ปู่ ย่า ตา ยาย เป็นสมาชิก", en: "Grandparents are part of the…" }, c: [{ th: "โรงเรียน", en: "school" }, { th: "ครอบครัว", en: "family" }, { th: "ทีมกีฬา", en: "sports team" }, { th: "ร้านค้า", en: "shop" }], a: 1, ex: { th: "เป็นสมาชิกครอบครัว", en: "part of the family" } },
      { q: { th: "เพื่อนล้ม ควรทำอย่างไร", en: "A friend falls down. You should…" }, c: [{ th: "หัวเราะ", en: "laugh" }, { th: "ช่วยพยุงและถาม", en: "help them up and ask" }, { th: "วิ่งหนี", en: "run away" }, { th: "ถ่ายรูป", en: "take a photo" }], a: 1, ex: { th: "มีน้ำใจช่วยเหลือ", en: "kindness = help" } },
      { q: { th: "'grandfather' แปลว่า", en: "'grandfather' means…" }, c: [{ th: "พ่อ", en: "father" }, { th: "ปู่/ตา", en: "grandpa" }, { th: "พี่ชาย", en: "brother" }, { th: "ลุง", en: "uncle" }], a: 1, ex: { th: "ปู่หรือตา", en: "grandpa" } },
      { q: { th: "การกินผักและผลไม้ช่วย", en: "Eating fruit & vegetables helps…" }, c: [{ th: "ให้วิตามินและแข็งแรง", en: "give vitamins, stay healthy" }, { th: "ทำให้ป่วย", en: "make you sick" }, { th: "ตัวเตี้ย", en: "get shorter" }, { th: "ไม่มีผล", en: "nothing" }], a: 0, ex: { th: "ผัก-ผลไม้มีวิตามิน", en: "they give vitamins" } },
      { q: { th: "สิ่งใดทำให้เติบโตช้า", en: "What can slow growth?" }, c: [{ th: "นอนพอ", en: "enough sleep" }, { th: "กินครบ 5 หมู่", en: "balanced meals" }, { th: "อดอาหาร-นอนน้อย", en: "skipping food, little sleep" }, { th: "ออกกำลังกาย", en: "exercise" }], a: 2, ex: { th: "พฤติกรรมไม่ดีขัดขวางการโต", en: "poor habits hinder growth" } },
    ],
    fill: [
      { q: { th: "กินให้ครบ __ หมู่ (ตัวเลข)", en: "Eat all __ food groups" }, a: ["5", "ห้า"] },
      { q: { th: "เพื่อนที่ดีต้องมีความ ซ_______ (ไม่โกหก)", en: "A good friend is h______ (not lying)" }, a: ["ซื่อสัตย์", "honest", "honesty"] },
      { q: { th: "'mother' แปลว่า", en: "'mother' = ?" }, a: ["แม่", "คุณแม่"] },
      { q: { th: "ดื่มน้ำวันละหลาย ๆ แ__ว ดีต่อสุขภาพ", en: "Drink many ___ of water daily" }, a: ["แก้ว", "glasses"] },
    ],
  },
  thai: {
    mcq: [
      { q: "\"ด\" เป็นอักษรหมู่ใด", c: ["สูง", "กลาง", "ต่ำ", "พิเศษ"], a: 1, ex: { th: "เด็ก = อักษรกลาง", en: "ด is mid-class" } },
      { q: "\"ห\" เป็นอักษรหมู่ใด", c: ["สูง", "กลาง", "ต่ำ", "ควบ"], a: 0, ex: { th: "…ให้ฉัน = อักษรสูง", en: "ห is high-class" } },
      { q: "\"ง\" เป็นอักษรหมู่ใด", c: ["สูง", "กลาง", "ต่ำ", "เดี่ยว"], a: 2, ex: { th: "งูใหญ่… = อักษรต่ำเดี่ยว", en: "ง is low-class" } },
      { q: "อักษรกลางผันได้กี่เสียง", c: ["3", "4", "5", "2"], a: 2, ex: { th: "ครบ 5 เสียง", en: "all 5 tones" } },
      { q: "\"มาก\" อยู่มาตราใด", c: ["แม่กก", "แม่กด", "แม่กน", "แม่กบ"], a: 0, ex: { th: "ก = แม่กก", en: "ends /k/" } },
      { q: "\"จับ\" อยู่มาตราใด", c: ["แม่กก", "แม่กด", "แม่กบ", "แม่กน"], a: 2, ex: { th: "บ = แม่กบ", en: "ends /b/" } },
      { q: "\"ฝน\" อยู่มาตราใด", c: ["แม่กน", "แม่กก", "แม่กด", "แม่กบ"], a: 0, ex: { th: "น = แม่กน", en: "ends /n/" } },
      { q: "\"มด\" อยู่มาตราใด", c: ["แม่กก", "แม่กด", "แม่กน", "แม่กบ"], a: 1, ex: { th: "ด = แม่กด", en: "ends /d/" } },
      { q: "\"ครูสอนหนังสือ\" คำใดเป็นคำนาม", c: ["สอน", "ครู", "หนัง", "หนังสือ"], a: 1, ex: { th: "ครู, หนังสือ เป็นนาม; ครูคือประธาน", en: "ครู is the subject noun" } },
      { q: "\"วิ่งเร็ว\" คำใดเป็นกริยา", c: ["วิ่ง", "เร็ว", "ทั้งสอง", "ไม่มี"], a: 0, ex: { th: "วิ่ง = กริยา, เร็ว = วิเศษณ์", en: "วิ่ง is the verb" } },
      { q: "ประโยค \"อย่าเดินลัดสนาม\" เป็นชนิดใด", c: ["บอกเล่า", "คำถาม", "คำสั่ง-ห้าม", "ขอร้อง"], a: 2, ex: { th: "'อย่า' = ห้าม/คำสั่ง", en: "'don't' = command" } },
      { q: "\"เรา\" เป็นสรรพนามบุรุษที่เท่าไร", c: ["ที่ 1", "ที่ 2", "ที่ 3", "ไม่ใช่"], a: 0, ex: { th: "ผู้พูด (รวมกลุ่ม) = บุรุษ 1", en: "'we' = 1st person" } },
      { q: "อักษรต่ำผันได้กี่เสียง", c: ["5", "4", "3", "2"], a: 2, ex: { th: "สามัญ โท ตรี", en: "3 tones" } },
      { q: "\"ค้า\" (ไม้โท) ออกเสียงวรรณยุกต์ใด", c: ["โท", "ตรี", "เอก", "จัตวา"], a: 1, ex: { th: "อักษรต่ำ ไม้โท = เสียงตรี!", en: "low-class + falling mark = high tone" } },
      { q: "\"โต๊ะ\" เป็นคำชนิดใด", c: ["นาม", "สรรพนาม", "กริยา", "วิเศษณ์"], a: 0, ex: { th: "ชื่อสิ่งของ = นาม", en: "a thing = noun" } },
    ],
    fill: [
      { q: "\"สุข\" อยู่มาตราตัวสะกดใด (แม่ก_)", a: ["กก", "แม่กก"] },
      { q: "\"บ้าน\" อยู่มาตราใด (แม่ก_)", a: ["กน", "แม่กน"] },
      { q: "อักษรกลางผันได้กี่เสียง (ตัวเลข)", a: ["5", "ห้า"] },
      { q: "คำที่แสดงอาการ เช่น กิน วิ่ง เรียกคำ___", a: ["กริยา", "คำกริยา"] },
      { q: "\"ฉัน เธอ เขา\" เป็นสรรพนาม แทนคำ___", a: ["นาม", "คำนาม"] },
      { q: "วรรณยุกต์มี 4 รูป แต่มีกี่เสียง (ตัวเลข)", a: ["5", "ห้า"] },
    ],
  },
  scith: {
    mcq: [
      { q: "วัฏจักรกบเริ่มจาก", c: ["ลูกอ๊อด", "ไข่", "กบ", "ดักแด้"], a: 1, ex: { th: "ไข่ → ลูกอ๊อด → กบ", en: "starts with egg" } },
      { q: "สัตว์ใดมี 4 ระยะในวัฏจักร", c: ["ไก่", "ผีเสื้อ", "แมว", "โลมา"], a: 1, ex: { th: "ผีเสื้อ 4 ระยะ", en: "butterfly = 4 stages" } },
      { q: "หนอนจะกลายเป็น", c: ["ไข่", "ดักแด้", "ลูกอ๊อด", "ลูกไก่"], a: 1, ex: { th: "หนอน → ดักแด้", en: "larva → pupa" } },
      { q: "ข้อใดเป็นสัตว์ออกลูกเป็นตัว", c: ["ไก่", "เป็ด", "แมว", "นก"], a: 2, ex: { th: "แมวออกลูกเป็นตัว", en: "cats are live-bearers" } },
      { q: "สิ่งมีชีวิตขาดสิ่งใดไม่ได้", c: ["ของเล่น", "โทรทัศน์", "อาหารและน้ำ", "รถยนต์"], a: 2, ex: { th: "อาหาร น้ำ จำเป็น", en: "food & water essential" } },
      { q: "ลูกไก่ออกมาจาก", c: ["ดักแด้", "ไข่", "ลูกอ๊อด", "หนอน"], a: 1, ex: { th: "ไก่ออกลูกเป็นไข่", en: "chicks hatch from eggs" } },
      { q: "ที่อยู่อาศัยของปลาคือ", c: ["บนต้นไม้", "ในน้ำ", "ในถ้ำ", "บนฟ้า"], a: 1, ex: { th: "ปลาอยู่ในน้ำ", en: "fish live in water" } },
      { q: "วัฏจักรชีวิตหมายถึงการเปลี่ยนแปลงแบบ", c: ["ครั้งเดียวจบ", "หมุนเวียนเป็นวงจร", "ถอยหลัง", "ไม่เปลี่ยน"], a: 1, ex: { th: "วนซ้ำต่อเนื่อง", en: "a repeating loop" } },
      { q: "ระยะสุดท้ายของผีเสื้อคือ", c: ["ไข่", "ดักแด้", "ตัวเต็มวัย", "หนอน"], a: 2, ex: { th: "ตัวเต็มวัย (ผีเสื้อ)", en: "adult butterfly" } },
    ],
    fill: [
      { q: "วัฏจักรผีเสื้อมีกี่ระยะ (ตัวเลข)", a: ["4", "สี่"] },
      { q: "ลูกของกบตอนเล็กเรียกว่า ลูก___", a: ["อ๊อด", "ลูกอ๊อด"] },
      { q: "สิ่งมีชีวิตต้องการ อาหาร น้ำ อากาศ และที่___", a: ["อยู่อาศัย", "อยู่"] },
      { q: "ไก่ออกลูกเป็น___", a: ["ไข่"] },
    ],
  },
  social: {
    mcq: [
      { q: "วันพ่อแห่งชาติตรงกับ", c: ["5 ธ.ค.", "12 ส.ค.", "1 ม.ค.", "6 เม.ย."], a: 0, ex: { th: "5 ธันวาคม", en: "5 December" } },
      { q: "ประเพณีสงกรานต์เป็นประเพณีของ", c: ["จีน", "ไทย", "ญี่ปุ่น", "อินเดีย"], a: 1, ex: { th: "ปีใหม่ไทย", en: "Thai New Year" } },
      { q: "ในห้องเรียนควรตัดสินด้วยวิธีใด", c: ["เสียงข้างมาก", "คนตัวโตสั่ง", "จับสลากเท่านั้น", "ครูสั่งอย่างเดียว"], a: 0, ex: { th: "ประชาธิปไตย = เสียงข้างมาก", en: "majority vote" } },
      { q: "พระพุทธเจ้าประสูติที่", c: ["กุสินารา", "ลุมพินีวัน", "พุทธคยา", "สาวัตถี"], a: 1, ex: { th: "สวนลุมพินีวัน", en: "Lumbini garden" } },
      { q: "อริยสัจข้อแรกคือ", c: ["ทุกข์", "สมุทัย", "นิโรธ", "มรรค"], a: 0, ex: { th: "ทุกข์ สมุทัย นิโรธ มรรค", en: "suffering is first" } },
      { q: "การไหว้ผู้ใหญ่แสดงถึง", c: ["ความกลัว", "ความเคารพ", "ความโกรธ", "การล้อเล่น"], a: 1, ex: { th: "มารยาทไทย = เคารพ", en: "respect" } },
      { q: "ลอยกระทงทำเพื่อ", c: ["ขอขมาพระแม่คงคา", "ขอฝน", "เฉลิมฉลองปีใหม่", "ไหว้พระจันทร์"], a: 0, ex: { th: "ขอขมาน้ำ", en: "thank the water" } },
      { q: "การเลือกหัวหน้าห้องคือประชาธิปไตยแบบ", c: ["ทางตรง", "เลือกตัวแทน", "จับสลาก", "สืบทอด"], a: 1, ex: { th: "เลือกตัวแทน", en: "representative" } },
      { q: "พระพุทธเจ้าปรินิพพานที่เมือง", c: ["กุสินารา", "ลุมพินี", "พาราณสี", "ราชคฤห์"], a: 0, ex: { th: "กุสินารา", en: "Kusinara" } },
      { q: "วันจักรีตรงกับ", c: ["6 เม.ย.", "13 เม.ย.", "23 ต.ค.", "5 ธ.ค."], a: 0, ex: { th: "6 เมษายน", en: "6 April" } },
    ],
    fill: [
      { q: "พระพุทธเจ้าตรัสรู้เมื่อพระชนมายุ __ พรรษา", a: ["35", "สามสิบห้า"] },
      { q: "วันแม่ตรงกับวันที่ __ สิงหาคม (ตัวเลข)", a: ["12", "สิบสอง"] },
      { q: "ประเพณีเดือน 12 ที่ลอยกระทงลงน้ำคือ ล______", a: ["ลอยกระทง"] },
      { q: "หลักประชาธิปไตย: เคารพเสียงส่วน___", a: ["น้อย", "ส่วนน้อย"] },
      { q: "อริยสัจมีทั้งหมดกี่ข้อ (ตัวเลข)", a: ["4", "สี่"] },
    ],
  },
  history: {
    mcq: [
      { q: "พ.ศ. 2568 = ค.ศ.", c: ["2024", "2025", "2026", "2027"], a: 1, ex: { th: "2568 − 543 = 2025", en: "2568 − 543 = 2025" } },
      { q: "ค.ศ. 2015 = พ.ศ.", c: ["2556", "2557", "2558", "2559"], a: 2, ex: { th: "2015 + 543 = 2558", en: "2015 + 543 = 2558" } },
      { q: "พ.ศ. มากกว่า ค.ศ. อยู่กี่ปี", c: ["500", "543", "544", "600"], a: 1, ex: { th: "543 ปี", en: "543 years" } },
      { q: "เหตุการณ์ พ.ศ. 2540 เกิดก่อนหรือหลัง พ.ศ. 2560", c: ["ก่อน", "หลัง", "พร้อมกัน", "บอกไม่ได้"], a: 0, ex: { th: "ปีน้อยกว่า = ก่อน", en: "smaller = earlier" } },
      { q: "แหล่งข้อมูลชนิดใดเป็น 'ภาพ'", c: ["คำบอกเล่า", "ภาพถ่ายเก่า", "เพลง", "กลิ่น"], a: 1, ex: { th: "ภาพถ่าย = หลักฐานภาพ", en: "old photo = visual source" } },
      { q: "ค.ศ. 1997 = พ.ศ.", c: ["2530", "2540", "2550", "2560"], a: 1, ex: { th: "1997 + 543 = 2540", en: "1997 + 543 = 2540" } },
      { q: "เส้นเวลาเรียงจาก", c: ["ปัจจุบัน→อดีต", "อดีต→ปัจจุบัน", "สุ่ม", "ใหญ่→เล็ก"], a: 1, ex: { th: "อดีตไปปัจจุบัน", en: "past → present" } },
      { q: "พ.ศ. 2600 = ค.ศ.", c: ["2057", "2157", "2043", "1057"], a: 0, ex: { th: "2600 − 543 = 2057", en: "2600 − 543 = 2057" } },
    ],
    fill: [
      { q: "พ.ศ. 2566 = ค.ศ. ? (ตัวเลข)", a: ["2023"] },
      { q: "ค.ศ. 2005 = พ.ศ. ? (ตัวเลข)", a: ["2548"] },
      { q: "แปลง พ.ศ. เป็น ค.ศ. ให้ลบด้วย ___ (ตัวเลข)", a: ["543"] },
      { q: "เครื่องมือเรียงเหตุการณ์ตามเวลาคือ เส้น___", a: ["เวลา", "เส้นเวลา"] },
    ],
  },
  arts: {
    mcq: [
      { q: "เขบ็ต 1 ชั้น = ครึ่งของโน้ตตัวใด", c: ["ตัวกลม", "ตัวขาว", "ตัวดำ", "ตัวหยุด"], a: 2, ex: { th: "ดำ 1 → เขบ็ต ½", en: "half of a quarter note" } },
      { q: "โน้ตตัวกลม = เขบ็ต 1 ชั้นกี่ตัว", c: ["4", "6", "8", "2"], a: 2, ex: { th: "4 ÷ ½ = 8 ตัว", en: "4 beats ÷ ½ = 8" } },
      { q: "เปียโนจัดเป็นเครื่องดนตรีที่เล่นโดย", c: ["เป่า", "ดีด/กด", "สี", "ตี"], a: 1, ex: { th: "กดคีย์ (จัดกลุ่มคีย์บอร์ด)", en: "keyboard, pressed keys" } },
      { q: "สามเหลี่ยม (รูป) เป็นรูปร่างแบบ", c: ["ธรรมชาติ", "เรขาคณิต", "อิสระ", "3 มิติ"], a: 1, ex: { th: "รูปเรขาคณิต", en: "geometric shape" } },
      { q: "ลูกโป่งเป็นรูปทรงแบบ", c: ["2 มิติ", "3 มิติ", "แบน", "เส้น"], a: 1, ex: { th: "มีความหนา = 3 มิติ", en: "has depth = 3D" } },
      { q: "ทัศนธาตุข้อใดคือ 'พื้นผิว'", c: [{ th: "ความหยาบ-เรียบของผิว", en: "rough/smooth surface" }, { th: "เสียง", en: "sound" }, { th: "กลิ่น", en: "smell" }, { th: "จังหวะ", en: "rhythm" }], a: 0, ex: { th: "texture = พื้นผิว", en: "texture" } },
      { q: "งานบ้านขั้นตอนที่ 2 คือ", c: ["วางแผน", "ลงมือทำ", "ประเมินผล", "พัก"], a: 1, ex: { th: "วางแผน → ลงมือทำ → ประเมิน", en: "plan → DO → evaluate" } },
      { q: "ระนาดเล่นโดยการ", c: ["เป่า", "ดีด", "ตี", "สี"], a: 2, ex: { th: "ใช้ไม้ตี = เครื่องตี", en: "struck = percussion" } },
      { q: "ตัวดำ 4 ตัว = โน้ตตัวใด 1 ตัว", c: ["ตัวขาว", "ตัวกลม", "เขบ็ต", "ตัวหยุด"], a: 1, ex: { th: "4 จังหวะ = ตัวกลม", en: "4 beats = whole note" } },
    ],
    fill: [
      { q: "โน้ตตัวขาวยาวกี่จังหวะ (ตัวเลข)", a: ["2", "สอง"] },
      { q: "กีตาร์เป็นเครื่องดนตรีประเภทเครื่อง___", a: ["สาย", "เครื่องสาย"] },
      { q: "รูปทรงมีกี่มิติ (ตัวเลข)", a: ["3", "สาม"] },
      { q: "ขั้นตอนสุดท้ายของการทำงานคือการประเมิน___", a: ["ผล"] },
      { q: "เมฆ ควัน เป็นรูปร่างแบบ___ (อิสระ/เรขาคณิต)", a: ["อิสระ"] },
    ],
  },
};

/* merge expansion pack into base subjects */
SUBJECTS.forEach((s) => {
  const extra = MORE[s.id];
  if (extra) {
    if (extra.mcq) s.mcq = s.mcq.concat(extra.mcq);
    if (extra.fill) s.fill = s.fill.concat(extra.fill);
    if (extra.match) s.match = s.match.concat(extra.match);
    if (extra.flash) s.flash = s.flash.concat(extra.flash);
  }
});

/* ================= EXPANSION PACK 2 (v4) ================= */
const MORE2 = {
  english: {
    mcq: [
      { q: "Which is a wild animal word we might learn?", c: ["chair", "tiger", "ruler", "juice"], a: 1, ex: { th: "tiger = เสือ", en: "tiger is an animal" } },
      { q: "She has ___ orange bag.", c: ["a", "an", "some", "two"], a: 1, ex: { th: "orange ขึ้นต้นเสียงสระ → an", en: "vowel sound → an" } },
      { q: "The books are ___ the shelf. (บน)", c: ["in", "on", "under", "next"], a: 1, ex: { th: "บน = on", en: "on = on top" } },
      { q: "'grandmother' in Thai is…", c: [{ th: "พ่อ", en: "father" }, { th: "ย่า/ยาย", en: "grandma" }, { th: "พี่", en: "sibling" }, { th: "ครู", en: "teacher" }], a: 1, ex: { th: "grandmother = ย่า/ยาย", en: "grandmother" } },
      { q: "We keep books in the ___.", c: ["gym", "canteen", "library", "toilet"], a: 2, ex: { th: "library = ห้องสมุด", en: "library" } },
      { q: "Choose the correct plural: two ___", c: ["boxs", "boxes", "box", "boxies"], a: 1, ex: { th: "box → boxes", en: "box → boxes" } },
      { q: "I ___ got a red pen.", c: ["has", "have", "is", "are"], a: 1, ex: { th: "I + have got", en: "I → have" } },
      { q: "There ___ some cheese on the plate.", c: ["is", "are", "am", "be"], a: 0, ex: { th: "cheese นับไม่ได้ → is", en: "uncountable → is" } },
    ],
    fill: [
      { q: "16 = s______ (ตัวอักษร)", a: ["sixteen"] },
      { q: "The dog is ___ the table. (ใต้)", a: ["under"] },
      { q: "I don't ___ tomatoes. (ชอบ)", a: ["like"] },
    ],
  },
  time: {
    mcq: [
      { q: "7:30 = ?", c: ["half past seven", "half past six", "quarter to seven", "seven o'clock"], a: 0, ex: { th: ":30 = half past", en: ":30 = half past" } },
      { q: "3:15 = ?", c: ["quarter to three", "quarter past three", "half past three", "three o'clock"], a: 1, ex: { th: ":15 = quarter past", en: ":15 = quarter past" } },
      { q: "11:00 = ?", c: ["eleven o'clock", "half past eleven", "quarter to eleven", "quarter past eleven"], a: 0, ex: { th: ":00 = o'clock", en: ":00 = o'clock" } },
      { q: "I ___ am hungry in class. (~50%)", c: ["always", "never", "sometimes", "usually"], a: 2, ex: { th: "sometimes ~50%", en: "sometimes ≈ 50%" } },
      { q: "2:45 = ?", c: ["quarter to two", "quarter to three", "quarter past two", "half past two"], a: 1, ex: { th: "→ ชั่วโมงถัดไป three", en: "next hour three" } },
      { q: "adverb ที่แปลว่า 'ไม่เคย' คือ", c: ["always", "often", "never", "usually"], a: 2, ex: { th: "never = ไม่เคย", en: "never" } },
    ],
    fill: [
      { q: "8:00 = eight o'____", a: ["clock"] },
      { q: "usually บ่อยกว่า sometimes จริงหรือไม่ (ใช่/ไม่)", a: ["ใช่", "yes", "จริง"] },
      { q: "1:15 = quarter ___ one", a: ["past"] },
    ],
  },
  math: {
    mcq: [
      { q: "14,000 + 6,500 = ?", c: ["20,500", "21,500", "20,050", "19,500"], a: 0, ex: { th: "14,000+6,500=20,500", en: "20,500" } },
      { q: "38,400 − 8,400 = ?", c: ["30,000", "30,400", "29,000", "31,000"], a: 0, ex: { th: "ต่างกันเฉพาะพัน/ร้อย", en: "difference in thousands" } },
      { q: { th: "เลข 9 ใน 90,120 มีค่า", en: "Value of 9 in 90,120?" }, c: ["9,000", "90,000", "900", "9"], a: 1, ex: { th: "หลักหมื่น = 90,000", en: "ten-thousands" } },
      { q: "40,000 − 25,500 = ?", c: ["14,500", "15,500", "14,000", "24,500"], a: 0, ex: { th: "ยืมข้ามศูนย์", en: "borrow across zeros" } },
      { q: { th: "จำนวนคู่ที่มากที่สุดที่น้อยกว่า 50 คือ", en: "Largest even number below 50" }, c: ["48", "49", "50", "46"], a: 0, ex: { th: "48 เป็นเลขคู่", en: "48 is even" } },
      { q: "25,000 + 25,000 + 25,000 = ?", c: ["50,000", "75,000", "100,000", "65,000"], a: 1, ex: { th: "25,000 × 3 = 75,000", en: "25,000 × 3" } },
      { q: { th: "โจทย์: มีสมุด 2,400 เล่ม แจกห้องละ 60 ได้กี่ห้อง", en: "2,400 books, 60 per room. How many rooms?" }, c: ["40", "30", "50", "24"], a: 0, ex: { th: "2,400 ÷ 60 = 40", en: "2,400 ÷ 60 = 40" } },
      { q: "63,158 ปัดเป็นหลักพันได้", c: ["63,000", "64,000", "63,200", "60,000"], a: 0, ex: { th: "158<500 ปัดลง", en: "round down" } },
    ],
    fill: [
      { q: "15,000 + 15,000 = ?", a: ["30000", "30,000"] },
      { q: "40,000 − 10,000 = ?", a: ["30000", "30,000"] },
      { q: { th: "เลข 2 ใน 24,000 มีค่า", en: "Value of 2 in 24,000" }, a: ["20000", "20,000"] },
    ],
  },
  science: {
    mcq: [
      { q: { th: "วัยใดฟันน้ำนมขึ้นครบ", en: "Which stage has full baby teeth?" }, c: [{ th: "วัยทารก", en: "Infancy" }, { th: "วัยผู้ใหญ่", en: "Adulthood" }, { th: "วัยชรา", en: "Elderly" }, { th: "วัยรุ่น", en: "Adolescence" }], a: 0, ex: { th: "ทารกฟันน้ำนมขึ้น", en: "baby teeth in infancy" } },
      { q: { th: "ผู้ใหญ่วัยทำงานอยู่ช่วงอายุ", en: "Working adults are aged…" }, c: ["0–2", "2–12", "20–60", "60+"], a: 2, ex: { th: "20–60 ปี", en: "20–60" } },
      { q: { th: "ข้อใดคือการเปลี่ยนแปลงทางร่างกายในวัยรุ่น", en: "A physical change in puberty is…" }, c: [{ th: "สูงขึ้นเร็ว", en: "growing taller fast" }, { th: "ผมหงอก", en: "grey hair" }, { th: "ฟันน้ำนมขึ้น", en: "baby teeth" }, { th: "หัดเดิน", en: "learning to walk" }], a: 0, ex: { th: "วัยรุ่นสูงเร็ว", en: "teens grow fast" } },
      { q: { th: "การดูแลผู้สูงอายุที่ดีคือ", en: "Good care for the elderly is…" }, c: [{ th: "พาไปตรวจสุขภาพ ช่วยเหลือ", en: "help & health checks" }, { th: "ปล่อยอยู่คนเดียว", en: "leave alone" }, { th: "ให้ทำงานหนัก", en: "hard work" }, { th: "ไม่สนใจ", en: "ignore" }], a: 0, ex: { th: "ดูแลด้วยความเคารพ", en: "care with respect" } },
    ],
    fill: [
      { q: { th: "วัยทารกอายุ 0–__ ปี (ตัวเลข)", en: "Infancy 0–__ yrs" }, a: ["2", "สอง"] },
      { q: { th: "วัยเด็กอายุ 2–__ ปี (ตัวเลข)", en: "Childhood 2–__ yrs" }, a: ["12", "สิบสอง"] },
    ],
  },
  health: {
    mcq: [
      { q: { th: "ควรกินผักผลไม้เพราะ", en: "We eat fruit & veg because…" }, c: [{ th: "มีวิตามิน", en: "they have vitamins" }, { th: "ทำให้อ้วน", en: "make us fat" }, { th: "ไม่มีประโยชน์", en: "useless" }, { th: "ทำให้ป่วย", en: "make us sick" }], a: 0, ex: { th: "วิตามินช่วยร่างกาย", en: "vitamins help the body" } },
      { q: { th: "การล้างมือก่อนกินข้าวช่วย", en: "Washing hands before eating…" }, c: [{ th: "ป้องกันเชื้อโรค", en: "prevents germs" }, { th: "ทำให้หิว", en: "makes us hungry" }, { th: "ไม่จำเป็น", en: "unnecessary" }, { th: "เสียเวลา", en: "wastes time" }], a: 0, ex: { th: "สุขอนามัยที่ดี", en: "good hygiene" } },
      { q: { th: "'father' คือใคร", en: "Who is 'father'?" }, c: [{ th: "พ่อ", en: "dad" }, { th: "แม่", en: "mum" }, { th: "พี่", en: "sibling" }, { th: "ปู่", en: "grandpa" }], a: 0, ex: { th: "father = พ่อ", en: "father = dad" } },
    ],
    fill: [
      { q: { th: "นอนหลับพักผ่อนช่วยให้ร่างกาย เ______ (โต)", en: "Sleep helps the body g____" }, a: ["เติบโต", "grow"] },
      { q: { th: "ล้าง___ก่อนกินข้าวทุกครั้ง", en: "Wash your ___ before eating" }, a: ["มือ", "hands"] },
    ],
  },
  thai: {
    mcq: [
      { q: "\"ต\" อยู่อักษรหมู่ใด", c: ["สูง", "กลาง", "ต่ำ", "ควบ"], a: 1, ex: { th: "…เด็ก 'ตาย' = อักษรกลาง", en: "ต is mid-class" } },
      { q: "\"ส\" อยู่อักษรหมู่ใด", c: ["สูง", "กลาง", "ต่ำ", "เดี่ยว"], a: 0, ex: { th: "…ข้าว'สาร' = อักษรสูง", en: "ส is high-class" } },
      { q: "\"ม\" อยู่อักษรหมู่ใด", c: ["สูง", "กลาง", "ต่ำ", "พิเศษ"], a: 2, ex: { th: "…วัด'โมฬี'โลก = ต่ำเดี่ยว", en: "ม is low-class" } },
      { q: "\"สุข\" อยู่มาตราใด", c: ["แม่กก", "แม่กด", "แม่กน", "แม่กบ"], a: 0, ex: { th: "ข เสียง /ก/ = แม่กก", en: "ends /k/" } },
      { q: "\"บาป\" อยู่มาตราใด", c: ["แม่กบ", "แม่กด", "แม่กก", "แม่กน"], a: 0, ex: { th: "ป = แม่กบ", en: "ends /b/" } },
      { q: "\"คน\" อยู่มาตราใด", c: ["แม่กน", "แม่กด", "แม่กก", "แม่กบ"], a: 0, ex: { th: "น = แม่กน", en: "ends /n/" } },
      { q: "\"เด็กวิ่งเล่น\" คำใดเป็นคำนาม", c: ["วิ่ง", "เล่น", "เด็ก", "ไม่มี"], a: 2, ex: { th: "เด็ก = คำนาม (ประธาน)", en: "เด็ก = noun" } },
      { q: "\"ปิดไฟด้วยครับ\" เป็นประโยคชนิดใด", c: ["บอกเล่า", "คำถาม", "ขอร้อง", "ปฏิเสธ"], a: 2, ex: { th: "'ด้วยครับ' = ขอร้อง", en: "polite request" } },
    ],
    fill: [
      { q: "\"มด\" อยู่มาตราตัวสะกดใด (แม่ก_)", a: ["กด", "แม่กด"] },
      { q: "อักษรสูงผันได้กี่เสียง (ตัวเลข)", a: ["3", "สาม"] },
      { q: "\"เขา เธอ ฉัน\" เป็นคำ___ (ชนิดคำ)", a: ["สรรพนาม", "คำสรรพนาม"] },
    ],
  },
  scith: {
    mcq: [
      { q: "ผีเสื้อระยะแรกสุดคือ", c: ["หนอน", "ไข่", "ดักแด้", "ตัวเต็มวัย"], a: 1, ex: { th: "เริ่มจากไข่", en: "starts with egg" } },
      { q: "สัตว์ใดออกลูกเป็นไข่", c: ["สุนัข", "เต่า", "แมว", "โลมา"], a: 1, ex: { th: "เต่าวางไข่", en: "turtles lay eggs" } },
      { q: "ลูกอ๊อดจะกลายเป็น", c: ["ปลา", "กบ", "เขียด", "งู"], a: 1, ex: { th: "ลูกอ๊อด → กบ", en: "tadpole → frog" } },
      { q: "สิ่งจำเป็นต่อการมีชีวิตข้อใดใช้หายใจ", c: ["อาหาร", "อากาศ", "ที่อยู่", "แสง"], a: 1, ex: { th: "อากาศใช้หายใจ", en: "air to breathe" } },
      { q: "วัฏจักรชีวิตของไก่เริ่มจาก", c: ["ลูกไก่", "ไข่", "ไก่โต", "ขน"], a: 1, ex: { th: "ไข่ → ลูกไก่ → ไก่", en: "egg first" } },
    ],
    fill: [
      { q: "ผีเสื้อระยะที่ 4 (สุดท้าย) คือ ตัว___", a: ["เต็มวัย", "ตัวเต็มวัย"] },
      { q: "กบวางไข่ใน___", a: ["น้ำ"] },
    ],
  },
  social: {
    mcq: [
      { q: "ประเพณีปีใหม่ไทยคือ", c: ["ลอยกระทง", "สงกรานต์", "เข้าพรรษา", "ตรุษจีน"], a: 1, ex: { th: "สงกรานต์ = ปีใหม่ไทย", en: "Songkran" } },
      { q: "วันสำคัญที่ประสูติ ตรัสรู้ ปรินิพพาน ตรงกันคือ", c: ["มาฆบูชา", "วิสาขบูชา", "อาสาฬหบูชา", "เข้าพรรษา"], a: 1, ex: { th: "วิสาขบูชา", en: "Visakha Bucha" } },
      { q: "การเคารพเสียงส่วนน้อยเป็นหลักของ", c: ["เผด็จการ", "ประชาธิปไตย", "การแข่งขัน", "การค้า"], a: 1, ex: { th: "ประชาธิปไตย", en: "democracy" } },
      { q: "อริยสัจข้อ 'มรรค' หมายถึง", c: [{ th: "ความทุกข์", en: "suffering" }, { th: "ทางดับทุกข์", en: "path to end suffering" }, { th: "เหตุแห่งทุกข์", en: "cause" }, { th: "ความดับทุกข์", en: "cessation" }], a: 1, ex: { th: "มรรค = ทางปฏิบัติ", en: "the path" } },
      { q: "พระพุทธเจ้าตรัสรู้ใต้ต้นไม้ชื่อ", c: ["ต้นโพธิ์", "ต้นสัก", "ต้นไทร", "ต้นมะม่วง"], a: 0, ex: { th: "ต้นศรีมหาโพธิ์", en: "the Bodhi tree" } },
    ],
    fill: [
      { q: "วันพ่อตรงกับวันที่ __ ธันวาคม (ตัวเลข)", a: ["5", "ห้า"] },
      { q: "พระพุทธเจ้าปรินิพพานเมื่อพระชนมายุ __ พรรษา", a: ["80", "แปดสิบ"] },
    ],
  },
  history: {
    mcq: [
      { q: "พ.ศ. 2567 = ค.ศ.", c: ["2023", "2024", "2025", "2026"], a: 1, ex: { th: "2567 − 543 = 2024", en: "2024" } },
      { q: "ค.ศ. 2018 = พ.ศ.", c: ["2559", "2560", "2561", "2562"], a: 2, ex: { th: "2018 + 543 = 2561", en: "2561" } },
      { q: "เหตุการณ์ พ.ศ. 2500 กับ 2560 อันไหนเก่ากว่า", c: ["2500", "2560", "เท่ากัน", "บอกไม่ได้"], a: 0, ex: { th: "ปีน้อยกว่าเก่ากว่า", en: "smaller = older" } },
      { q: "ค.ศ. 2000 = พ.ศ.", c: ["2542", "2543", "2544", "2540"], a: 1, ex: { th: "2000 + 543 = 2543", en: "2543" } },
    ],
    fill: [
      { q: "พ.ศ. 2565 = ค.ศ. ? (ตัวเลข)", a: ["2022"] },
      { q: "ค.ศ. 2024 = พ.ศ. ? (ตัวเลข)", a: ["2567"] },
    ],
  },
  arts: {
    mcq: [
      { q: "โน้ตตัวดำ 2 ตัว = โน้ตตัวใด 1 ตัว", c: ["ตัวกลม", "ตัวขาว", "เขบ็ต", "ตัวหยุด"], a: 1, ex: { th: "2 จังหวะ = ตัวขาว", en: "2 beats = half note" } },
      { q: "ขลุ่ยเล่นโดยการ", c: ["ตี", "ดีด", "เป่า", "สี"], a: 2, ex: { th: "เป่าลม = เครื่องเป่า", en: "wind instrument" } },
      { q: "ลูกบาศก์ (กล่อง) เป็นรูป", c: ["ร่าง 2 มิติ", "ทรง 3 มิติ", "เส้น", "จุด"], a: 1, ex: { th: "มีความหนา = 3 มิติ", en: "3D form" } },
      { q: "จุด เส้น สี เป็นส่วนหนึ่งของ", c: ["ทัศนธาตุ", "ดนตรี", "กีฬา", "คณิต"], a: 0, ex: { th: "ทัศนธาตุ", en: "visual elements" } },
      { q: "ขั้นตอนการทำงานที่ถูกต้องคือ", c: ["ทำเลย→วางแผน", "วางแผน→ทำ→ประเมิน", "ประเมิน→ทำ", "ทำ→ทิ้ง"], a: 1, ex: { th: "วางแผนก่อนเสมอ", en: "plan first" } },
    ],
    fill: [
      { q: "โน้ตตัวกลมยาวกี่จังหวะ (ตัวเลข)", a: ["4", "สี่"] },
      { q: "เครื่องดนตรีที่มีสายเรียกเครื่อง___", a: ["สาย", "เครื่องสาย"] },
    ],
  },
};

/* merge expansion pack 2 into base subjects */
SUBJECTS.forEach((s) => {
  const extra = MORE2[s.id];
  if (extra) {
    if (extra.mcq) s.mcq = s.mcq.concat(extra.mcq);
    if (extra.fill) s.fill = s.fill.concat(extra.fill);
  }
});

/* ============ TERM 1 — SECOND HALF LESSONS (standard curriculum) ============ */
const LESSONS_T1B = {
  english: [
    {
      h: { th: "ครอบครัว & ร่างกาย (Family & Body)", en: "Family & Body" },
      p: [
        { th: "ครึ่งหลังของเทอมเพิ่มคำศัพท์ครอบครัว อวัยวะร่างกาย และการบอกว่าทำอะไรได้ (can)", en: "The second half adds family words, body parts, and saying what you can do (can)." },
      ],
      k: [
        { th: "Family: father, mother, brother, sister, baby, grandfather, grandmother", en: "Family: father, mother, brother, sister, baby, grandparents" },
        { th: "Body: head, hair, eye, ear, nose, mouth, hand, arm, leg, foot (feet)", en: "Body: head, hair, eye, ear, nose, mouth, hand, arm, leg, foot (feet)" },
        { th: "can / can't บอกความสามารถ: I can swim. / I can't fly.", en: "can / can't for ability: I can swim. / I can't fly." },
        { th: "This is my … (นี่คือ…ของฉัน) เช่น This is my sister.", en: "This is my … e.g. This is my sister." },
      ],
      ex: [
        [{ th: "พหูพจน์ของ foot", en: "Plural of foot" }, "feet"],
        [{ th: "I ___ swim. (ว่ายน้ำได้)", en: "I ___ swim. (able to)" }, "can"],
      ],
      mem: { th: "จำ 'can = ทำได้', 'can't = ทำไม่ได้' ตามด้วยกริยาช่องที่ 1 เสมอ", en: "can = able, can't = not able, always followed by the base verb." },
      tip: { th: "foot → feet, tooth → teeth เป็นพหูพจน์พิเศษ ไม่เติม s", en: "foot→feet, tooth→teeth are irregular plurals (no -s)." },
    },
    {
      h: { th: "สัตว์ & Present Continuous (กำลังทำ)", en: "Animals & Present Continuous" },
      p: [
        { th: "คำศัพท์สัตว์ และการบอกสิ่งที่ 'กำลังทำอยู่ตอนนี้' ด้วย am/is/are + กริยา-ing", en: "Animal words and saying what is happening now with am/is/are + verb-ing." },
      ],
      k: [
        { th: "Animals: dog, cat, bird, fish, rabbit, monkey, elephant, lion", en: "Animals: dog, cat, bird, fish, rabbit, monkey, elephant, lion" },
        { th: "I am running. / She is eating. / They are playing.", en: "I am running. / She is eating. / They are playing." },
        { th: "am (I) / is (he,she,it) / are (you,we,they)", en: "am (I) / is (he,she,it) / are (you,we,they)" },
      ],
      ex: [
        [{ th: "She ___ eating. (is/are)", en: "She ___ eating." }, "is"],
        [{ th: "run + ing =", en: "run + ing =" }, "running (ซ้ำ n)"],
      ],
      mem: { th: "สูตร: ประธาน + (am/is/are) + กริยาเติม -ing", en: "Formula: subject + (am/is/are) + verb-ing." },
      tip: { th: "คำลงท้ายพยัญชนะเดี่ยว+สระสั้น ให้ซ้ำตัวสุดท้าย: run→running, swim→swimming", en: "Short-vowel + single consonant → double it: run→running, swim→swimming." },
    },
  ],
  time: [
    {
      h: { th: "วันในสัปดาห์ & เดือน (Days & Months)", en: "Days & Months" },
      p: [
        { th: "เพิ่มการบอกวันและเดือนเป็นภาษาอังกฤษ และถาม-ตอบว่าวันนี้วันอะไร", en: "Adds days and months in English, and asking what day it is." },
      ],
      k: [
        { th: "Days: Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday", en: "Days: Sunday–Saturday" },
        { th: "Months: January, February, March … December (12 เดือน)", en: "Months: January … December (12 months)" },
        { th: "What day is it today? — It's Monday.", en: "What day is it today? — It's Monday." },
        { th: "เลขลำดับ: first, second, third, fourth, fifth …", en: "Ordinals: first, second, third, fourth, fifth …" },
      ],
      ex: [
        [{ th: "วันหลัง Monday คือ", en: "The day after Monday" }, "Tuesday"],
        [{ th: "เดือนแรกของปี", en: "First month of the year" }, "January"],
      ],
      mem: { th: "1 สัปดาห์มี 7 วัน / 1 ปีมี 12 เดือน — ท่องเรียงให้คล่อง", en: "7 days a week, 12 months a year — recite them in order." },
      tip: { th: "วันและเดือนในภาษาอังกฤษขึ้นต้นด้วยตัวพิมพ์ใหญ่เสมอ (Monday, June)", en: "Days and months are always capitalised (Monday, June)." },
    },
  ],
  math: [
    {
      h: { th: "การคูณ (Multiplication)", en: "Multiplication" },
      p: [
        { th: "การคูณคือการบวกซ้ำ ๆ เช่น 4 × 3 = 4 + 4 + 4 = 12 ต้องท่องสูตรคูณให้คล่อง", en: "Multiplication is repeated addition: 4 × 3 = 4 + 4 + 4 = 12. Learn the times tables well." },
      ],
      k: [
        { th: "สูตรคูณแม่ 2–9 ควรท่องได้ เช่น 7 × 8 = 56, 6 × 9 = 54", en: "Memorise tables 2–9, e.g. 7 × 8 = 56, 6 × 9 = 54" },
        { th: "คูณจำนวนหลายหลักกับ 1 หลัก: 123 × 3 = 369 (คูณทีละหลักจากขวา)", en: "Multi-digit × 1-digit: 123 × 3 = 369 (multiply each place right→left)" },
        { th: "การคูณมีการทด เช่น 27 × 4 = 108 (7×4=28 ใส่ 8 ทด 2)", en: "Carrying: 27 × 4 = 108" },
        { th: "อะไรคูณ 0 ได้ 0 เสมอ / อะไรคูณ 1 ได้ตัวเดิม", en: "Anything × 0 = 0; anything × 1 = itself" },
      ],
      ex: [
        ["7 × 8 =", "56"],
        ["123 × 3 =", "369"],
        ["25 × 4 =", "100"],
      ],
      mem: { th: "คูณ = บวกตัวเดิมซ้ำหลาย ๆ ครั้ง นึกภาพของเป็นกลุ่ม ๆ", en: "Multiply = add the same number several times; picture equal groups." },
      tip: { th: "ท่องสูตรคูณแม่ 6, 7, 8 ให้แม่นเป็นพิเศษ เพราะออกสอบและใช้ต่อยอดการหาร", en: "Master the 6, 7, 8 tables — they're tested most and needed for division." },
    },
    {
      h: { th: "การหาร (Division) & แบบรูป (Patterns)", en: "Division & Patterns" },
      p: [
        { th: "การหารคือการแบ่งเป็นกลุ่มเท่า ๆ กัน เป็นตัวผกผันของการคูณ และแบบรูปคือชุดที่เพิ่ม/ลดอย่างมีกฎ", en: "Division shares into equal groups (the opposite of multiplication). Patterns increase or decrease by a rule." },
      ],
      k: [
        { th: "56 ÷ 7 = 8 เพราะ 7 × 8 = 56 (ใช้สูตรคูณช่วยหาร)", en: "56 ÷ 7 = 8 because 7 × 8 = 56 (use tables to divide)" },
        { th: "แบ่งเท่า ๆ กัน: ลูกอม 12 เม็ด แบ่งให้ 3 คน = คนละ 4 เม็ด", en: "Equal sharing: 12 sweets ÷ 3 = 4 each" },
        { th: "แบบรูปเพิ่มทีละเท่า: 5, 10, 15, 20, … (เพิ่มทีละ 5)", en: "Pattern +5: 5, 10, 15, 20, …" },
        { th: "แบบรูปลด: 30, 27, 24, 21, … (ลดทีละ 3)", en: "Pattern −3: 30, 27, 24, 21, …" },
      ],
      ex: [
        ["81 ÷ 9 =", "9"],
        [{ th: "2, 4, 6, 8, __ (เพิ่มทีละ 2)", en: "2, 4, 6, 8, __" }, "10"],
        [{ th: "ลูกอม 20 เม็ด แบ่ง 4 คน คนละ", en: "20 sweets ÷ 4 =" }, "5 เม็ด"],
      ],
      mem: { th: "หารไม่ออกให้ถามตัวเอง 'ตัวหารคูณอะไรได้ตัวตั้ง' เช่น 56÷7 → 7 คูณอะไรได้ 56", en: "To divide, ask 'the divisor times what equals this?' 56÷7 → 7 × ? = 56." },
      tip: { th: "การคูณกับการหารเป็นคู่กัน จำสูตรคูณแม่นแล้วหารง่ายขึ้นมาก", en: "Multiplication and division are pairs — strong tables make division easy." },
    },
  ],
  science: [
    {
      h: { th: "ส่วนต่าง ๆ ของพืชและหน้าที่ (Parts of a plant)", en: "Parts of a plant" },
      p: [
        { th: "พืชมีส่วนประกอบสำคัญที่ทำหน้าที่ต่างกัน ช่วยให้พืชมีชีวิตและเติบโต", en: "A plant has parts with different jobs that keep it alive and help it grow." },
      ],
      k: [
        { th: "ราก (roots): ดูดน้ำและแร่ธาตุ + ยึดลำต้นไว้กับดิน", en: "Roots: absorb water & minerals, anchor the plant" },
        { th: "ลำต้น (stem): ลำเลียงน้ำ-อาหาร และค้ำจุนต้น", en: "Stem: transports water/food, supports the plant" },
        { th: "ใบ (leaf): สร้างอาหารด้วยแสง (สังเคราะห์ด้วยแสง)", en: "Leaf: makes food using sunlight (photosynthesis)" },
        { th: "ดอก (flower): ใช้สืบพันธุ์ | ผล (fruit): ห่อหุ้มเมล็ด", en: "Flower: reproduction | Fruit: protects the seeds" },
      ],
      ex: [
        [{ th: "ส่วนที่ดูดน้ำจากดินคือ", en: "Part that absorbs water" }, "ราก / roots"],
        [{ th: "ใบมีหน้าที่", en: "The leaf's job is to" }, "สร้างอาหาร (สังเคราะห์แสง)"],
      ],
      mem: { th: "ท่องล่างขึ้นบน: ราก–ลำต้น–ใบ–ดอก–ผล", en: "Bottom to top: root–stem–leaf–flower–fruit." },
      tip: { th: "อย่าสับสน: 'ราก' ดูดน้ำ ส่วน 'ใบ' สร้างอาหาร — เป็นคนละหน้าที่", en: "Don't mix up: roots absorb water; leaves make food." },
    },
    {
      h: { th: "ปัจจัยที่พืชต้องการเพื่อเติบโต", en: "What plants need to grow" },
      p: [
        { th: "พืชต้องการปัจจัยหลายอย่างจึงจะเจริญเติบโต ถ้าขาดอย่างใดอย่างหนึ่งจะโตไม่ดี", en: "Plants need several things to grow well; missing any one harms growth." },
      ],
      k: [
        { th: "4 อย่างหลัก: น้ำ แสงแดด อากาศ และธาตุอาหารในดิน", en: "Four needs: water, sunlight, air, nutrients in the soil" },
        { th: "แสงแดดใช้สร้างอาหารที่ใบ | น้ำช่วยลำเลียงและเติบโต", en: "Sunlight for making food; water for transport and growth" },
      ],
      ex: [
        [{ th: "พืชขาดแสงจะเป็นอย่างไร", en: "A plant with no light will…" }, "โตไม่ดี/ใบซีด"],
        [{ th: "ปัจจัยพืช 4 อย่างคือ", en: "The 4 plant needs are" }, "น้ำ แสง อากาศ ธาตุอาหาร"],
      ],
      mem: { th: "ท่อง 'น้ำ-แสง-อากาศ-อาหาร' 4 อย่างเหมือนคนแต่พืชได้แสงเพิ่ม", en: "Chant 'water-light-air-nutrients'." },
      tip: null,
    },
  ],
  health: [
    {
      h: { th: "อวัยวะภายในและหน้าที่ (Internal organs)", en: "Internal organs" },
      p: [
        { th: "ร่างกายมีอวัยวะภายในที่ทำงานร่วมกัน แต่ละอวัยวะมีหน้าที่สำคัญ ต้องดูแลรักษา", en: "The body has internal organs that work together; each has an important job and needs care." },
      ],
      k: [
        { th: "หัวใจ (heart): สูบฉีดเลือดไปเลี้ยงร่างกาย", en: "Heart: pumps blood around the body" },
        { th: "ปอด (lungs): หายใจเอาออกซิเจนเข้า-คาร์บอนไดออกไซด์ออก", en: "Lungs: breathe in oxygen, out carbon dioxide" },
        { th: "กระเพาะอาหาร + ลำไส้: ย่อยและดูดซึมอาหาร", en: "Stomach + intestines: digest and absorb food" },
        { th: "ไต (kidneys): กรองของเสียออกเป็นปัสสาวะ | สมอง (brain): ควบคุมร่างกายและความคิด", en: "Kidneys: filter waste (urine) | Brain: controls body & thinking" },
      ],
      ex: [
        [{ th: "อวัยวะที่สูบฉีดเลือดคือ", en: "Organ that pumps blood" }, "หัวใจ / heart"],
        [{ th: "อวัยวะที่ใช้หายใจคือ", en: "Organ used for breathing" }, "ปอด / lungs"],
      ],
      mem: { th: "จับคู่ง่าย ๆ: หัวใจ-เลือด, ปอด-หายใจ, ไต-ของเสีย, สมอง-สั่งการ", en: "Pair them: heart-blood, lungs-breathe, kidneys-waste, brain-control." },
      tip: { th: "ดูแลอวัยวะ: กินอาหารดี ออกกำลังกาย นอนพอ ไม่สูบบุหรี่", en: "Care for organs: eat well, exercise, sleep enough, avoid smoke." },
    },
  ],
  thai: [
    {
      h: { th: "คำควบกล้ำ (ควบแท้ / ควบไม่แท้)", en: "Consonant clusters (true / false)" },
      p: [
        { th: "คำควบกล้ำคือคำที่มีพยัญชนะต้น 2 ตัวควบกับสระเดียวกัน มีทั้งควบแท้ (ออกเสียงทั้งคู่) และควบไม่แท้", en: "A cluster has two lead consonants blended with one vowel: true clusters sound both letters; false ones don't." },
      ],
      k: [
        { th: "ควบแท้ ออกเสียงทั้ง 2 ตัว: กร ข ร คร ตร ปร พร กล คล ปล กว คว (เช่น ครู กลอง ขวา)", en: "True clusters sound both letters: e.g. ครู, กลอง, ขวา" },
        { th: "ควบไม่แท้ ออกเสียงตัวเดียว: จริง (อ่าน จิง), สร้าง (ส่าง), เศร้า", en: "False clusters sound one letter: จริง→จิง, สร้าง→ส่าง" },
        { th: "ทร มักออกเสียงเป็น ซ: ทราย (ซาย), ทรง (ซง)", en: "'ทร' often sounds like ซ: ทราย→ซาย" },
      ],
      ex: [
        [{ th: "\"จริง\" อ่านว่า", en: "Read \"จริง\"" }, "จิง (ควบไม่แท้)"],
        [{ th: "\"ทราย\" อ่านว่า", en: "Read \"ทราย\"" }, "ซาย"],
        [{ th: "\"ครู\" เป็นคำควบชนิดใด", en: "\"ครู\" is which type?" }, "ควบแท้"],
      ],
      mem: { th: "จำคำควบไม่แท้ที่พบบ่อย: จริง สร้าง เศร้า ทราย ทรง ไซร้ (นอกนั้นมักควบแท้)", en: "Memorise common false clusters: จริง สร้าง เศร้า ทราย ทรง." },
      tip: { th: "ควบไม่แท้ 'ร' มักหายไปตอนอ่าน (สร้าง=ส่าง) ส่วน 'ทร'=เสียง ซ", en: "In false clusters the 'ร' drops (สร้าง=ส่าง); 'ทร' = ซ sound." },
    },
    {
      h: { th: "อักษรนำ & สระลดรูป-เปลี่ยนรูป", en: "Leading consonants & vowel changes" },
      p: [
        { th: "อักษรนำคือมีพยัญชนะ 2 ตัวแต่ 'ตัวหน้า' นำเสียงตัวหลัง | บางสระเปลี่ยนรูปหรือลดรูปเมื่อมีตัวสะกด", en: "A leading consonant makes the following letter follow its tone; some vowels change or drop their shape with a final consonant." },
      ],
      k: [
        { th: "ห นำ: หมา หนู หญิง หลาย (ห ไม่ออกเสียง แต่ทำให้เสียงสูง)", en: "ห leads: หมา, หนู, หญิง (ห silent, raises the tone)" },
        { th: "อ นำ ย 4 คำ: อย่า อยู่ อย่าง อยาก", en: "อ leads ย in 4 words: อย่า อยู่ อย่าง อยาก" },
        { th: "อักษรสูง/กลางนำต่ำเดี่ยว: ขนม ถนน สนาม (ออกเสียงตามตัวนำ)", en: "High/mid leads a low: ขนม, ถนน, สนาม" },
        { th: "สระเปลี่ยนรูป: เกะ→เก็บ (สระเอะ), แขะ→แข็ง | สระลดรูป: โต๊ะ→ต้น (โอะลดรูป)", en: "Vowels change/drop shape with a final consonant." },
      ],
      ex: [
        [{ th: "\"หมา\" ตัวใดไม่ออกเสียง", en: "Which letter is silent in หมา?" }, "ห (อักษรนำ)"],
        [{ th: "อ นำ ย มีกี่คำ", en: "How many 'อ leads ย' words?" }, "4 คำ (อย่า อยู่ อย่าง อยาก)"],
      ],
      mem: { th: "ท่อง 4 คำ อ นำ ย: 'อย่าอยู่อย่างที่อยาก'", en: "Chant the 4 words: อย่า-อยู่-อย่าง-อยาก." },
      tip: { th: "ห นำ ทำให้คำออกเสียงสูงขึ้น แม้ ห จะไม่ออกเสียงเอง", en: "The leading ห raises the tone even though it's silent." },
    },
  ],
  scith: [
    {
      h: { th: "การเจริญเติบโตของพืช (หลังสอบครั้งที่ 1)", en: "Plant growth (after mid-term)" },
      p: [
        { th: "พืชเริ่มจากเมล็ด งอกเป็นต้นอ่อน แล้วเติบโตเป็นต้นโตที่มีดอกและผล เป็นวัฏจักร", en: "Plants start from a seed, sprout into a seedling, then grow into a mature plant with flowers and fruit — a cycle." },
      ],
      k: [
        { th: "วัฏจักรพืช: เมล็ด → ต้นอ่อน → ต้นโต → ออกดอก → ติดผล → เมล็ดใหม่", en: "Plant cycle: seed → seedling → mature plant → flower → fruit → new seed" },
        { th: "เมล็ดงอกต้องการ น้ำ อากาศ และอุณหภูมิที่เหมาะสม", en: "Seeds need water, air, and the right warmth to sprout" },
        { th: "พืชโตต้องการ น้ำ แสงแดด อากาศ ธาตุอาหารในดิน", en: "Growing plants need water, sunlight, air, soil nutrients" },
      ],
      ex: [
        [{ th: "พืชเริ่มต้นชีวิตจาก", en: "A plant's life begins from" }, "เมล็ด / a seed"],
        [{ th: "หลังต้นอ่อนคือระยะใด", en: "After the seedling stage comes…" }, "ต้นโต"],
      ],
      mem: { th: "ท่อง 'เมล็ด-ต้นอ่อน-ต้นโต-ดอก-ผล' เหมือนวัฏจักรสัตว์แต่เป็นพืช", en: "Chant 'seed-seedling-plant-flower-fruit'." },
      tip: { th: "เทียบกับวัฏจักรสัตว์: ทั้งพืชและสัตว์ 'เกิด-โต-สืบพันธุ์-เกิดรุ่นใหม่' เหมือนกัน", en: "Like animals, plants also grow, reproduce, and make a new generation." },
    },
  ],
  social: [
    {
      h: { th: "เศรษฐศาสตร์เบื้องต้น: สินค้า-บริการ", en: "Basic economics: goods & services" },
      p: [
        { th: "ในชีวิตประจำวันเราเกี่ยวข้องกับการซื้อขาย มีทั้งสินค้าและบริการ และควรรู้จักใช้จ่าย-ออม", en: "Daily life involves buying and selling — both goods and services — and knowing how to spend and save." },
      ],
      k: [
        { th: "สินค้า = สิ่งของจับต้องได้ (ข้าว เสื้อผ้า ดินสอ) | บริการ = สิ่งที่คนทำให้ (ตัดผม รักษาโรค สอนหนังสือ)", en: "Goods = physical things | Services = things people do for us (haircut, teaching)" },
        { th: "ผู้ผลิต = คนทำสินค้า/บริการ | ผู้บริโภค = คนซื้อไปใช้", en: "Producer = makes goods/services | Consumer = buys and uses them" },
        { th: "รายรับ = เงินที่ได้ | รายจ่าย = เงินที่ใช้ | ออม = เก็บไว้ใช้ยามจำเป็น", en: "Income = money in | Expense = money out | Saving = keeping money for later" },
      ],
      ex: [
        [{ th: "การตัดผมเป็นสินค้าหรือบริการ", en: "Is a haircut a good or a service?" }, "บริการ / service"],
        [{ th: "คนที่ซื้อของไปใช้เรียกว่า", en: "A person who buys to use is a…" }, "ผู้บริโภค / consumer"],
      ],
      mem: { th: "จับต้องได้ = สินค้า, ทำให้เรา = บริการ", en: "Can touch it = good; done for you = service." },
      tip: { th: "ควรออมก่อนใช้ และซื้อของที่ 'จำเป็น' ก่อนของที่ 'อยากได้'", en: "Save first; buy needs before wants." },
    },
    {
      h: { th: "ภูมิศาสตร์: แผนที่ & ทิศ", en: "Geography: maps & directions" },
      p: [
        { th: "แผนที่ช่วยบอกตำแหน่งและเส้นทาง เราใช้ทิศและสัญลักษณ์ในการอ่านแผนที่", en: "Maps show places and routes; we use directions and symbols to read them." },
      ],
      k: [
        { th: "ทิศหลัก 4 ทิศ: เหนือ ใต้ ตะวันออก ตะวันตก", en: "4 main directions: North, South, East, West" },
        { th: "บนแผนที่ ทิศเหนืออยู่ 'ด้านบน' เสมอ", en: "On a map, North is always at the top" },
        { th: "ดวงอาทิตย์ขึ้นทางทิศตะวันออก ตกทางทิศตะวันตก", en: "The sun rises in the East, sets in the West" },
        { th: "แผนที่มีสัญลักษณ์ (บ้าน วัด ถนน แม่น้ำ) และมาตราส่วน", en: "Maps use symbols (house, temple, road, river) and a scale" },
      ],
      ex: [
        [{ th: "ทิศที่ดวงอาทิตย์ขึ้น", en: "Direction the sun rises" }, "ตะวันออก / East"],
        [{ th: "บนแผนที่ ด้านบนคือทิศ", en: "Top of a map is which direction?" }, "เหนือ / North"],
      ],
      mem: { th: "จำ 'ตะวันออก = อาทิตย์ออก' และแผนที่ 'บน=เหนือ'", en: "'East = sun exits (rises)'; map top = North." },
      tip: null,
    },
  ],
  history: [
    {
      h: { th: "หลักฐานทางประวัติศาสตร์ (ชั้นต้น/ชั้นรอง)", en: "Historical evidence (primary/secondary)" },
      p: [
        { th: "เรารู้เรื่องอดีตจากหลักฐาน ซึ่งแบ่งเป็นหลักฐานชั้นต้นและชั้นรอง", en: "We learn about the past from evidence, which is either primary or secondary." },
      ],
      k: [
        { th: "หลักฐานชั้นต้น: ของจริงหรือคนที่อยู่ในเหตุการณ์ เช่น จารึก โบราณวัตถุ ภาพถ่ายเก่า คำบอกเล่าผู้เห็นเหตุการณ์", en: "Primary: real objects or eyewitnesses — inscriptions, artefacts, old photos, eyewitness accounts" },
        { th: "หลักฐานชั้นรอง: สร้างขึ้นภายหลังจากหลักฐานชั้นต้น เช่น หนังสือเรียน สารคดี บทความ", en: "Secondary: made later from primary sources — textbooks, documentaries, articles" },
      ],
      ex: [
        [{ th: "หนังสือเรียนเป็นหลักฐานชั้นใด", en: "A textbook is which type?" }, "ชั้นรอง / secondary"],
        [{ th: "โบราณวัตถุเป็นหลักฐานชั้นใด", en: "An artefact is which type?" }, "ชั้นต้น / primary"],
      ],
      mem: { th: "อยู่ในเหตุการณ์จริง = ชั้นต้น, เล่าต่อภายหลัง = ชั้นรอง", en: "There at the event = primary; retold later = secondary." },
      tip: { th: "ภาพถ่ายเก่า + คำบอกเล่าผู้เฒ่า = ชั้นต้น | หนังสือ + สารคดี = ชั้นรอง", en: "Old photos & elders' accounts = primary; books & documentaries = secondary." },
    },
  ],
  arts: [
    {
      h: { th: "ศิลปะ: แม่สี & วรรณะสี", en: "Art: primary colours & colour temperature" },
      p: [
        { th: "สีมีระบบของมัน เริ่มจากแม่สี 3 สี ผสมกันได้สีใหม่ และแบ่งเป็นสีโทนอุ่น-เย็น", en: "Colours follow a system: 3 primary colours mix into new ones, and split into warm and cool tones." },
      ],
      k: [
        { th: "แม่สี 3 สี: แดง เหลือง น้ำเงิน (ผสมกันเกิดสีอื่น)", en: "3 primary colours: red, yellow, blue" },
        { th: "สีขั้นที่ 2: แดง+เหลือง=ส้ม, เหลือง+น้ำเงิน=เขียว, แดง+น้ำเงิน=ม่วง", en: "Secondary: red+yellow=orange, yellow+blue=green, red+blue=purple" },
        { th: "วรรณะอุ่น: แดง ส้ม เหลือง | วรรณะเย็น: เขียว ฟ้า ม่วง", en: "Warm: red, orange, yellow | Cool: green, blue, purple" },
      ],
      ex: [
        [{ th: "แดง + เหลือง = สี", en: "Red + yellow =" }, "ส้ม / orange"],
        [{ th: "แม่สีมีกี่สี", en: "How many primary colours?" }, "3 สี"],
      ],
      mem: { th: "ท่องแม่สี 'แดง-เหลือง-น้ำเงิน' และผสมทีละคู่ได้ ส้ม-เขียว-ม่วง", en: "Chant 'red-yellow-blue'; mix pairs → orange-green-purple." },
      tip: { th: "อุ่น = สีของไฟ/แดด (แดง ส้ม เหลือง) | เย็น = สีของน้ำ/ต้นไม้ (ฟ้า เขียว ม่วง)", en: "Warm = fire/sun colours; cool = water/plant colours." },
    },
    {
      h: { th: "นาฏศิลป์: ภาษาท่า & การเคลื่อนไหว", en: "Dance: gesture language & movement" },
      p: [
        { th: "นาฏศิลป์ไทยใช้ 'ภาษาท่า' สื่อความหมายแทนคำพูด และเคลื่อนไหวตามจังหวะดนตรี", en: "Thai dance uses gestures ('gesture language') to express meaning, moving in time with music." },
      ],
      k: [
        { th: "ภาษาท่า = ท่าทางที่สื่อความหมาย เช่น ท่าดีใจ เสียใจ ปฏิเสธ เรียก", en: "Gesture language = movements that mean something (joy, sadness, no, come)" },
        { th: "เคลื่อนไหวตามจังหวะ: ช้า-เร็วตามเสียงดนตรี | มีท่ารำพื้นฐาน", en: "Move to the beat: slow/fast with the music; basic dance poses" },
      ],
      ex: [
        [{ th: "การใช้ท่าทางแทนคำพูดเรียกว่า", en: "Using gestures instead of words is called…" }, "ภาษาท่า"],
      ],
      mem: { th: "ภาษาท่า = 'พูดด้วยมือและร่างกาย' แทนเสียง", en: "Gesture language = 'speaking with hands and body'." },
      tip: null,
    },
  ],
};

/* ============ EXAM 2 — NEW TOPIC LESSONS (LESSONS_T2) ============ */
const LESSONS_T2 = {
  thai: [
    {
      h: { th: "การเขียนจดหมายลาครู", en: "Writing a leave letter to the teacher" },
      p: [
        { th: "จดหมายลาครูใช้เมื่อหยุดเรียน (ป่วยหรือมีธุระ) มีรูปแบบและส่วนประกอบที่ต้องเขียนให้ครบ", en: "A leave letter is written when absent (sick or busy). It has a set format with required parts." },
      ],
      k: [
        { th: "ส่วนประกอบ: วันที่ → คำขึ้นต้น (เรียนคุณครู…) → เนื้อความ (บอกเหตุผลลา + วันที่ลา) → คำลงท้าย (ด้วยความเคารพ) → ลงชื่อ", en: "Parts: date → greeting → body (reason + dates) → closing → signature" },
        { th: "ต้องบอกให้ชัด: ลาป่วยหรือลากิจ, ลาวันไหนถึงวันไหน", en: "State clearly: sick leave or personal leave, and the dates" },
        { th: "ใช้ภาษาสุภาพ เขียนสะอาด อ่านง่าย", en: "Use polite language, write neatly" },
      ],
      ex: [
        [{ th: "จดหมายลาเพราะไม่สบาย เรียกว่า", en: "A letter for being sick is called…" }, "ลาป่วย"],
        [{ th: "คำลงท้ายจดหมายถึงครูที่สุภาพ", en: "A polite closing to a teacher" }, "ด้วยความเคารพ"],
      ],
      mem: { th: "จำลำดับ: วันที่-คำขึ้นต้น-เนื้อความ-คำลงท้าย-ลงชื่อ", en: "Order: date-greeting-body-closing-signature." },
      tip: { th: "อย่าลืมบอก 'เหตุผลที่ลา' และ 'วันที่ลา' ให้ครบ ครูจะได้รู้ชัดเจน", en: "Always include the reason and the dates of absence." },
      term: 2,
    },
  ],
  math: [
    {
      h: { th: "การวัดความยาว (Length)", en: "Measuring length" },
      p: [
        { th: "เราวัดความยาวด้วยไม้บรรทัด/สายวัด หน่วยที่ใช้บ่อยคือ เซนติเมตร (ซม.) และเมตร (ม.)", en: "We measure length with a ruler/tape. Common units are centimetres (cm) and metres (m)." },
      ],
      k: [
        { th: "1 เมตร = 100 เซนติเมตร | 1 เซนติเมตร = 10 มิลลิเมตร", en: "1 m = 100 cm | 1 cm = 10 mm" },
        { th: "ของสั้น (ดินสอ) วัดเป็น ซม. | ของยาว (ห้อง สนาม) วัดเป็น ม.", en: "Short things → cm; long things → m" },
        { th: "บวก-ลบความยาวได้ ถ้าหน่วยเดียวกัน เช่น 120 ซม. + 80 ซม. = 200 ซม. = 2 ม.", en: "Add/subtract lengths with the same unit" },
      ],
      ex: [
        ["2 เมตร = กี่เซนติเมตร", "200 ซม."],
        ["150 ซม. = กี่เมตรกี่เซนติเมตร", "1 ม. 50 ซม."],
      ],
      mem: { th: "จำ '1 เมตร = 100 ซม.' เหมือน 1 บาท = 100 สตางค์", en: "1 m = 100 cm, like 1 baht = 100 satang." },
      tip: { th: "เทียบหน่วยให้เหมือนกันก่อนบวก-ลบเสมอ", en: "Convert to the same unit before adding or subtracting." },
      term: 2,
    },
    {
      h: { th: "รูปเรขาคณิต & แกนสมมาตร", en: "Geometric shapes & symmetry" },
      p: [
        { th: "รูปเรขาคณิตมีด้านและมุม เรานับได้ และบางรูปมีแกนสมมาตร (พับแล้วซ้อนทับกันพอดี)", en: "Geometric shapes have sides and corners; some have a line of symmetry (folds to match exactly)." },
      ],
      k: [
        { th: "สามเหลี่ยม: 3 ด้าน 3 มุม | สี่เหลี่ยม: 4 ด้าน 4 มุม | ห้าเหลี่ยม: 5 ด้าน", en: "Triangle: 3 sides | Square/rectangle: 4 sides | Pentagon: 5 sides" },
        { th: "วงกลมไม่มีมุมและไม่มีด้าน", en: "A circle has no sides or corners" },
        { th: "แกนสมมาตร = เส้นที่พับรูปแล้วสองข้างซ้อนทับกันพอดี (เช่น หัวใจ ผีเสื้อ สี่เหลี่ยมจัตุรัส)", en: "Line of symmetry = fold and both halves match (heart, butterfly, square)" },
      ],
      ex: [
        [{ th: "สามเหลี่ยมมีกี่ด้าน", en: "How many sides has a triangle?" }, "3 ด้าน"],
        [{ th: "รูปที่พับแล้วซ้อนทับกันพอดีมี", en: "A shape that folds to match has a…" }, "แกนสมมาตร"],
      ],
      mem: { th: "นับชื่อรูปจากจำนวนด้าน: สาม=3, สี่=4, ห้า=5 เหลี่ยม", en: "Name by side count: tri=3, quad=4, penta=5." },
      tip: { th: "ทดสอบแกนสมมาตรด้วยการ 'พับกระดาษ' ถ้าซ้อนทับพอดี = มีแกนสมมาตร", en: "Test symmetry by folding paper; if halves match, it's symmetric." },
      term: 2,
    },
    {
      h: { th: "เศษส่วนเบื้องต้น (Fractions)", en: "Basic fractions" },
      p: [
        { th: "เศษส่วนคือส่วนหนึ่งของทั้งหมดที่แบ่งเท่า ๆ กัน เขียนเป็น เศษ/ส่วน", en: "A fraction is an equal part of a whole, written as numerator/denominator." },
      ],
      k: [
        { th: "ตัวล่าง (ส่วน) = แบ่งเป็นกี่ส่วนเท่า ๆ กัน | ตัวบน (เศษ) = เอามากี่ส่วน", en: "Denominator (bottom) = number of equal parts | Numerator (top) = parts taken" },
        { th: "1/2 = ครึ่งหนึ่ง | 1/4 = หนึ่งในสี่ | 3/4 = สามในสี่", en: "1/2 = half | 1/4 = quarter | 3/4 = three quarters" },
        { th: "แบ่งพิซซา 4 ชิ้นเท่ากัน กิน 1 ชิ้น = กินไป 1/4", en: "Pizza cut into 4, eat 1 → ate 1/4" },
      ],
      ex: [
        [{ th: "ครึ่งหนึ่งเขียนเป็นเศษส่วน", en: "Write 'half' as a fraction" }, "1/2"],
        [{ th: "แบ่งเค้ก 4 ส่วน กิน 3 ส่วน = ", en: "Cake in 4, eat 3 =" }, "3/4"],
      ],
      mem: { th: "ตัวล่างบอก 'แบ่งกี่ชิ้น' ตัวบนบอก 'เอากี่ชิ้น'", en: "Bottom = how many pieces; top = how many taken." },
      tip: { th: "เศษส่วนต้องแบ่ง 'เท่า ๆ กัน' เท่านั้น ถ้าแบ่งไม่เท่ากันใช้เศษส่วนไม่ได้", en: "Parts must be equal to be a fraction." },
      term: 2,
    },
  ],
  science: [
    {
      h: { th: "แรงและการเคลื่อนที่ (Forces & motion)", en: "Forces & motion" },
      p: [
        { th: "แรงคือการดึงหรือดันที่ทำให้วัตถุเคลื่อนที่ หยุด หรือเปลี่ยนทิศทาง", en: "A force is a push or a pull that makes things move, stop, or change direction." },
      ],
      k: [
        { th: "แรงทำให้วัตถุ: เริ่มเคลื่อนที่ / หยุด / เร็วขึ้น-ช้าลง / เปลี่ยนทิศ / เปลี่ยนรูปร่าง", en: "Forces make objects start, stop, speed up/slow down, turn, or change shape" },
        { th: "แรงสัมผัส = ต้องแตะวัตถุ (ผลัก ดึง เสียดทาน) | แรงไม่สัมผัส = ไม่ต้องแตะ (แรงแม่เหล็ก แรงโน้มถ่วง)", en: "Contact force = must touch (push, pull, friction) | Non-contact = no touch (magnetism, gravity)" },
        { th: "แรงโน้มถ่วงดึงของตกลงสู่พื้นเสมอ", en: "Gravity pulls things down to the ground" },
      ],
      ex: [
        [{ th: "การเตะลูกบอลเป็นแรงชนิดใด", en: "Kicking a ball is which force?" }, "แรงสัมผัส"],
        [{ th: "แรงที่ดึงของตกลงพื้นคือ", en: "Force pulling things down" }, "แรงโน้มถ่วง (ไม่สัมผัส)"],
      ],
      mem: { th: "แรง = ผลักหรือดึง | ต้องแตะ = สัมผัส, ไม่ต้องแตะ = ไม่สัมผัส", en: "Force = push/pull; touch = contact, no touch = non-contact." },
      tip: { th: "แรงแม่เหล็กและแรงโน้มถ่วงเป็น 'แรงไม่สัมผัส' เพราะออกแรงได้โดยไม่ต้องแตะ", en: "Magnetism and gravity are non-contact forces." },
      term: 2,
    },
    {
      h: { th: "แรงแม่เหล็ก (Magnets)", en: "Magnets" },
      p: [
        { th: "แม่เหล็กมีแรงดึงดูดวัตถุบางชนิด และมี 2 ขั้วคือขั้วเหนือ (N) กับขั้วใต้ (S)", en: "Magnets attract some materials and have two poles: North (N) and South (S)." },
      ],
      k: [
        { th: "แม่เหล็กดูดของที่ทำจากเหล็ก/นิกเกิล ไม่ดูดไม้ พลาสติก แก้ว กระดาษ", en: "Magnets attract iron/nickel; not wood, plastic, glass, paper" },
        { th: "ขั้วเหมือนกันผลักกัน (N-N, S-S) | ขั้วต่างกันดูดกัน (N-S)", en: "Same poles repel (N-N); opposite poles attract (N-S)" },
        { th: "แรงแม่เหล็กเป็นแรงไม่สัมผัส (ออกแรงได้โดยไม่ต้องแตะ)", en: "Magnetism is a non-contact force" },
      ],
      ex: [
        [{ th: "แม่เหล็กดูดของที่ทำจาก", en: "Magnets attract things made of…" }, "เหล็ก (โลหะบางชนิด)"],
        [{ th: "ขั้ว N เจอขั้ว N จะ", en: "N pole meets N pole →" }, "ผลักกัน"],
      ],
      mem: { th: "จำ 'เหมือนผลัก ต่างดูด' (เหมือนกันผลัก ต่างกันดูด)", en: "'Same repel, opposite attract.'" },
      tip: { th: "ทดสอบว่าเป็นแม่เหล็กไหม ลองเอาไปใกล้ตะปูเหล็ก ถ้าดูดติด = เป็นแม่เหล็ก", en: "Test a magnet with an iron nail — if it sticks, it's magnetic." },
      term: 2,
    },
    {
      h: { th: "วัสดุรอบตัว (Materials)", en: "Materials around us" },
      p: [
        { th: "สิ่งของทำจากวัสดุต่างกัน แต่ละวัสดุมีสมบัติต่างกัน จึงเลือกใช้ให้เหมาะกับงาน", en: "Objects are made of different materials with different properties, chosen to suit the job." },
      ],
      k: [
        { th: "วัสดุที่พบบ่อย: ไม้ โลหะ พลาสติก แก้ว ผ้า กระดาษ ยาง", en: "Common materials: wood, metal, plastic, glass, cloth, paper, rubber" },
        { th: "สมบัติ: แข็ง-นิ่ม, โปร่งใส-ทึบ, ยืดหยุ่น, กันน้ำ", en: "Properties: hard/soft, clear/opaque, stretchy, waterproof" },
        { th: "เลือกวัสดุตามงาน: ร่มใช้ผ้ากันน้ำ, หน้าต่างใช้แก้วใส", en: "Choose by use: umbrella=waterproof cloth, window=clear glass" },
      ],
      ex: [
        [{ th: "หน้าต่างทำจากแก้วเพราะ", en: "Windows use glass because it is…" }, "โปร่งใส มองผ่านได้"],
        [{ th: "ยางลบทำจากวัสดุที่มีสมบัติ", en: "An eraser is made of…" }, "ยาง (ยืดหยุ่น)"],
      ],
      mem: { th: "จับคู่วัสดุกับงาน: กันน้ำ→ผ้าร่ม, ใส→แก้ว, แข็ง→โลหะ", en: "Match material to job." },
      tip: null,
      term: 2,
    },
  ],
  social: [
    {
      h: { th: "ภาษี (Taxes)", en: "Taxes" },
      p: [
        { th: "ภาษีคือเงินที่ประชาชนจ่ายให้รัฐ เพื่อนำไปพัฒนาประเทศและบริการส่วนรวม", en: "Tax is money people pay to the government to develop the country and public services." },
      ],
      k: [
        { th: "ภาษีนำไปสร้าง: ถนน โรงเรียน โรงพยาบาล ไฟฟ้า ความปลอดภัย", en: "Taxes fund roads, schools, hospitals, safety" },
        { th: "ตัวอย่างภาษีที่พบ: ภาษีมูลค่าเพิ่ม (VAT ตอนซื้อของ), ภาษีเงินได้", en: "Examples: VAT (when buying), income tax" },
        { th: "การเสียภาษีเป็นหน้าที่ของพลเมืองที่ดี", en: "Paying tax is a good citizen's duty" },
      ],
      ex: [
        [{ th: "ภาษีที่จ่ายให้รัฐนำไปทำอะไร", en: "What are taxes used for?" }, "สร้างถนน โรงเรียน โรงพยาบาล ฯลฯ"],
        [{ th: "ตอนซื้อของเราจ่ายภาษีชนิดใด", en: "Which tax when buying goods?" }, "ภาษีมูลค่าเพิ่ม (VAT)"],
      ],
      mem: { th: "ภาษี = เงินส่วนรวม เอาไปทำของใช้ร่วมกัน (ถนน โรงเรียน โรงพยาบาล)", en: "Tax = shared money for shared things." },
      tip: null,
      term: 2,
    },
  ],
  history: [
    {
      h: { th: "การตั้งถิ่นฐานและการพัฒนาชุมชน", en: "Settlement & community development" },
      p: [
        { th: "คนมักตั้งถิ่นฐานในที่ที่เหมาะสม แล้วชุมชนค่อย ๆ พัฒนาขึ้นตามกาลเวลา", en: "People settle where conditions are good; communities then develop over time." },
      ],
      k: [
        { th: "คนเลือกตั้งบ้านใกล้ 'แหล่งน้ำ' (แม่น้ำ) เพราะใช้ดื่ม เพาะปลูก และเดินทาง", en: "People settle near water for drinking, farming, and travel" },
        { th: "ปัจจัยตั้งถิ่นฐาน: น้ำ ดินอุดม อากาศดี ปลอดภัย", en: "Settlement factors: water, fertile soil, good climate, safety" },
        { th: "ชุมชนพัฒนา: จากหมู่บ้านเล็ก → มีตลาด โรงเรียน ถนน → เป็นเมือง", en: "Communities grow: village → market/school/roads → town" },
        { th: "วัฒนธรรมแต่ละชุมชนต่างกันตามสภาพแวดล้อมและความเชื่อ", en: "Each community's culture differs by environment and belief" },
      ],
      ex: [
        [{ th: "คนโบราณมักตั้งบ้านใกล้อะไร", en: "People long ago settled near…" }, "แหล่งน้ำ/แม่น้ำ"],
        [{ th: "เพราะเหตุใดจึงตั้งถิ่นฐานริมน้ำ", en: "Why settle by water?" }, "ใช้ดื่ม เพาะปลูก เดินทาง"],
      ],
      mem: { th: "จำ 'อยู่ใกล้น้ำ = อยู่รอด' คนโบราณจึงตั้งบ้านริมแม่น้ำ", en: "'Near water = survival' — so people settled by rivers." },
      tip: null,
      term: 2,
    },
  ],
  arts: [
    {
      h: { th: "การงาน: แต่งกายเหมาะสม & ซ่อมเสื้อผ้า", en: "Grooming & mending clothes" },
      p: [
        { th: "การแต่งกายให้เหมาะกับโอกาสและดูแลเสื้อผ้าเป็นทักษะชีวิตที่ดี รวมถึงซ่อมแซมเบื้องต้น", en: "Dressing suitably and caring for clothes are life skills, including basic mending." },
      ],
      k: [
        { th: "แต่งกายให้เหมาะกับโอกาส: ชุดนักเรียนไปเรียน ชุดสุภาพไปงาน ชุดกีฬาเล่นกีฬา", en: "Dress for the occasion: uniform for school, neat clothes for events" },
        { th: "ดูแลเสื้อผ้า: ซัก ตาก พับ/แขวนให้เรียบร้อย", en: "Care: wash, dry, fold/hang neatly" },
        { th: "ซ่อมแซมง่าย ๆ: เย็บกระดุมที่หลุด เย็บตะเข็บที่ขาดด้วยเข็มกับด้าย", en: "Simple mending: sew on a button, stitch a small tear" },
      ],
      ex: [
        [{ th: "ไปโรงเรียนควรแต่งชุดใด", en: "What to wear to school?" }, "ชุดนักเรียน"],
        [{ th: "กระดุมหลุดควรทำอย่างไร", en: "Button fell off — do what?" }, "เย็บติดด้วยเข็มและด้าย"],
      ],
      mem: { th: "แต่งกาย 'ถูกกาลเทศะ' = เหมาะกับสถานที่และโอกาส", en: "Dress to fit the place and occasion." },
      tip: null,
      term: 2,
    },
    {
      h: { th: "นาฏศิลป์: ดนตรีท้องถิ่น 4 ภาค", en: "Local Thai music (4 regions)" },
      p: [
        { th: "ดนตรีพื้นบ้านของไทยต่างกันตามภาค สะท้อนวัฒนธรรมของแต่ละท้องถิ่น และใช้ในวันสำคัญ/งานรื่นเริง", en: "Thai folk music differs by region, reflecting local culture, and is used at festivals." },
      ],
      k: [
        { th: "ภาคเหนือ: ดนตรีล้านนา (สะล้อ ซอ ซึง) จังหวะช้านุ่มนวล", en: "North: Lanna music (salo, so, sueng)" },
        { th: "ภาคอีสาน: หมอลำ (แคน โปงลาง) สนุกสนาน", en: "Northeast: mor lam (khaen, ponglang)" },
        { th: "ภาคกลาง: เพลงพื้นบ้าน (กลองยาว รำวง)", en: "Central: folk songs (klong yao, ramwong)" },
        { th: "ภาคใต้: หนังตะลุง โนรา (กลอง โหม่ง)", en: "South: nang talung, nora" },
      ],
      ex: [
        [{ th: "แคนและโปงลางเป็นดนตรีภาคใด", en: "Khaen & ponglang are from which region?" }, "ภาคอีสาน"],
        [{ th: "หนังตะลุง โนรา เป็นของภาคใด", en: "Nang talung, nora belong to…" }, "ภาคใต้"],
      ],
      mem: { th: "จับคู่ภาค-เครื่องดนตรี: เหนือ=สะล้อซึง, อีสาน=แคน, ใต้=โนรา", en: "Pair region-instrument: North=sueng, NE=khaen, South=nora." },
      tip: null,
      term: 2,
    },
    {
      h: { th: "ศิลปะ: ถ่ายทอดความรู้สึกด้วยทัศนธาตุ", en: "Art: expressing feelings with visual elements" },
      p: [
        { th: "หน่วยที่ 3 'คิดอย่างไรว่าดังนั้น' ให้วาดภาพถ่ายทอดความรู้สึกจากเหตุการณ์จริง โดยใช้ เส้น สี รูปร่าง รูปทรง พื้นผิว", en: "Unit 3 asks us to draw real feelings using line, colour, shape, form, and texture." },
      ],
      k: [
        { th: "เส้น: เส้นหยัก/แหลม = ตื่นเต้น รุนแรง | เส้นโค้งนุ่ม = สงบ อ่อนโยน", en: "Lines: jagged = exciting; soft curves = calm" },
        { th: "สี: สีสดใส = สนุก ร่าเริง | สีมืดทึม = เศร้า เหงา", en: "Colour: bright = happy; dark = sad" },
        { th: "ประเมินงานตนเอง: บอกสิ่งที่ชื่นชม และสิ่งที่ควรปรับปรุงได้", en: "Self-review: say what you like and what to improve" },
      ],
      ex: [
        [{ th: "อยากสื่อความ 'สนุกสดใส' ควรใช้สีแบบใด", en: "To show 'joy', use which colours?" }, "สีสดใส (วรรณะอุ่น)"],
        [{ th: "เส้นโค้งนุ่มนวลสื่อความรู้สึก", en: "Soft curved lines feel…" }, "สงบ อ่อนโยน"],
      ],
      mem: { th: "อารมณ์ → เลือกเส้นและสีให้ตรง: สดใส=สุข, มืด=เศร้า", en: "Match line & colour to the mood." },
      tip: null,
      term: 2,
    },
  ],
  english: [
    {
      h: { th: "Questions with some / any", en: "Questions with some / any" },
      p: [
        { th: "ใช้ some กับประโยคบอกเล่า และ any กับประโยคคำถามและปฏิเสธ (มักใช้กับอาหาร/ของนับไม่ได้)", en: "Use 'some' in positive sentences, 'any' in questions and negatives (often with food/uncountables)." },
      ],
      k: [
        { th: "บอกเล่า: There is some milk. / I have some apples.", en: "Positive: There is some milk." },
        { th: "คำถาม: Is there any juice? / Have you got any pens?", en: "Question: Is there any juice?" },
        { th: "ปฏิเสธ: There isn't any bread.", en: "Negative: There isn't any bread." },
      ],
      ex: [
        ["Is there ___ cheese?", "any"],
        ["There is ___ water in the glass.", "some"],
      ],
      mem: { th: "some = ประโยคบอก | any = ถาม/ปฏิเสธ", en: "some = positive; any = question/negative." },
      tip: { th: "ในคำถามและปฏิเสธ ใช้ any เกือบเสมอ", en: "In questions and negatives, use 'any'." },
      term: 2,
    },
    {
      h: { th: "be going to (แผนอนาคต)", en: "be going to (future plans)" },
      p: [
        { th: "ใช้ 'am/is/are + going to + กริยา' เพื่อบอกแผนหรือสิ่งที่ตั้งใจจะทำในอนาคต", en: "Use 'am/is/are going to + verb' for plans or intentions in the future." },
      ],
      k: [
        { th: "I am going to swim. / She is going to read. / They are going to play.", en: "I am going to swim. / She is going to read." },
        { th: "am (I) / is (he,she,it) / are (you,we,they) — เหมือน present continuous", en: "am/is/are chosen by the subject" },
        { th: "คำถาม: What are you going to do? — I'm going to study.", en: "Question: What are you going to do?" },
      ],
      ex: [
        ["She ___ going to sing.", "is"],
        ["We ___ going to eat lunch.", "are"],
      ],
      mem: { th: "สูตร: ประธาน + (am/is/are) + going to + กริยาช่อง 1", en: "subject + (am/is/are) + going to + base verb." },
      tip: { th: "ตามหลัง going to ใช้กริยาช่องที่ 1 (รูปธรรมดา) เสมอ", en: "After 'going to' use the base verb." },
      term: 2,
    },
  ],
  time: [
    {
      h: { th: "Past Continuous & Places around town", en: "Past Continuous & Places around town" },
      p: [
        { th: "Past continuous บอกสิ่งที่ 'กำลังทำอยู่ในอดีต' ใช้ was/were + กริยา-ing และเพิ่มคำศัพท์สถานที่ในเมือง", en: "Past continuous tells what was happening in the past (was/were + verb-ing), plus town-place words." },
      ],
      k: [
        { th: "was (I,he,she,it) / were (you,we,they) + กริยา-ing", en: "was (I/he/she/it) / were (you/we/they) + verb-ing" },
        { th: "I was reading. / They were playing. (กำลังทำอยู่เมื่อวาน/ตอนนั้น)", en: "I was reading. / They were playing." },
        { th: "Places: hospital, market, bank, post office, park, school, temple, shop", en: "Places: hospital, market, bank, post office, park, temple, shop" },
      ],
      ex: [
        ["I ___ eating at 7 pm. (was/were)", "was"],
        ["They ___ playing football.", "were"],
        [{ th: "สถานที่ส่งจดหมายคือ", en: "Place to post letters" }, "post office"],
      ],
      mem: { th: "was = เอกพจน์/I | were = พหูพจน์/you — ตามด้วยกริยา-ing", en: "was = singular/I; were = plural/you; + verb-ing." },
      tip: { th: "Past continuous เหมือน present continuous แต่เปลี่ยน is/are/am เป็น was/were", en: "Like present continuous but with was/were." },
      term: 2,
    },
  ],
  health: [
    {
      h: { th: "โรคที่ควรรู้จักและการป้องกัน", en: "Common illnesses & prevention" },
      p: [
        { th: "โรคที่พบบ่อยในเด็กป้องกันได้ด้วยสุขนิสัยที่ดี ถ้าป่วยควรพักและบอกผู้ใหญ่", en: "Common childhood illnesses can be prevented with good hygiene; if sick, rest and tell an adult." },
      ],
      k: [
        { th: "ไข้หวัด: ป้องกันโดยล้างมือ ใส่หน้ากาก พักผ่อน ไม่คลุกคลีคนป่วย", en: "Cold/flu: wash hands, wear a mask, rest" },
        { th: "ท้องเสีย: เกิดจากอาหาร/น้ำไม่สะอาด ป้องกันโดยกินสุก ดื่มน้ำสะอาด ล้างมือก่อนกิน", en: "Diarrhoea: from unclean food/water; eat cooked food, wash hands" },
        { th: "ฟันผุ: แปรงฟันวันละ 2 ครั้ง ลดขนม-น้ำหวาน", en: "Tooth decay: brush twice daily, less sweets" },
        { th: "สุขนิสัยดี: กินครบ 5 หมู่ ออกกำลังกาย นอนพอ", en: "Good habits: eat 5 groups, exercise, sleep" },
      ],
      ex: [
        [{ th: "ป้องกันไข้หวัดทำได้โดย", en: "Prevent a cold by…" }, "ล้างมือ ใส่หน้ากาก พักผ่อน"],
        [{ th: "ท้องเสียมักเกิดจาก", en: "Diarrhoea often comes from…" }, "อาหาร/น้ำไม่สะอาด"],
      ],
      mem: { th: "ล้างมือบ่อย ๆ = กันโรคได้หลายอย่าง", en: "Frequent hand-washing prevents many illnesses." },
      tip: { th: "ถ้ารู้สึกไม่สบาย ให้บอกผู้ใหญ่และพักผ่อน อย่าฝืน", en: "If unwell, tell an adult and rest." },
      term: 2,
    },
    {
      h: { th: "ความปลอดภัยของร่างกาย (Body safety)", en: "Body safety" },
      p: [
        { th: "ร่างกายของเราเป็นของเรา เรามีสิทธิ์ปกป้อง และต้องรู้จักขอความช่วยเหลือเมื่อรู้สึกไม่ปลอดภัย เรื่องนี้สำคัญมากและไม่ใช่เรื่องน่าอาย", en: "Your body belongs to you. You have the right to protect it and to ask for help when you feel unsafe. This is important and nothing to be ashamed of." },
      ],
      k: [
        { th: "\"จุดส่วนตัว\" คือส่วนที่ชุดว่ายน้ำปิดไว้ เป็นของเราคนเดียว ไม่มีใครมีสิทธิ์ดูหรือแตะโดยไม่จำเป็น", en: "Private parts are the areas a swimsuit covers — they are yours alone" },
        { th: "การสัมผัสที่ดี = อบอุ่นปลอดภัย (กอดจากพ่อแม่) | ที่ไม่โอเค = ทำให้อึดอัด กลัว หรือสับสน", en: "Good touch feels safe (a parent's hug); not-okay touch makes you uncomfortable or scared" },
        { th: "กฎ 3 ข้อเมื่อไม่ปลอดภัย: ปฏิเสธ (พูดว่า \"ไม่!\") → หนีออกมา → บอกผู้ใหญ่ที่ไว้ใจได้", en: "3 rules if unsafe: say NO → get away → tell a trusted adult" },
        { th: "ถ้าเกิดเรื่องไม่ดี ไม่ใช่ความผิดของเราเลย และความลับที่ทำให้อึดอัดไม่ต้องเก็บ", en: "If something bad happens it is never your fault; don't keep secrets that feel wrong" },
        { th: "ผู้ใหญ่ที่ไว้ใจได้: พ่อ แม่ ครู ญาติสนิท — บอกไปเรื่อย ๆ จนกว่าจะมีคนช่วย", en: "Trusted adults: parents, teachers, close relatives — keep telling until someone helps" },
      ],
      ex: [
        [{ th: "ถ้ามีคนทำให้รู้สึกไม่ปลอดภัย ควรทำอย่างไร", en: "If someone makes you feel unsafe…" }, "ปฏิเสธ–หนี–บอกผู้ใหญ่ที่ไว้ใจ"],
        [{ th: "ความลับที่ทำให้อึดอัดควรทำอย่างไร", en: "A secret that feels wrong — do what?" }, "บอกผู้ใหญ่ที่ไว้ใจได้"],
      ],
      mem: { th: "จำกฎ 3 คำ: \"ไม่ – หนี – บอก\"", en: "Remember 3 words: No – Go – Tell." },
      tip: { th: "ถ้าเกิดเรื่องไม่ดี ไม่ใช่ความผิดของหนูเลย ให้กล้าบอกผู้ใหญ่ที่ไว้ใจเสมอ", en: "It's never your fault — always be brave and tell a trusted adult." },
      term: 2,
    },
  ],
};

/* merge Term-1 second-half lessons (tag exam term 2) */
Object.keys(LESSONS_T1B).forEach((id) => {
  if (LESSONS[id]) LESSONS[id] = LESSONS[id].concat(LESSONS_T1B[id].map((x) => ({ ...x, term: 2 })));
});
Object.keys(LESSONS_T2).forEach((id) => {
  if (LESSONS[id]) LESSONS[id] = LESSONS[id].concat(LESSONS_T2[id].map((x) => ({ ...x, term: x.term || 2 })));
});
/* default all lesson sections without a term to exam term 1 */
Object.keys(LESSONS).forEach((id) => {
  LESSONS[id] = LESSONS[id].map((x) => ({ ...x, term: x.term || 1 }));
});

/* ============ TERM 1 — SECOND HALF QUESTIONS (MORE3) ============ */
const MORE3 = {
  english: {
    mcq: [
      { q: "This is my mother's mother. She is my…", c: ["sister", "grandmother", "aunt", "baby"], a: 1, ex: { th: "แม่ของแม่ = ย่า/ยาย", en: "mother's mother = grandmother" } },
      { q: "We see with our…", c: ["ears", "nose", "eyes", "hands"], a: 2, ex: { th: "มองด้วยตา = eyes", en: "we see with eyes" } },
      { q: "We hear with our…", c: ["eyes", "ears", "mouth", "feet"], a: 1, ex: { th: "ฟังด้วยหู = ears", en: "we hear with ears" } },
      { q: "Plural of 'foot' is…", c: ["foots", "feet", "feets", "foot"], a: 1, ex: { th: "foot → feet", en: "irregular plural" } },
      { q: "A fish can…", c: ["fly", "swim", "read", "drive"], a: 1, ex: { th: "ปลาว่ายน้ำได้", en: "a fish can swim" } },
      { q: "I ___ ride a bike. (ทำได้)", c: ["can", "can't", "am", "is"], a: 0, ex: { th: "can = ทำได้", en: "can = able" } },
      { q: "She is ___. (กำลังวิ่ง)", c: ["run", "runs", "running", "ran"], a: 2, ex: { th: "is + running", en: "present continuous" } },
      { q: "run + ing = ?", c: ["runing", "running", "runnning", "runeing"], a: 1, ex: { th: "ซ้ำ n: running", en: "double the n" } },
      { q: "Which is an animal?", c: ["rabbit", "ruler", "pizza", "chair"], a: 0, ex: { th: "rabbit = กระต่าย", en: "rabbit is an animal" } },
      { q: "They ___ playing football.", c: ["is", "am", "are", "be"], a: 2, ex: { th: "they + are", en: "they → are" } },
      { q: "'baby' means…", c: [{ th: "พี่ชาย", en: "brother" }, { th: "ทารก", en: "infant" }, { th: "พ่อ", en: "father" }, { th: "ครู", en: "teacher" }], a: 1, ex: { th: "baby = ทารก", en: "baby = infant" } },
      { q: "A bird can…", c: ["swim only", "fly", "read", "cook"], a: 1, ex: { th: "นกบินได้", en: "a bird can fly" } },
    ],
    fill: [
      { q: "We smell with our n___.", a: ["nose"] },
      { q: "พหูพจน์ของ tooth คือ", a: ["teeth"] },
      { q: "I ___ swim very well. (ทำได้)", a: ["can"] },
      { q: "He is ___ (กิน) lunch. (eat+ing)", a: ["eating"] },
    ],
  },
  time: {
    mcq: [
      { q: "The day after Friday is…", c: ["Saturday", "Sunday", "Thursday", "Monday"], a: 0, ex: { th: "หลังศุกร์ = เสาร์", en: "after Friday = Saturday" } },
      { q: "The first month of the year is…", c: ["June", "March", "January", "December"], a: 2, ex: { th: "เดือนแรก = January", en: "first month = January" } },
      { q: "How many days are in a week?", c: ["5", "6", "7", "12"], a: 2, ex: { th: "1 สัปดาห์ = 7 วัน", en: "7 days a week" } },
      { q: "How many months are in a year?", c: ["7", "10", "12", "24"], a: 2, ex: { th: "1 ปี = 12 เดือน", en: "12 months a year" } },
      { q: "'first, second, ___'", c: ["three", "third", "thirdly", "tird"], a: 1, ex: { th: "ลำดับที่ 3 = third", en: "3rd = third" } },
      { q: "The day before Monday is…", c: ["Tuesday", "Sunday", "Saturday", "Friday"], a: 1, ex: { th: "ก่อนจันทร์ = อาทิตย์", en: "before Monday = Sunday" } },
      { q: "December is the ___ month.", c: ["first", "sixth", "tenth", "twelfth"], a: 3, ex: { th: "ธันวาคม = เดือนที่ 12", en: "December = 12th" } },
    ],
    fill: [
      { q: "The day after Sunday is M____.", a: ["monday"] },
      { q: "1 ปีมีกี่เดือน (ตัวเลข)", a: ["12", "สิบสอง"] },
      { q: "ลำดับที่ 1 ภาษาอังกฤษคือ f____", a: ["first"] },
    ],
  },
  math: {
    mcq: [
      { q: "6 × 7 = ?", c: ["42", "48", "36", "45"], a: 0, ex: { th: "แม่ 6: 6×7=42", en: "6×7=42" } },
      { q: "8 × 9 = ?", c: ["64", "72", "81", "63"], a: 1, ex: { th: "8×9=72", en: "8×9=72" } },
      { q: "123 × 3 = ?", c: ["369", "339", "366", "396"], a: 0, ex: { th: "คูณทีละหลัก", en: "multiply each digit" } },
      { q: "27 × 4 = ?", c: ["108", "88", "98", "118"], a: 0, ex: { th: "7×4=28 ทด 2", en: "carry the 2" } },
      { q: "56 ÷ 7 = ?", c: ["7", "8", "9", "6"], a: 1, ex: { th: "7×8=56", en: "7×8=56" } },
      { q: "81 ÷ 9 = ?", c: ["8", "9", "7", "6"], a: 1, ex: { th: "9×9=81", en: "9×9=81" } },
      { q: "ลูกอม 24 เม็ด แบ่ง 6 คน คนละกี่เม็ด", c: ["3", "4", "5", "6"], a: 1, ex: { th: "24÷6=4", en: "24÷6=4" } },
      { q: "5, 10, 15, 20, __ (เพิ่มทีละ 5)", c: ["22", "25", "30", "24"], a: 1, ex: { th: "เพิ่มทีละ 5 → 25", en: "+5 → 25" } },
      { q: "30, 27, 24, __ (ลดทีละ 3)", c: ["22", "21", "20", "23"], a: 1, ex: { th: "ลดทีละ 3 → 21", en: "−3 → 21" } },
      { q: "9 × 0 = ?", c: ["9", "0", "1", "90"], a: 1, ex: { th: "อะไรคูณ 0 = 0", en: "×0 = 0" } },
      { q: "12 × 1 = ?", c: ["1", "0", "12", "121"], a: 2, ex: { th: "คูณ 1 = ตัวเดิม", en: "×1 = itself" } },
      { q: "45 ÷ 5 = ?", c: ["8", "9", "7", "6"], a: 1, ex: { th: "5×9=45", en: "5×9=45" } },
    ],
    fill: [
      { q: "7 × 8 = ? (ตัวเลข)", a: ["56"] },
      { q: "63 ÷ 9 = ? (ตัวเลข)", a: ["7"] },
      { q: "2, 4, 6, 8, __ (ตัวเลข)", a: ["10", "สิบ"] },
      { q: "100 ÷ 10 = ? (ตัวเลข)", a: ["10", "สิบ"] },
    ],
  },
  science: {
    mcq: [
      { q: { th: "ส่วนของพืชที่ดูดน้ำจากดินคือ", en: "Which part absorbs water?" }, c: [{ th: "ใบ", en: "leaf" }, { th: "ราก", en: "root" }, { th: "ดอก", en: "flower" }, { th: "ผล", en: "fruit" }], a: 1, ex: { th: "รากดูดน้ำและแร่ธาตุ", en: "roots absorb water" } },
      { q: { th: "ส่วนของพืชที่สร้างอาหารคือ", en: "Which part makes food?" }, c: [{ th: "ราก", en: "root" }, { th: "ลำต้น", en: "stem" }, { th: "ใบ", en: "leaf" }, { th: "เมล็ด", en: "seed" }], a: 2, ex: { th: "ใบสังเคราะห์แสง", en: "leaves photosynthesise" } },
      { q: { th: "พืชสร้างอาหารต้องใช้อะไร", en: "Plants make food using…" }, c: [{ th: "แสงแดด", en: "sunlight" }, { th: "ความมืด", en: "darkness" }, { th: "เสียง", en: "sound" }, { th: "ดิน อย่างเดียว", en: "only soil" }], a: 0, ex: { th: "ใช้แสงแดดสร้างอาหาร", en: "uses sunlight" } },
      { q: { th: "ส่วนที่ทำหน้าที่ค้ำจุนและลำเลียงคือ", en: "Part that supports & transports" }, c: [{ th: "ราก", en: "root" }, { th: "ลำต้น", en: "stem" }, { th: "ดอก", en: "flower" }, { th: "ใบ", en: "leaf" }], a: 1, ex: { th: "ลำต้นลำเลียงน้ำ-อาหาร", en: "the stem transports" } },
      { q: { th: "ข้อใด 'ไม่ใช่' สิ่งที่พืชต้องการ", en: "Which do plants NOT need?" }, c: [{ th: "น้ำ", en: "water" }, { th: "แสงแดด", en: "sunlight" }, { th: "ความมืดตลอดเวลา", en: "constant darkness" }, { th: "อากาศ", en: "air" }], a: 2, ex: { th: "พืชต้องการแสง ไม่ใช่มืด", en: "plants need light" } },
      { q: { th: "ส่วนที่ห่อหุ้มเมล็ดคือ", en: "Part that holds seeds" }, c: [{ th: "ผล", en: "fruit" }, { th: "ราก", en: "root" }, { th: "ใบ", en: "leaf" }, { th: "ลำต้น", en: "stem" }], a: 0, ex: { th: "ผลห่อหุ้มเมล็ด", en: "fruit protects seeds" } },
    ],
    fill: [
      { q: { th: "ส่วนของพืชที่ดูดน้ำคือ", en: "Part that absorbs water" }, a: ["ราก", "root", "roots"] },
      { q: { th: "ใบสร้างอาหารโดยใช้แสง...", en: "Leaves make food using sun____" }, a: ["แดด", "แสงแดด", "sunlight", "light"] },
    ],
  },
  health: {
    mcq: [
      { q: { th: "อวัยวะที่สูบฉีดเลือดคือ", en: "Organ that pumps blood" }, c: [{ th: "ปอด", en: "lungs" }, { th: "หัวใจ", en: "heart" }, { th: "ตับ", en: "liver" }, { th: "ไต", en: "kidney" }], a: 1, ex: { th: "หัวใจสูบฉีดเลือด", en: "heart pumps blood" } },
      { q: { th: "อวัยวะที่ใช้หายใจคือ", en: "Organ for breathing" }, c: [{ th: "หัวใจ", en: "heart" }, { th: "ปอด", en: "lungs" }, { th: "กระเพาะ", en: "stomach" }, { th: "สมอง", en: "brain" }], a: 1, ex: { th: "ปอดใช้หายใจ", en: "lungs breathe" } },
      { q: { th: "อวัยวะที่ควบคุมร่างกายและความคิดคือ", en: "Organ that controls body & thought" }, c: [{ th: "สมอง", en: "brain" }, { th: "ไต", en: "kidney" }, { th: "ปอด", en: "lungs" }, { th: "หัวใจ", en: "heart" }], a: 0, ex: { th: "สมองสั่งการ", en: "brain controls" } },
      { q: { th: "อวัยวะที่ย่อยอาหารคือ", en: "Organ that digests food" }, c: [{ th: "ปอด", en: "lungs" }, { th: "กระเพาะอาหาร", en: "stomach" }, { th: "หัวใจ", en: "heart" }, { th: "สมอง", en: "brain" }], a: 1, ex: { th: "กระเพาะย่อยอาหาร", en: "stomach digests" } },
      { q: { th: "การดูแลอวัยวะที่ดีคือ", en: "Good way to care for organs" }, c: [{ th: "สูบบุหรี่", en: "smoking" }, { th: "กินดี ออกกำลังกาย นอนพอ", en: "eat well, exercise, sleep" }, { th: "อดอาหาร", en: "skip meals" }, { th: "นอนดึกทุกวัน", en: "stay up late" }], a: 1, ex: { th: "ดูแลด้วยสุขนิสัยที่ดี", en: "healthy habits" } },
      { q: { th: "ไตทำหน้าที่", en: "The kidneys…" }, c: [{ th: "กรองของเสีย", en: "filter waste" }, { th: "หายใจ", en: "breathe" }, { th: "สูบเลือด", en: "pump blood" }, { th: "คิด", en: "think" }], a: 0, ex: { th: "ไตกรองของเสียเป็นปัสสาวะ", en: "kidneys filter waste" } },
    ],
    fill: [
      { q: { th: "อวัยวะที่สูบฉีดเลือดคือ ห____", en: "Organ that pumps blood" }, a: ["หัวใจ", "heart"] },
      { q: { th: "เราหายใจด้วย ป___", en: "We breathe with our l____" }, a: ["ปอด", "lungs"] },
    ],
  },
  thai: {
    mcq: [
      { q: "\"จริง\" อ่านว่าอย่างไร", c: ["จะ-ริง", "จิง", "จริง (2 พยางค์)", "ซิง"], a: 1, ex: { th: "ควบไม่แท้ อ่าน จิง", en: "false cluster → จิง" } },
      { q: "\"ทราย\" อ่านออกเสียงว่า", c: ["ทะ-ราย", "ซาย", "ทราย (ควบแท้)", "ตราย"], a: 1, ex: { th: "ทร ออกเสียง ซ", en: "ทร → ซ" } },
      { q: "ข้อใดเป็นคำควบกล้ำแท้", c: ["จริง", "สร้าง", "กลอง", "ทราย"], a: 2, ex: { th: "กลอง ออกเสียงทั้ง กล", en: "กลอง sounds both" } },
      { q: "\"หมา\" ตัวอักษรใดไม่ออกเสียง", c: ["ม", "า", "ห", "ไม่มี"], a: 2, ex: { th: "ห เป็นอักษรนำ ไม่ออกเสียง", en: "ห is silent leader" } },
      { q: "ข้อใดเป็นคำ 'อ นำ ย'", c: ["อาย", "อยู่", "ยาย", "อ่าน"], a: 1, ex: { th: "อยู่ เป็น 1 ใน 4 คำ", en: "อยู่ is one of 4" } },
      { q: "\"ขนม\" เป็นคำประเภทใด", c: ["คำควบกล้ำ", "อักษรนำ", "คำเป็น", "คำตาย"], a: 1, ex: { th: "ข นำ น = อักษรนำ", en: "leading consonant" } },
      { q: "ข้อใดเป็นคำควบไม่แท้", c: ["ครู", "กลาง", "สร้าง", "ปลา"], a: 2, ex: { th: "สร้าง อ่าน ส่าง", en: "สร้าง → ส่าง" } },
      { q: "คำว่า 'อย่า อยู่ อย่าง อยาก' มีกี่คำ", c: ["3", "4", "5", "6"], a: 1, ex: { th: "อ นำ ย มี 4 คำ", en: "4 words" } },
    ],
    fill: [
      { q: "\"ทรง\" อ่านออกเสียงขึ้นต้นด้วยเสียง ซ หรือ ท (ตอบ ซ/ท)", a: ["ซ"] },
      { q: "\"ครู\" เป็นคำควบแท้หรือไม่แท้ (ตอบ แท้/ไม่แท้)", a: ["แท้", "ควบแท้"] },
      { q: "คำ อ นำ ย มีทั้งหมดกี่คำ (ตัวเลข)", a: ["4", "สี่"] },
    ],
  },
  scith: {
    mcq: [
      { q: "พืชเริ่มต้นชีวิตจากอะไร", c: ["ดอก", "เมล็ด", "ผล", "ราก"], a: 1, ex: { th: "เมล็ด → ต้นอ่อน", en: "starts from a seed" } },
      { q: "ต้นอ่อนของพืชจะเติบโตเป็น", c: ["เมล็ด", "ต้นโต", "ดักแด้", "ลูกอ๊อด"], a: 1, ex: { th: "ต้นอ่อน → ต้นโต", en: "seedling → plant" } },
      { q: "เมล็ดงอกต้องการสิ่งใด", c: ["น้ำและอากาศ", "ความมืดเท่านั้น", "เสียงเพลง", "ไฟ"], a: 0, ex: { th: "น้ำ อากาศ อุณหภูมิเหมาะสม", en: "water & air" } },
      { q: "ระยะหลังต้นโตที่ใช้สืบพันธุ์คือ", c: ["เมล็ด", "ออกดอก", "ราก", "ใบ"], a: 1, ex: { th: "ต้นโต → ออกดอก → ติดผล", en: "flower → fruit" } },
      { q: "วัฏจักรพืชกับสัตว์เหมือนกันตรงที่", c: ["เกิด-โต-สืบพันธุ์", "บินได้", "ว่ายน้ำ", "กินเนื้อ"], a: 0, ex: { th: "ทั้งคู่มีวงจรชีวิต", en: "both have a life cycle" } },
    ],
    fill: [
      { q: "พืชเริ่มต้นชีวิตจาก___", a: ["เมล็ด"] },
      { q: "หลังออกดอกพืชจะติด___", a: ["ผล"] },
    ],
  },
  social: {
    mcq: [
      { q: "การตัดผมจัดเป็น", c: ["สินค้า", "บริการ", "ผู้ผลิต", "รายรับ"], a: 1, ex: { th: "บริการ = สิ่งที่คนทำให้", en: "a service" } },
      { q: "ข้าวสารจัดเป็น", c: ["สินค้า", "บริการ", "ผู้บริโภค", "การออม"], a: 0, ex: { th: "สินค้า = จับต้องได้", en: "a good" } },
      { q: "คนที่ซื้อของไปใช้เรียกว่า", c: ["ผู้ผลิต", "ผู้บริโภค", "พ่อค้า", "ช่าง"], a: 1, ex: { th: "ผู้บริโภค", en: "consumer" } },
      { q: "ทิศที่ดวงอาทิตย์ขึ้นคือ", c: ["เหนือ", "ใต้", "ตะวันออก", "ตะวันตก"], a: 2, ex: { th: "ขึ้นทางตะวันออก", en: "sun rises East" } },
      { q: "บนแผนที่ ด้านบนคือทิศใด", c: ["เหนือ", "ใต้", "ตะวันออก", "ตะวันตก"], a: 0, ex: { th: "แผนที่ บน = เหนือ", en: "top = North" } },
      { q: "การเก็บเงินไว้ใช้ยามจำเป็นเรียกว่า", c: ["รายจ่าย", "การออม", "การผลิต", "การซื้อ"], a: 1, ex: { th: "การออม", en: "saving" } },
      { q: "ทิศหลักมีกี่ทิศ", c: ["2", "4", "6", "8"], a: 1, ex: { th: "เหนือ ใต้ ออก ตก", en: "4 main directions" } },
      { q: "การสอนหนังสือจัดเป็น", c: ["สินค้า", "บริการ", "การออม", "รายจ่าย"], a: 1, ex: { th: "บริการ", en: "a service" } },
    ],
    fill: [
      { q: "ดวงอาทิตย์ตกทางทิศ___", a: ["ตะวันตก", "ตก"] },
      { q: "คนที่ผลิตสินค้าเรียกว่าผู้___", a: ["ผลิต", "ผู้ผลิต"] },
      { q: "ทิศหลักมีกี่ทิศ (ตัวเลข)", a: ["4", "สี่"] },
    ],
  },
  history: {
    mcq: [
      { q: "โบราณวัตถุเป็นหลักฐานชั้นใด", c: ["ชั้นต้น", "ชั้นรอง", "ไม่ใช่หลักฐาน", "ชั้นสาม"], a: 0, ex: { th: "ของจริง = ชั้นต้น", en: "artefact = primary" } },
      { q: "หนังสือเรียนเป็นหลักฐานชั้นใด", c: ["ชั้นต้น", "ชั้นรอง", "ชั้นสูง", "ไม่ใช่"], a: 1, ex: { th: "เขียนภายหลัง = ชั้นรอง", en: "textbook = secondary" } },
      { q: "คำบอกเล่าของผู้อยู่ในเหตุการณ์จริงเป็นหลักฐาน", c: ["ชั้นต้น", "ชั้นรอง", "เท็จ", "ชั้นสาม"], a: 0, ex: { th: "ผู้เห็นเหตุการณ์ = ชั้นต้น", en: "eyewitness = primary" } },
      { q: "ข้อใดเป็นหลักฐานชั้นรอง", c: ["จารึกหิน", "สารคดีทีวี", "ภาพถ่ายเก่า", "โบราณวัตถุ"], a: 1, ex: { th: "สารคดีทำภายหลัง", en: "documentary made later" } },
      { q: "เราศึกษาอดีตจากสิ่งใด", c: ["การเดา", "หลักฐาน", "ความฝัน", "การ์ตูน"], a: 1, ex: { th: "ใช้หลักฐานทางประวัติศาสตร์", en: "from evidence" } },
    ],
    fill: [
      { q: "จารึกและโบราณวัตถุเป็นหลักฐานชั้น___", a: ["ต้น", "ชั้นต้น"] },
      { q: "หนังสือเรียนเป็นหลักฐานชั้น___", a: ["รอง", "ชั้นรอง"] },
    ],
  },
  arts: {
    mcq: [
      { q: "แม่สีมีกี่สี", c: ["2", "3", "5", "7"], a: 1, ex: { th: "แดง เหลือง น้ำเงิน", en: "3 primaries" } },
      { q: "แดง + เหลือง = สีอะไร", c: ["เขียว", "ส้ม", "ม่วง", "น้ำตาล"], a: 1, ex: { th: "ได้สีส้ม", en: "orange" } },
      { q: "เหลือง + น้ำเงิน = สีอะไร", c: ["ส้ม", "ม่วง", "เขียว", "ชมพู"], a: 2, ex: { th: "ได้สีเขียว", en: "green" } },
      { q: "แดง + น้ำเงิน = สีอะไร", c: ["ม่วง", "ส้ม", "เขียว", "เทา"], a: 0, ex: { th: "ได้สีม่วง", en: "purple" } },
      { q: "ข้อใดเป็นสีวรรณะอุ่น", c: ["ฟ้า", "เขียว", "แดง", "ม่วง"], a: 2, ex: { th: "อุ่น: แดง ส้ม เหลือง", en: "warm: red" } },
      { q: "ข้อใดเป็นสีวรรณะเย็น", c: ["แดง", "ส้ม", "ฟ้า", "เหลือง"], a: 2, ex: { th: "เย็น: เขียว ฟ้า ม่วง", en: "cool: blue" } },
      { q: "การใช้ท่าทางสื่อความหมายในนาฏศิลป์เรียกว่า", c: ["ภาษาท่า", "ภาษามือคนหูหนวก", "ภาษาเขียน", "ภาษาพูด"], a: 0, ex: { th: "ภาษาท่า", en: "gesture language" } },
    ],
    fill: [
      { q: "แม่สีมีกี่สี (ตัวเลข)", a: ["3", "สาม"] },
      { q: "เหลือง + น้ำเงิน ได้สี___", a: ["เขียว"] },
      { q: "สีแดง ส้ม เหลือง จัดเป็นวรรณะ___ (อุ่น/เย็น)", a: ["อุ่น"] },
    ],
  },
};

/* ============ EXAM 2 — NEW TOPIC QUESTIONS (MORE4) ============ */
const MORE4 = {
  thai: {
    mcq: [
      { q: "จดหมายที่เขียนเมื่อไม่สบายจนมาเรียนไม่ได้เรียกว่า", c: ["จดหมายลากิจ", "จดหมายลาป่วย", "จดหมายเชิญ", "จดหมายขอบคุณ"], a: 1, ex: { th: "ป่วย = ลาป่วย", en: "sick = sick leave" } },
      { q: "คำลงท้ายจดหมายถึงครูที่สุภาพคือ", c: ["จากเพื่อน", "ด้วยความเคารพ", "แล้วเจอกัน", "บ๊ายบาย"], a: 1, ex: { th: "ใช้คำสุภาพกับครู", en: "polite closing" } },
      { q: "สิ่งที่ต้องมีในจดหมายลาคือ", c: ["เหตุผลและวันที่ลา", "ราคาของเล่น", "เบอร์โทรเพื่อน", "การบ้าน"], a: 0, ex: { th: "บอกเหตุผล+วันที่", en: "reason + dates" } },
      { q: "ส่วนแรกสุดของจดหมายควรเขียน", c: ["ลงชื่อ", "วันที่", "คำลงท้าย", "เนื้อความ"], a: 1, ex: { th: "ขึ้นต้นด้วยวันที่", en: "start with the date" } },
    ],
    fill: [
      { q: "ลาเพราะไม่สบาย = ลา___", a: ["ป่วย", "ลาป่วย"] },
      { q: "ลาเพราะมีธุระ = ลา___", a: ["กิจ", "ลากิจ"] },
    ],
  },
  math: {
    mcq: [
      { q: "1 เมตร เท่ากับกี่เซนติเมตร", c: ["10", "100", "1000", "50"], a: 1, ex: { th: "1 ม. = 100 ซม.", en: "1 m = 100 cm" } },
      { q: "2 เมตร = กี่เซนติเมตร", c: ["20", "200", "2000", "120"], a: 1, ex: { th: "2×100=200", en: "200 cm" } },
      { q: "150 ซม. = กี่เมตรกี่เซนติเมตร", c: ["1 ม. 50 ซม.", "15 ม.", "1 ม. 5 ซม.", "150 ม."], a: 0, ex: { th: "100+50", en: "1 m 50 cm" } },
      { q: "สามเหลี่ยมมีกี่ด้าน", c: ["2", "3", "4", "5"], a: 1, ex: { th: "3 ด้าน 3 มุม", en: "3 sides" } },
      { q: "รูปใดไม่มีมุมและไม่มีด้าน", c: ["สี่เหลี่ยม", "สามเหลี่ยม", "วงกลม", "ห้าเหลี่ยม"], a: 2, ex: { th: "วงกลมไม่มีมุม", en: "circle has none" } },
      { q: "รูปที่พับแล้วสองข้างซ้อนทับกันพอดีมี", c: ["แกนสมมาตร", "3 มิติ", "หลายสี", "จุด"], a: 0, ex: { th: "มีแกนสมมาตร", en: "line of symmetry" } },
      { q: "ครึ่งหนึ่งเขียนเป็นเศษส่วนคือ", c: ["1/4", "1/2", "2/1", "1/3"], a: 1, ex: { th: "ครึ่ง = 1/2", en: "half = 1/2" } },
      { q: "แบ่งพิซซา 4 ชิ้นเท่ากัน กิน 1 ชิ้น = กินไปเท่าใด", c: ["1/2", "1/3", "1/4", "3/4"], a: 2, ex: { th: "1 ใน 4 = 1/4", en: "1/4" } },
      { q: "เศษส่วน 3/4 อ่านว่า", c: ["สามส่วนสี่", "สี่ส่วนสาม", "สามสี่", "หนึ่งส่วนสี่"], a: 0, ex: { th: "3 ใน 4 ส่วน", en: "three quarters" } },
      { q: "สี่เหลี่ยมจัตุรัสมีกี่มุม", c: ["3", "4", "5", "6"], a: 1, ex: { th: "4 มุม 4 ด้าน", en: "4 corners" } },
      { q: "ตัวล่างของเศษส่วนบอกอะไร", c: ["แบ่งเป็นกี่ส่วนเท่ากัน", "เอามากี่ส่วน", "ราคา", "ความยาว"], a: 0, ex: { th: "ส่วน = แบ่งกี่ชิ้น", en: "denominator = parts" } },
      { q: "ห้องยาว 5 เมตร = กี่เซนติเมตร", c: ["50", "500", "5000", "55"], a: 1, ex: { th: "5×100=500", en: "500 cm" } },
    ],
    fill: [
      { q: "1 เมตร = ___ เซนติเมตร (ตัวเลข)", a: ["100", "หนึ่งร้อย"] },
      { q: "สี่เหลี่ยมมีกี่ด้าน (ตัวเลข)", a: ["4", "สี่"] },
      { q: "ครึ่งหนึ่งเขียนเป็นเศษส่วน = ___", a: ["1/2", "๑/๒"] },
      { q: "3 เมตร = ___ ซม. (ตัวเลข)", a: ["300"] },
    ],
  },
  science: {
    mcq: [
      { q: { th: "แรงคือสิ่งใด", en: "A force is…" }, c: [{ th: "การผลักหรือดึง", en: "a push or pull" }, { th: "สีชนิดหนึ่ง", en: "a colour" }, { th: "เสียง", en: "a sound" }, { th: "กลิ่น", en: "a smell" }], a: 0, ex: { th: "แรง = ผลัก/ดึง", en: "push or pull" } },
      { q: { th: "การเตะลูกบอลเป็นแรงชนิดใด", en: "Kicking a ball is which force?" }, c: [{ th: "แรงสัมผัส", en: "contact" }, { th: "แรงไม่สัมผัส", en: "non-contact" }, { th: "แรงแม่เหล็ก", en: "magnetic" }, { th: "ไม่มีแรง", en: "no force" }], a: 0, ex: { th: "ต้องแตะ = สัมผัส", en: "touch = contact" } },
      { q: { th: "แรงที่ดึงของตกลงพื้นคือ", en: "Force pulling things down" }, c: [{ th: "แรงแม่เหล็ก", en: "magnetism" }, { th: "แรงโน้มถ่วง", en: "gravity" }, { th: "แรงเสียดทาน", en: "friction" }, { th: "แรงลม", en: "wind" }], a: 1, ex: { th: "แรงโน้มถ่วง", en: "gravity" } },
      { q: { th: "แม่เหล็กดูดของที่ทำจาก", en: "Magnets attract things made of…" }, c: [{ th: "ไม้", en: "wood" }, { th: "พลาสติก", en: "plastic" }, { th: "เหล็ก", en: "iron" }, { th: "แก้ว", en: "glass" }], a: 2, ex: { th: "ดูดเหล็ก", en: "attracts iron" } },
      { q: { th: "ขั้วแม่เหล็กเหมือนกัน (N-N) จะ", en: "Same magnet poles (N-N) will…" }, c: [{ th: "ดูดกัน", en: "attract" }, { th: "ผลักกัน", en: "repel" }, { th: "ไม่มีอะไรเกิด", en: "nothing" }, { th: "ระเบิด", en: "explode" }], a: 1, ex: { th: "เหมือนผลัก", en: "same = repel" } },
      { q: { th: "แรงแม่เหล็กจัดเป็นแรงชนิดใด", en: "Magnetism is which force?" }, c: [{ th: "แรงสัมผัส", en: "contact" }, { th: "แรงไม่สัมผัส", en: "non-contact" }, { th: "ไม่ใช่แรง", en: "not a force" }, { th: "แรงเสียดทาน", en: "friction" }], a: 1, ex: { th: "ไม่ต้องแตะ", en: "no touch needed" } },
      { q: { th: "หน้าต่างทำจากแก้วเพราะ", en: "Windows use glass because…" }, c: [{ th: "โปร่งใสมองผ่านได้", en: "it's clear" }, { th: "อ่อนนุ่ม", en: "it's soft" }, { th: "ดูดแม่เหล็ก", en: "it's magnetic" }, { th: "ยืดหยุ่น", en: "it's stretchy" }], a: 0, ex: { th: "แก้วโปร่งใส", en: "glass is clear" } },
      { q: { th: "ขั้วต่างกัน (N-S) จะ", en: "Opposite poles (N-S) will…" }, c: [{ th: "ผลักกัน", en: "repel" }, { th: "ดูดกัน", en: "attract" }, { th: "ไม่มีอะไร", en: "nothing" }, { th: "หายไป", en: "vanish" }], a: 1, ex: { th: "ต่างดูด", en: "opposite attract" } },
    ],
    fill: [
      { q: { th: "แรง = การผลักหรือ___", en: "A force is a push or a ___" }, a: ["ดึง", "pull"] },
      { q: { th: "แม่เหล็กมีกี่ขั้ว (ตัวเลข)", en: "How many poles has a magnet?" }, a: ["2", "สอง"] },
      { q: { th: "แรงที่ดึงของตกพื้นคือแรงโน้ม___", en: "Force pulling things down is g____" }, a: ["ถ่วง", "gravity"] },
    ],
  },
  scith: {
    mcq: [
      { q: "แรงสัมผัสต้องทำอย่างไรกับวัตถุ", c: ["แตะหรือสัมผัส", "ไม่ต้องแตะ", "มองเฉย ๆ", "พูดใส่"], a: 0, ex: { th: "ต้องแตะ", en: "must touch" } },
      { q: "ตัวอย่างแรงไม่สัมผัสคือ", c: ["ผลักรถ", "ดึงเชือก", "แรงแม่เหล็ก", "เตะบอล"], a: 2, ex: { th: "แม่เหล็กไม่ต้องแตะ", en: "magnetism" } },
      { q: "แรงทำให้วัตถุเป็นอย่างไรได้", c: ["เคลื่อนที่/หยุด/เปลี่ยนทิศ", "เปลี่ยนสีเอง", "ส่งเสียง", "มีกลิ่น"], a: 0, ex: { th: "แรงเปลี่ยนการเคลื่อนที่", en: "changes motion" } },
      { q: "ของที่แม่เหล็กดูดไม่ติดคือ", c: ["ตะปูเหล็ก", "คลิปหนีบเหล็ก", "ยางลบ", "กรรไกรเหล็ก"], a: 2, ex: { th: "ยางไม่ใช่โลหะ", en: "rubber not metal" } },
      { q: "อากาศมีอยู่ทั่วไปและใช้เพื่อ", c: ["หายใจ", "กิน", "อ่านหนังสือ", "วาดรูป"], a: 0, ex: { th: "สิ่งมีชีวิตใช้อากาศหายใจ", en: "air for breathing" } },
    ],
    fill: [
      { q: "แรงที่ต้องแตะวัตถุเรียกแรง___", a: ["สัมผัส", "แรงสัมผัส"] },
      { q: "แม่เหล็กดูดของที่ทำจาก___", a: ["เหล็ก", "โลหะ"] },
    ],
  },
  social: {
    mcq: [
      { q: "ภาษีคือเงินที่ประชาชนจ่ายให้ใคร", c: ["ร้านค้า", "รัฐ/รัฐบาล", "เพื่อนบ้าน", "โรงเรียนเอกชน"], a: 1, ex: { th: "จ่ายให้รัฐ", en: "to the government" } },
      { q: "ภาษีนำไปใช้ทำอะไร", c: ["สร้างถนน โรงเรียน โรงพยาบาล", "ซื้อของเล่นให้เด็ก", "เที่ยวต่างประเทศ", "เก็บไว้เฉย ๆ"], a: 0, ex: { th: "พัฒนาส่วนรวม", en: "public services" } },
      { q: "ตอนซื้อของในร้าน เราจ่ายภาษีชนิดใด", c: ["ภาษีเงินได้", "ภาษีมูลค่าเพิ่ม", "ภาษีที่ดิน", "ไม่มีภาษี"], a: 1, ex: { th: "VAT", en: "VAT" } },
      { q: "การเสียภาษีเป็นสิ่งใด", c: ["หน้าที่ของพลเมืองดี", "การทำผิด", "เรื่องสนุก", "การเล่นเกม"], a: 0, ex: { th: "หน้าที่พลเมือง", en: "a citizen's duty" } },
    ],
    fill: [
      { q: "เงินที่ประชาชนจ่ายให้รัฐเรียกว่า___", a: ["ภาษี"] },
      { q: "ภาษีตอนซื้อของเรียกภาษีมูลค่า___", a: ["เพิ่ม"] },
    ],
  },
  history: {
    mcq: [
      { q: "คนโบราณมักตั้งถิ่นฐานใกล้อะไร", c: ["ภูเขาไฟ", "แหล่งน้ำ/แม่น้ำ", "ทะเลทราย", "ป่าลึก"], a: 1, ex: { th: "ใกล้น้ำเพื่อใช้ดื่ม-เพาะปลูก", en: "near water" } },
      { q: "เหตุใดจึงตั้งบ้านริมแม่น้ำ", c: ["ใช้ดื่ม เพาะปลูก เดินทาง", "เพราะน้ำท่วมสนุก", "เพราะสวยอย่างเดียว", "ไม่มีเหตุผล"], a: 0, ex: { th: "น้ำจำเป็นต่อชีวิต", en: "water is essential" } },
      { q: "ชุมชนพัฒนาจากเล็กไปใหญ่ตามลำดับใด", c: ["เมือง→หมู่บ้าน", "หมู่บ้าน→เมือง", "ป่า→ทะเล", "ไม่เปลี่ยน"], a: 1, ex: { th: "หมู่บ้าน → เมือง", en: "village → town" } },
      { q: "วัฒนธรรมของแต่ละชุมชนต่างกันเพราะ", c: ["สภาพแวดล้อมและความเชื่อ", "สีเสื้อ", "จำนวนรถ", "ยี่ห้อมือถือ"], a: 0, ex: { th: "ต่างตามพื้นที่-ความเชื่อ", en: "environment & belief" } },
    ],
    fill: [
      { q: "คนโบราณตั้งบ้านใกล้แหล่ง___", a: ["น้ำ", "แม่น้ำ"] },
      { q: "ชุมชนพัฒนาจากหมู่บ้านกลายเป็น___", a: ["เมือง"] },
    ],
  },
  arts: {
    mcq: [
      { q: "ไปโรงเรียนควรแต่งกายด้วยชุดใด", c: ["ชุดนอน", "ชุดนักเรียน", "ชุดว่ายน้ำ", "ชุดกีฬาเท่านั้น"], a: 1, ex: { th: "แต่งให้เหมาะโอกาส", en: "school uniform" } },
      { q: "กระดุมเสื้อหลุด ควรทำอย่างไร", c: ["ทิ้งเสื้อ", "เย็บติดด้วยเข็มและด้าย", "ใช้กาว", "ปล่อยไว้"], a: 1, ex: { th: "ซ่อมด้วยเข็มด้าย", en: "sew it on" } },
      { q: "แคนและโปงลางเป็นดนตรีของภาคใด", c: ["เหนือ", "อีสาน", "กลาง", "ใต้"], a: 1, ex: { th: "อีสาน", en: "Northeast" } },
      { q: "หนังตะลุงและโนราเป็นของภาคใด", c: ["เหนือ", "อีสาน", "กลาง", "ใต้"], a: 3, ex: { th: "ภาคใต้", en: "South" } },
      { q: "อยากวาดภาพสื่อความ 'สนุกสดใส' ควรใช้สี", c: ["สีสดใส", "สีดำมืด", "สีเทา", "ไม่มีสี"], a: 0, ex: { th: "สีสดใส = ร่าเริง", en: "bright = happy" } },
      { q: "เส้นโค้งนุ่มนวลสื่อความรู้สึกแบบใด", c: ["สงบ อ่อนโยน", "โกรธ รุนแรง", "ตื่นเต้น", "น่ากลัว"], a: 0, ex: { th: "โค้ง = สงบ", en: "curves = calm" } },
      { q: "ดนตรีล้านนา (สะล้อ ซึง) เป็นของภาคใด", c: ["เหนือ", "ใต้", "อีสาน", "กลาง"], a: 0, ex: { th: "ภาคเหนือ", en: "North" } },
    ],
    fill: [
      { q: "ไปโรงเรียนแต่งชุด___", a: ["นักเรียน", "ชุดนักเรียน"] },
      { q: "แคน โปงลาง เป็นดนตรีภาค___", a: ["อีสาน", "ตะวันออกเฉียงเหนือ"] },
      { q: "ซ่อมกระดุมใช้เข็มและ___", a: ["ด้าย"] },
    ],
  },
  english: {
    mcq: [
      { q: "Is there ___ juice?", c: ["some", "any", "a", "many"], a: 1, ex: { th: "คำถามใช้ any", en: "question → any" } },
      { q: "There is ___ milk in the glass.", c: ["any", "some", "a", "an"], a: 1, ex: { th: "บอกเล่าใช้ some", en: "positive → some" } },
      { q: "There isn't ___ bread.", c: ["some", "any", "a", "two"], a: 1, ex: { th: "ปฏิเสธใช้ any", en: "negative → any" } },
      { q: "She ___ going to swim.", c: ["am", "is", "are", "be"], a: 1, ex: { th: "she + is going to", en: "she → is" } },
      { q: "We ___ going to play football.", c: ["is", "am", "are", "be"], a: 2, ex: { th: "we + are going to", en: "we → are" } },
      { q: "'be going to' ใช้บอกอะไร", c: [{ th: "อดีต", en: "the past" }, { th: "แผนอนาคต", en: "future plans" }, { th: "ตอนนี้", en: "right now" }, { th: "ทุกวัน", en: "every day" }], a: 1, ex: { th: "แผนอนาคต", en: "future plans" } },
      { q: "Have you got ___ pens?", c: ["some", "any", "a", "an"], a: 1, ex: { th: "คำถาม → any", en: "question → any" } },
      { q: "I ___ going to read a book.", c: ["am", "is", "are", "be"], a: 0, ex: { th: "I + am going to", en: "I → am" } },
    ],
    fill: [
      { q: "Is there ___ water? (some/any)", a: ["any"] },
      { q: "There is ___ cheese. (some/any)", a: ["some"] },
      { q: "They ___ going to sing. (am/is/are)", a: ["are"] },
    ],
  },
  time: {
    mcq: [
      { q: "I ___ reading at 8 pm last night. (was/were)", c: ["was", "were", "am", "is"], a: 0, ex: { th: "I + was", en: "I → was" } },
      { q: "They ___ playing in the park.", c: ["was", "were", "is", "am"], a: 1, ex: { th: "they + were", en: "they → were" } },
      { q: "Where do we send letters?", c: ["hospital", "post office", "bank", "market"], a: 1, ex: { th: "ที่ทำการไปรษณีย์", en: "post office" } },
      { q: "Where do we buy medicine / see a doctor?", c: ["temple", "hospital", "park", "shop"], a: 1, ex: { th: "โรงพยาบาล", en: "hospital" } },
      { q: "She ___ eating dinner at 7. (past)", c: ["is", "was", "were", "are"], a: 1, ex: { th: "she + was", en: "she → was" } },
      { q: "Past continuous ใช้ was/were + ", c: ["กริยาช่อง 2", "กริยา + ing", "กริยาช่อง 3", "คำนาม"], a: 1, ex: { th: "was/were + V-ing", en: "was/were + verb-ing" } },
      { q: "We keep our money at the…", c: ["park", "bank", "temple", "market"], a: 1, ex: { th: "ธนาคาร", en: "bank" } },
    ],
    fill: [
      { q: "They ___ playing. (was/were)", a: ["were"] },
      { q: "I ___ sleeping. (was/were)", a: ["was"] },
      { q: "สถานที่ส่งจดหมายภาษาอังกฤษคือ post ___", a: ["office"] },
    ],
  },
  health: {
    mcq: [
      { q: "ป้องกันไข้หวัดทำได้โดย", c: ["ล้างมือ ใส่หน้ากาก พักผ่อน", "กินขนมเยอะ ๆ", "นอนดึก", "ไม่อาบน้ำ"], a: 0, ex: { th: "สุขนิสัยดีป้องกันหวัด", en: "good hygiene" } },
      { q: "ท้องเสียมักเกิดจาก", c: ["อาหาร/น้ำไม่สะอาด", "อ่านหนังสือ", "ออกกำลังกาย", "นอนพอ"], a: 0, ex: { th: "ของไม่สะอาด", en: "unclean food/water" } },
      { q: "ป้องกันฟันผุทำได้โดย", c: ["แปรงฟันวันละ 2 ครั้ง", "กินลูกอมทั้งวัน", "ไม่แปรงฟัน", "ดื่มน้ำหวานบ่อย"], a: 0, ex: { th: "แปรงฟัน ลดขนม", en: "brush twice, less sweets" } },
      { q: "\"จุดส่วนตัว\" ของร่างกายคือส่วนที่", c: ["มือและเท้า", "ชุดว่ายน้ำปิดไว้", "หน้าและผม", "แขนและขา"], a: 1, ex: { th: "ส่วนที่ชุดว่ายน้ำปิด", en: "areas a swimsuit covers" } },
      { q: "ถ้ามีคนทำให้เรารู้สึกไม่ปลอดภัย ควรทำอย่างไร", c: ["เก็บเป็นความลับ", "ปฏิเสธ หนี และบอกผู้ใหญ่ที่ไว้ใจ", "ทำตามเงียบ ๆ", "โทษตัวเอง"], a: 1, ex: { th: "ไม่-หนี-บอก", en: "No-Go-Tell" } },
      { q: "ถ้าเกิดเรื่องไม่ดีกับตัวเรา เป็นความผิดของใคร", c: ["ความผิดของเรา", "ไม่ใช่ความผิดของเราเลย", "ความผิดของเพื่อน", "ไม่มีใครช่วยได้"], a: 1, ex: { th: "ไม่ใช่ความผิดของเด็ก", en: "never the child's fault" } },
      { q: "ผู้ใหญ่ที่ไว้ใจได้เพื่อขอความช่วยเหลือคือ", c: ["คนแปลกหน้า", "พ่อ แม่ ครู", "ไม่มีใคร", "เพื่อนวัยเดียวกันเท่านั้น"], a: 1, ex: { th: "พ่อ แม่ ครู ญาติสนิท", en: "parents, teachers" } },
      { q: "กินอาหารครบ 5 หมู่ช่วยให้", c: ["แข็งแรง ไม่ป่วยง่าย", "ตัวเตี้ยลง", "ป่วยบ่อย", "ง่วงตลอด"], a: 0, ex: { th: "อาหารดี = แข็งแรง", en: "healthy food = strong" } },
    ],
    fill: [
      { q: "ป้องกันโรคง่าย ๆ คือล้าง___บ่อย ๆ", a: ["มือ"] },
      { q: "กฎความปลอดภัย 3 คำ: ไม่ – หนี – ___", a: ["บอก"] },
      { q: "ถ้ารู้สึกไม่ปลอดภัย ให้บอกผู้ใหญ่ที่ไว้___", a: ["ใจ", "ไว้ใจ"] },
    ],
  },
};

/* merge Term-1 second-half + exam-2 questions (tag term 2) */
SUBJECTS.forEach((s) => {
  [MORE3, MORE4].forEach((PACK) => {
    const extra = PACK[s.id];
    if (extra) {
      if (extra.mcq) s.mcq = s.mcq.concat(extra.mcq.map((q) => ({ ...q, term: 2 })));
      if (extra.fill) s.fill = s.fill.concat(extra.fill.map((q) => ({ ...q, term: 2 })));
    }
  });
});

/* assign stable ids */
SUBJECTS.forEach((s) => {
  s.mcq.forEach((q, i) => { q.qid = `${s.id}-m${i}`; q._sid = s.id; q.term = q.term || 1; });
  s.fill.forEach((q, i) => { q.qid = `${s.id}-f${i}`; q.term = q.term || 1; });
});
const ALL_MCQ = SUBJECTS.flatMap((s) => s.mcq);
const QID_MAP = Object.fromEntries(ALL_MCQ.map((q) => [q.qid, q]));

const QUIZ_LEN = 10, MOCK_LEN = 20, MATCH_LEN = 6;

/* ================= styling ================= */
const INK = "#22356B";
const PAPER = "#FDF9F0";

const css = `
@import url('https://fonts.googleapis.com/css2?family=Mitr:wght@400;500;600;700&display=swap');
.p3 { --paper:#FDF9F0; --ink:#22356B; --card:#ffffff; --line:rgba(34,53,107,0.13); --muted:#888; --gridline:rgba(34,53,107,0.05); }
.p3.dark { --paper:#12151F; --ink:#EAF0FB; --card:#1E2431; --line:rgba(255,255,255,0.14); --muted:#9AA6BD; --gridline:rgba(255,255,255,0.045); }
.p3 * { font-family: 'Mitr', 'Sarabun', 'Noto Sans Thai', 'Leelawadee UI', sans-serif; box-sizing: border-box; }
.p3 { min-height: 100vh; background: var(--paper); color: var(--ink);
  background-image: repeating-linear-gradient(transparent, transparent 34px, var(--gridline) 35px); }
.p3 button { font-family: 'Mitr', sans-serif; cursor: pointer; border: none; }
@keyframes popIn { from { transform: scale(.92); opacity: 0 } to { transform: scale(1); opacity: 1 } }
@keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }
@keyframes starPop { 0%{transform:scale(0) rotate(-30deg)} 70%{transform:scale(1.3)} 100%{transform:scale(1)} }
.pop { animation: popIn .25s ease; }
.shakeX { animation: shake .3s ease; }
.starPop { display:inline-block; animation: starPop .5s ease; }
@media (prefers-reduced-motion: reduce) { .pop,.shakeX,.starPop { animation: none; } }
.cardFlip { perspective: 900px; }
.cardInner { position: relative; width: 100%; height: 100%; transition: transform .45s; transform-style: preserve-3d; }
.cardInner.flipped { transform: rotateY(180deg); }
.cardFace { position: absolute; inset: 0; backface-visibility: hidden; display:flex; align-items:center; justify-content:center;
  border-radius: 20px; padding: 24px; text-align:center; }
.cardBack { transform: rotateY(180deg); }
`;

/* ================= small components ================= */
function Btn({ children, onClick, color = "var(--ink)", bg = "var(--card)", style = {}, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ background: bg, color, borderRadius: 16, padding: "12px 20px", fontSize: 17, fontWeight: 600, boxShadow: "0 3px 0 rgba(34,53,107,0.25)", opacity: disabled ? 0.5 : 1, ...style }}>
      {children}
    </button>
  );
}

function SpeakBtn({ text, lg, color = "#3E7BD6", size = 34 }) {
  if (!hasTTS) return null;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); speak(text, lg); }}
      aria-label="listen"
      style={{ width: size, height: size, borderRadius: size / 2, background: "var(--card)", color,
        border: `2px solid ${color}55`, boxShadow: "0 2px 0 rgba(34,53,107,0.12)",
        display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.5, lineHeight: 1, padding: 0, cursor: "pointer" }}
    >🔊</button>
  );
}

function TopBar({ lg, setLg, stars, onHome, title, dark, toggleDark }) {
  const t = UI[lg];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", position: "sticky", top: 0, zIndex: 5, background: "var(--paper)", borderBottom: `3px solid ${INK}22` }}>
      {onHome && (
        <button onClick={onHome} style={{ background: "var(--card)", borderRadius: 12, padding: "6px 12px", fontWeight: 700, color: "var(--ink)", boxShadow: "0 2px 0 rgba(34,53,107,0.2)" }}>← {t.home}</button>
      )}
      <div style={{ flex: 1, fontWeight: 700, fontSize: 18, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title || t.appTitle}</div>
      <div style={{ background: "var(--card)", borderRadius: 999, padding: "4px 12px", fontWeight: 700, boxShadow: "0 2px 0 rgba(34,53,107,0.2)" }} title={t.starBar}>⭐ {stars}</div>
      <button onClick={toggleDark} title={dark ? t.dayMode : t.nightMode}
        style={{ background: "var(--card)", color: "var(--ink)", borderRadius: 999, width: 34, height: 34, fontSize: 16, boxShadow: "0 2px 0 rgba(34,53,107,0.15)" }}>
        {dark ? "☀️" : "🌙"}
      </button>
      <button onClick={() => setLg(lg === "th" ? "en" : "th")}
        style={{ background: INK, color: "#fff", borderRadius: 999, padding: "6px 14px", fontWeight: 700 }}>
        {lg === "th" ? "EN" : "ไทย"}
      </button>
    </div>
  );
}

function ProgressDots({ n, i, color }) {
  return (
    <div style={{ display: "flex", gap: 5, justifyContent: "center", margin: "10px 0", flexWrap: "wrap" }}>
      {Array.from({ length: n }).map((_, k) => (
        <div key={k} style={{ width: 10, height: 10, borderRadius: 5, background: k <= i ? color : "var(--line)" }} />
      ))}
    </div>
  );
}

/* ================= modes ================= */
function Lesson({ subj, lg, onDone, exam }) {
  const t = UI[lg];
  const all = LESSONS[subj.id] || [];
  const sections = byExam(all, exam);
  const [i, setI] = useState(0);
  const s = sections[i] || sections[0];
  const asArr = (x) => (Array.isArray(x) ? x : x ? [x] : []);
  if (!s) {
    return (
      <div className="pop" style={{ padding: 24, maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: 40 }}>📖</div>
        <div style={{ fontSize: 17, marginTop: 8, color: "var(--muted)" }}>
          {lg === "th" ? "ยังไม่มีเนื้อหาส่วนอ่านสำหรับตัวกรองนี้" : "No reading content for this filter"}
        </div>
        <div style={{ marginTop: 16 }}><Btn bg={subj.color} color="#fff" onClick={() => onDone(null)}>{t.home}</Btn></div>
      </div>
    );
  }
  return (
    <div className="pop" style={{ padding: 16, maxWidth: 640, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {sections.map((_, k) => (
          <button key={k} onClick={() => setI(k)}
            style={{ width: 26, height: 26, borderRadius: 13, fontWeight: 700, fontSize: 13,
              background: k === i ? subj.color : "var(--card)", color: k === i ? "#fff" : "var(--ink)",
              border: `2px solid ${subj.color}`, boxShadow: "0 2px 0 rgba(34,53,107,0.15)" }}>
            {k + 1}
          </button>
        ))}
      </div>

      <div style={{ background: "var(--card)", borderRadius: 20, padding: "20px 22px", border: `3px solid ${subj.color}55`, boxShadow: "0 4px 0 rgba(34,53,107,0.12)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 21, fontWeight: 700, color: subj.color, flex: 1 }}>{T(s.h, lg)}</div>
          <SpeakBtn text={[T(s.h, lg)].concat(asArr(s.p).map((x) => T(x, lg))).concat(asArr(s.k).map((x) => T(x, lg))).join(". ")} lg={lg} color={subj.color} />
        </div>

        {asArr(s.p).map((para, k) => (
          <p key={k} style={{ fontSize: 16.5, lineHeight: 1.65, margin: "0 0 12px" }}>{T(para, lg)}</p>
        ))}

        {asArr(s.k).length > 0 && (
          <div style={{ background: `${subj.color}12`, borderRadius: 14, padding: "12px 14px", margin: "14px 0" }}>
            <div style={{ fontWeight: 700, color: subj.color, marginBottom: 8 }}>✦ {lg === "th" ? "ต้องจำ" : "Key points"}</div>
            {asArr(s.k).map((item, k) => (
              <div key={k} style={{ display: "flex", gap: 8, marginBottom: 7, fontSize: 15.5, lineHeight: 1.5 }}>
                <span style={{ color: subj.color, fontWeight: 700 }}>•</span>
                <span>{T(item, lg)}</span>
              </div>
            ))}
          </div>
        )}

        {asArr(s.ex).length > 0 && (
          <div style={{ margin: "14px 0" }}>
            <div style={{ fontWeight: 700, color: "#1F7A3D", marginBottom: 8 }}>✎ {lg === "th" ? "ตัวอย่าง + เฉลย" : "Examples + answers"}</div>
            {asArr(s.ex).map(([q, a], k) => (
              <div key={k} style={{ display: "flex", gap: 8, marginBottom: 7, fontSize: 15.5, lineHeight: 1.5 }}>
                <span>{k + 1}.</span>
                <span>{T(q, lg)} <span style={{ color: "#1F7A3D", fontWeight: 700 }}>➜ {T(a, lg)}</span></span>
              </div>
            ))}
          </div>
        )}

        {s.mem && (
          <div style={{ background: "#E8F0FE", borderLeft: "6px solid #3E7BD6", borderRadius: 10, padding: "10px 14px", marginTop: 14 }}>
            <span style={{ fontWeight: 700, color: "#1F4E9B" }}>🧠 {lg === "th" ? "เทคนิคจำ: " : "Memory trick: "}</span>
            <span style={{ color: "#1A3A6B", fontSize: 15.5 }}>{T(s.mem, lg)}</span>
          </div>
        )}

        {s.tip && (
          <div style={{ background: "#FFF3D6", borderLeft: "6px solid #E8A020", borderRadius: 10, padding: "10px 14px", marginTop: 14 }}>
            <span style={{ fontWeight: 700, color: "#B26A00" }}>⚠ {lg === "th" ? "ระวัง! " : "Watch out! "}</span>
            <span style={{ color: "#5A4300", fontSize: 15.5 }}>{T(s.tip, lg)}</span>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginTop: 18 }}>
        <Btn onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>← {t.back}</Btn>
        {i < sections.length - 1
          ? <Btn bg={subj.color} color="#fff" onClick={() => setI(i + 1)}>{t.next} →</Btn>
          : <Btn bg={subj.color} color="#fff" onClick={() => onDone(null)}>{t.finish} ✓</Btn>}
      </div>
    </div>
  );
}

function Flashcards({ subj, lg, onDone }) {
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const t = UI[lg];
  const [cards] = useState(() => shuffle(subj.flash));
  const c = cards[i];
  return (
    <div className="pop" style={{ padding: 16, maxWidth: 520, margin: "0 auto" }}>
      <ProgressDots n={cards.length} i={i} color={subj.color} />
      <div className="cardFlip" style={{ height: 260 }} onClick={() => setFlip(!flip)}>
        <div className={`cardInner ${flip ? "flipped" : ""}`}>
          <div className="cardFace" style={{ background: "var(--card)", border: `4px solid ${subj.color}`, boxShadow: "0 6px 0 rgba(34,53,107,0.15)" }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{T(c.f, lg)}</div>
              <div style={{ marginTop: 12 }}><SpeakBtn text={T(c.f, lg)} lg={lg} color={subj.color} /></div>
              <div style={{ marginTop: 10, fontSize: 13, color: "var(--muted)" }}>👆 {t.flip}</div>
            </div>
          </div>
          <div className="cardFace cardBack" style={{ background: subj.color, color: "#fff" }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{T(c.b, lg)}</div>
              <div style={{ marginTop: 12 }}><SpeakBtn text={T(c.b, lg)} lg={lg} color={subj.color} /></div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}>
        <Btn onClick={() => { setFlip(false); setI(Math.max(0, i - 1)); }} disabled={i === 0}>←</Btn>
        {i < cards.length - 1
          ? <Btn bg={subj.color} color="#fff" onClick={() => { setFlip(false); setI(i + 1); }}>{t.next} →</Btn>
          : <Btn bg={subj.color} color="#fff" onClick={() => onDone(null)}>{t.finish} ✓</Btn>}
      </div>
    </div>
  );
}

function Quiz({ questions, lg, color, instant = true, onDone, timedSec = null, title }) {
  const [i, setI] = useState(0);
  const [sel, setSel] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(timedSec);
  const [rightIds, setRightIds] = useState([]);
  const [wrongIds, setWrongIds] = useState([]);
  const t = UI[lg];
  const doneRef = useRef(false);
  const statRef = useRef({ right: [], wrong: [], score: 0 });

  useEffect(() => {
    if (timedSec == null) return;
    const id = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [timedSec]);

  useEffect(() => {
    if (timedSec != null && timeLeft <= 0 && !doneRef.current) {
      doneRef.current = true;
      const st = statRef.current;
      onDone({ score: st.score, total: null, timed: true, right: st.right, wrong: st.wrong, shown: [...st.right, ...st.wrong] });
    }
  }, [timeLeft]);

  const q = questions[i % questions.length];

  const pick = (k) => {
    if (sel !== null && instant) return;
    const correct = k === q.a;
    if (instant) {
      setSel(k);
      if (correct) { setRightIds((r) => [...r, q.qid]); statRef.current.right.push(q.qid); }
      else { setWrongIds((w) => [...w, q.qid]); statRef.current.wrong.push(q.qid); }
      if (timedSec != null) {
        const gained = correct ? 10 + (streak >= 2 ? 5 : 0) : 0;
        setScore((s) => s + gained);
        statRef.current.score += gained;
        setStreak(correct ? streak + 1 : 0);
        setTimeout(() => { setSel(null); setI(i + 1); }, correct ? 350 : 800);
      } else if (correct) setScore((s) => s + 1);
    } else {
      const next = [...answers]; next[i] = k; setAnswers(next);
      setSel(k);
    }
  };

  const goNext = () => {
    if (i + 1 >= questions.length) {
      if (instant) onDone({ score, total: questions.length, right: rightIds, wrong: wrongIds, shown: questions.map((x) => x.qid) });
      else {
        const right = [], wrong = [];
        questions.forEach((qq, k) => (answers[k] === qq.a ? right : wrong).push(qq.qid));
        onDone({ score: right.length, total: questions.length, right, wrong, shown: questions.map((x) => x.qid), review: questions.map((qq, k) => ({ q: qq, your: answers[k] })) });
      }
    } else { setSel(answers[i + 1] ?? null); setI(i + 1); }
  };

  const answered = sel !== null;
  return (
    <div className="pop" style={{ padding: 16, maxWidth: 560, margin: "0 auto" }}>
      {timedSec != null ? (
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 18 }}>
          <span>⏱ {Math.max(0, timeLeft)}s</span>
          <span>{t.streak}: {streak} 🔥</span>
          <span>{t.score}: {score}</span>
        </div>
      ) : (
        <ProgressDots n={questions.length} i={i} color={color} />
      )}
      <div style={{ background: "var(--card)", borderRadius: 20, padding: 20, marginTop: 10, border: `3px solid ${color}55`, boxShadow: "0 4px 0 rgba(34,53,107,0.12)" }}>
        <div style={{ fontSize: 13, color: "#888", fontWeight: 600 }}>{title || ""} {timedSec == null && `${t.question} ${i + 1}/${questions.length}`}</div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, margin: "8px 0 16px" }}>
          <div style={{ fontSize: 20, fontWeight: 700, flex: 1 }}>{T(q.q, lg)}</div>
          <SpeakBtn text={T(q.q, lg)} lg={lg} color={color} size={32} />
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {q.c.map((c, k) => {
            let bg = "var(--card)", bd = "var(--line)";
            if (answered && instant) {
              if (k === q.a) { bg = "#E3F6EA"; bd = "#3FA46A"; }
              else if (k === sel) { bg = "#FDE8E6"; bd = "#E8574B"; }
            } else if (k === sel) { bg = `${color}22`; bd = color; }
            return (
              <button key={k} onClick={() => pick(k)} className={answered && instant && k === sel && k !== q.a ? "shakeX" : ""}
                style={{ textAlign: "left", background: bg, border: `2.5px solid ${bd}`, borderRadius: 14, padding: "12px 14px", fontSize: 17, fontWeight: 600, color: "var(--ink)" }}>
                {String.fromCharCode(97 + k)}. {T(c, lg)}
              </button>
            );
          })}
        </div>
        {answered && instant && timedSec == null && (
          <div className="pop" style={{ marginTop: 14, background: sel === q.a ? "#E3F6EA" : "#FFF3D6", borderRadius: 12, padding: "10px 14px", fontWeight: 600 }}>
            {sel === q.a ? t.correct : `${t.wrong} — ${String.fromCharCode(97 + q.a)}. ${T(q.c[q.a], lg)}`}
            {q.ex && <div style={{ fontWeight: 400, marginTop: 4, fontSize: 15 }}>💡 {T(q.ex, lg)}</div>}
          </div>
        )}
      </div>
      {timedSec == null && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <Btn bg={color} color="#fff" onClick={goNext} disabled={sel === null}>
            {i + 1 >= questions.length ? (instant ? t.finish : t.submitExam) : t.next + " →"}
          </Btn>
        </div>
      )}
    </div>
  );
}

function Matching({ subj, lg, onDone }) {
  const t = UI[lg];
  const [pairs] = useState(() => shuffle(subj.match).slice(0, MATCH_LEN));
  const [left] = useState(() => shuffle(pairs.map((p, k) => ({ k, v: p[0] }))));
  const [right] = useState(() => shuffle(pairs.map((p, k) => ({ k, v: p[1] }))));
  const [selL, setSelL] = useState(null);
  const [selR, setSelR] = useState(null);
  const [done, setDone] = useState({});
  const [miss, setMiss] = useState(0);
  const [wrongPair, setWrongPair] = useState(null);
  const [sec, setSec] = useState(0);
  const finished = Object.keys(done).length === pairs.length;

  useEffect(() => {
    if (finished) return;
    const id = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [finished]);

  useEffect(() => {
    if (selL != null && selR != null) {
      if (selL === selR) {
        setDone((d) => ({ ...d, [selL]: true }));
        setSelL(null); setSelR(null);
      } else {
        setMiss((m) => m + 1);
        setWrongPair([selL, selR]);
        setTimeout(() => { setSelL(null); setSelR(null); setWrongPair(null); }, 500);
      }
    }
  }, [selL, selR]);

  const cell = (item, side) => {
    const isDone = done[item.k];
    const isSel = (side === "L" ? selL : selR) === item.k;
    const isWrong = wrongPair && ((side === "L" && wrongPair[0] === item.k) || (side === "R" && wrongPair[1] === item.k));
    return (
      <button key={side + item.k}
        onClick={() => !isDone && (side === "L" ? setSelL(item.k) : setSelR(item.k))}
        className={isWrong ? "shakeX" : ""}
        style={{
          padding: "12px 10px", borderRadius: 14, fontSize: 16, fontWeight: 600, color: isDone ? "#fff" : "var(--ink)",
          background: isDone ? "#3FA46A" : isWrong ? "#FDE8E6" : isSel ? `${subj.color}33` : "var(--card)",
          border: `2.5px solid ${isDone ? "#3FA46A" : isSel ? subj.color : "var(--line)"}`,
          transition: "all .15s",
        }}>
        {T(item.v, lg)}
      </button>
    );
  };

  return (
    <div className="pop" style={{ padding: 16, maxWidth: 620, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginBottom: 10 }}>
        <span>⏱ {sec}s</span><span>{t.mistakes}: {miss}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ display: "grid", gap: 10, alignContent: "start" }}>{left.map((x) => cell(x, "L"))}</div>
        <div style={{ display: "grid", gap: 10, alignContent: "start" }}>{right.map((x) => cell(x, "R"))}</div>
      </div>
      {finished && (
        <div className="pop" style={{ textAlign: "center", marginTop: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>🎉 {t.matched} ({sec}s, {t.mistakes} {miss})</div>
          <div style={{ marginTop: 12 }}>
            <Btn bg={subj.color} color="#fff" onClick={() => onDone({ score: miss <= 2 ? 1 : 0, total: 1, matchStat: { sec, miss } })}>{t.finish} ✓</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function FillIn({ items, color, lg, onDone }) {
  const t = UI[lg];
  const [i, setI] = useState(0);
  const [val, setVal] = useState("");
  const [state, setState] = useState(null);
  const [score, setScore] = useState(0);
  const [rightIds, setRightIds] = useState([]);
  const [wrongIds, setWrongIds] = useState([]);
  const q = items[i];

  const check = () => {
    const ok = q.a.some((a) => norm(a) === norm(val));
    setState(ok ? "ok" : "no");
    if (ok) { setScore((s) => s + 1); setRightIds((r) => [...r, q.qid]); }
    else setWrongIds((w) => [...w, q.qid]);
  };
  const next = () => {
    setVal(""); setState(null);
    if (i + 1 >= items.length) onDone({ score, total: items.length, right: rightIds, wrong: wrongIds, shown: items.map((x) => x.qid) });
    else setI(i + 1);
  };

  return (
    <div className="pop" style={{ padding: 16, maxWidth: 520, margin: "0 auto" }}>
      <ProgressDots n={items.length} i={i} color={color} />
      <div style={{ background: "var(--card)", borderRadius: 20, padding: 20, border: `3px solid ${color}55` }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 14 }}>{T(q.q, lg)}</div>
        <input
          value={val}
          onChange={(e) => { setVal(e.target.value); setState(null); }}
          onKeyDown={(e) => e.key === "Enter" && (state === null ? (val.trim() && check()) : next())}
          placeholder={t.typeHere}
          style={{ width: "100%", padding: "12px 14px", fontSize: 18, borderRadius: 12, border: `2.5px solid ${state === "ok" ? "#3FA46A" : state === "no" ? "#E8574B" : "var(--line)"}`, outline: "none", fontFamily: "'Mitr',sans-serif", background: state === "ok" ? "#E3F6EA" : state === "no" ? "#FDE8E6" : "var(--card)", color: "var(--ink)" }}
        />
        {state === "ok" && <div className="pop" style={{ marginTop: 10, fontWeight: 700, color: "#1F7A3D" }}>{t.correct}</div>}
        {state === "no" && <div className="shakeX" style={{ marginTop: 10, fontWeight: 600, color: "#B02E22" }}>{t.wrong} — 💡 {q.a[0]}</div>}
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        {state === null && <Btn bg={color} color="#fff" onClick={check} disabled={!val.trim()}>{t.check}</Btn>}
        {state !== null && <Btn bg={color} color="#fff" onClick={next}>{i + 1 >= items.length ? t.finish : t.next + " →"}</Btn>}
      </div>
    </div>
  );
}

function Results({ res, lg, color, onAgain, onHome, gotStar }) {
  const t = UI[lg];
  const pct = res.total ? Math.round((res.score / res.total) * 100) : null;
  const msg = res.timed ? (res.score >= 80 ? t.great : res.score >= 40 ? t.good : t.keep)
    : pct == null ? t.great : pct >= 70 ? t.great : pct >= 40 ? t.good : t.keep;
  return (
    <div className="pop" style={{ padding: 24, maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
      <div style={{ fontSize: 60 }} className="starPop">{gotStar ? "⭐" : pct != null && pct >= 40 ? "🌟" : "💪"}</div>
      <div style={{ fontSize: 26, fontWeight: 700, marginTop: 8 }}>
        {res.timed ? `${t.score}: ${res.score}` : res.total ? `${res.score} / ${res.total}${pct != null ? ` (${pct}%)` : ""}` : "✓"}
      </div>
      <div style={{ fontSize: 18, marginTop: 6 }}>{msg}</div>
      {res.matchStat && <div style={{ marginTop: 6, color: "#777" }}>⏱ {res.matchStat.sec}s • {t.mistakes} {res.matchStat.miss}</div>}
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}>
        <Btn onClick={onHome}>{t.home}</Btn>
        <Btn bg={color} color="#fff" onClick={onAgain}>{t.again} 🔁</Btn>
      </div>
      {res.review && (
        <div style={{ textAlign: "left", marginTop: 26 }}>
          <div style={{ fontWeight: 700, fontSize: 19, marginBottom: 10 }}>📖 {t.answerKey}</div>
          {res.review.map(({ q, your }, k) => {
            const ok = your === q.a;
            return (
              <div key={k} style={{ background: "var(--card)", borderRadius: 14, padding: 14, marginBottom: 10, borderLeft: `6px solid ${ok ? "#3FA46A" : "#E8574B"}` }}>
                <div style={{ fontWeight: 700 }}>{k + 1}. {T(q.q, lg)}</div>
                <div style={{ marginTop: 4, fontSize: 15 }}>
                  {ok ? "✅ " : "❌ "}{t.yourAns}: {your != null ? T(q.c[your], lg) : "—"}
                  {!ok && <span style={{ color: "#1F7A3D", fontWeight: 700 }}> → {T(q.c[q.a], lg)}</span>}
                </div>
                {q.ex && <div style={{ marginTop: 4, fontSize: 14, color: "#666" }}>💡 {T(q.ex, lg)}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ================= progress report (for parents) ================= */
function Report({ store, lg, onHome }) {
  const t = UI[lg];
  const rows = SUBJECTS.map((s) => {
    const st = store.stats[s.id] || { attempts: 0, correct: 0 };
    const seenC = s.mcq.filter((q) => store.seen[q.qid]).length;
    const acc = st.attempts ? Math.round((st.correct / st.attempts) * 100) : null;
    return { s, attempts: st.attempts, correct: st.correct, acc, seenC, total: s.mcq.length };
  });
  const totAtt = rows.reduce((a, r) => a + r.attempts, 0);
  const totCor = rows.reduce((a, r) => a + r.correct, 0);
  const overallAcc = totAtt ? Math.round((totCor / totAtt) * 100) : null;
  const practiced = rows.filter((r) => r.attempts > 0);
  const weak = [...practiced].sort((a, b) => (a.acc ?? 101) - (b.acc ?? 101)).slice(0, 3).filter((r) => r.acc != null && r.acc < 80);

  const accColor = (a) => a == null ? "var(--muted)" : a >= 80 ? "#2E9E5B" : a >= 50 ? "#E8A020" : "#E8574B";

  return (
    <div className="pop" style={{ padding: 16, maxWidth: 640, margin: "0 auto" }}>
      <div style={{ background: INK, color: "#fff", borderRadius: 20, padding: 18, marginBottom: 16, textAlign: "center" }}>
        <div style={{ fontSize: 15, opacity: 0.85 }}>{t.overall}</div>
        <div style={{ fontSize: 34, fontWeight: 700, marginTop: 2 }}>
          {overallAcc == null ? "—" : overallAcc + "%"}
        </div>
        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>
          {t.attempts} {totAtt} • {t.correctN} {totCor} • ⭐ {store.stars}
        </div>
      </div>

      {weak.length > 0 && (
        <div style={{ background: "#FFF3D6", borderLeft: "6px solid #E8A020", borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: "#B26A00", marginBottom: 4 }}>📌 {t.weakest}</div>
          <div style={{ color: "#5A4300", fontSize: 15 }}>
            {weak.map((r) => `${r.s.icon} ${T(r.s.name, lg)} (${r.acc}%)`).join("  •  ")}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 10, paddingBottom: 24 }}>
        {rows.map((r) => (
          <div key={r.s.id} style={{ background: "var(--card)", borderRadius: 14, padding: "12px 14px", borderLeft: `8px solid ${r.s.color}`, boxShadow: "0 3px 0 rgba(34,53,107,0.1)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 24 }}>{r.s.icon}</span>
              <span style={{ fontWeight: 700, flex: 1, fontSize: 15 }}>{T(r.s.name, lg)}</span>
              <span style={{ fontWeight: 700, fontSize: 20, color: accColor(r.acc) }}>
                {r.acc == null ? "—" : r.acc + "%"}
              </span>
            </div>
            <div style={{ marginTop: 8, height: 8, borderRadius: 4, background: "var(--line)", overflow: "hidden" }}>
              <div style={{ width: `${r.acc || 0}%`, height: "100%", background: accColor(r.acc), transition: "width .4s" }} />
            </div>
            <div style={{ marginTop: 6, fontSize: 12.5, color: "var(--muted)" }}>
              {r.attempts === 0 ? t.notYet : `${t.accuracy}: ${r.correct}/${r.attempts} • ${t.seenProgress} ${r.seenC}/${r.total}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================= main app ================= */
export default function P3ReviewApp() {
  const [lg, setLg] = useState("th");
  const [store, setStore] = useState({ stars: 0, seen: {}, wrong: [], stats: {}, dark: false, exam: "all" });
  const [view, setView] = useState({ screen: "home" });
  const t = UI[lg];

  useEffect(() => {
    loadStore().then((s) => {
      if (s) setStore({ stars: s.stars || 0, seen: s.seen || {}, wrong: (s.wrong || []).filter((id) => QID_MAP[id]), stats: s.stats || {}, dark: !!s.dark, exam: s.exam || "all" });
    });
  }, []);

  const update = (fn) => setStore((prev) => { const next = fn(prev); saveStore(next); return next; });
  const exam = store.exam || "all";

  const startMock = () => setView({ screen: "play", mode: "mock", qs: pickN(byExam(ALL_MCQ, exam), MOCK_LEN, store.seen) });
  const startTimedAll = () => setView({ screen: "play", mode: "timed", qs: shuffle(byExam(ALL_MCQ, exam)) });
  const startRedo = () => {
    const qs = shuffle(byExam(store.wrong.map((id) => QID_MAP[id]).filter(Boolean), exam)).slice(0, QUIZ_LEN);
    if (qs.length) setView({ screen: "play", mode: "redo", qs });
  };

  const finish = (res) => {
    if (res === null) { setView({ screen: "home" }); return; }
    let earned = false;
    if (res.timed) earned = res.score >= 80;
    else if (res.total) earned = res.score / res.total >= 0.7;
    update((prev) => {
      const seen = { ...prev.seen };
      (res.shown || []).forEach((id) => { if (id) seen[id] = (seen[id] || 0) + 1; });
      const wrong = new Set(prev.wrong);
      (res.wrong || []).forEach((id) => id && wrong.add(id));
      (res.right || []).forEach((id) => id && wrong.delete(id));
      // per-subject stats: subject id is the prefix before "-" in the qid
      const stats = { ...prev.stats };
      const bump = (id, correct) => {
        if (!id) return;
        const sid = String(id).split("-")[0];
        const cur = stats[sid] || { attempts: 0, correct: 0 };
        stats[sid] = { attempts: cur.attempts + 1, correct: cur.correct + (correct ? 1 : 0) };
      };
      (res.right || []).forEach((id) => bump(id, true));
      (res.wrong || []).forEach((id) => bump(id, false));
      return { ...prev, seen, wrong: [...wrong], stats, stars: prev.stars + (earned ? 1 : 0) };
    });
    setView((v) => ({ ...v, screen: "results", res, gotStar: earned }));
  };

  const again = () => {
    const v = view;
    if (v.mode === "mock") startMock();
    else if (v.mode === "redo") startRedo();
    else if (v.mode === "timed" && !v.subj) startTimedAll();
    else if (v.mode === "quiz") setView({ screen: "play", mode: "quiz", subj: v.subj, qs: pickN(byExam(v.subj.mcq, exam), QUIZ_LEN, store.seen) });
    else if (v.mode === "timed") setView({ screen: "play", mode: "timed", subj: v.subj, qs: shuffle(byExam(v.subj.mcq, exam)) });
    else if (v.mode === "fill") setView({ screen: "play", mode: "fill", subj: v.subj, qs: pickN(byExam(v.subj.fill, exam), QUIZ_LEN, store.seen) });
    else setView({ screen: "play", mode: v.mode, subj: v.subj });
  };

  const startMode = (m, subj) => {
    if (m === "quiz") setView({ screen: "play", mode: "quiz", subj, qs: pickN(byExam(subj.mcq, exam), QUIZ_LEN, store.seen) });
    else if (m === "timed") setView({ screen: "play", mode: "timed", subj, qs: shuffle(byExam(subj.mcq, exam)) });
    else if (m === "fill") setView({ screen: "play", mode: "fill", subj, qs: pickN(byExam(subj.fill, exam), QUIZ_LEN, store.seen) });
    else setView({ screen: "play", mode: m, subj, exam });
  };

  const resetAll = () => {
    if (window.confirm(t.resetConfirm)) update((prev) => ({ stars: 0, seen: {}, wrong: [], stats: {}, dark: prev.dark, exam: prev.exam }));
  };

  const doBackup = () => {
    try {
      const code = btoa(unescape(encodeURIComponent(JSON.stringify(store))));
      const copied = (txt) => {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).catch(() => {});
      };
      copied(code);
      window.prompt(t.backupPrompt, code);
    } catch { /* ignore */ }
  };

  const doRestore = () => {
    const code = window.prompt(t.restorePrompt, "");
    if (!code) return;
    try {
      const obj = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
      if (obj && typeof obj.stars === "number") {
        update((prev) => ({ stars: obj.stars || 0, seen: obj.seen || {}, wrong: (obj.wrong || []).filter((id) => QID_MAP[id]), stats: obj.stats || {}, dark: prev.dark }));
        window.alert(t.restoreOk);
      } else window.alert(t.restoreFail);
    } catch { window.alert(t.restoreFail); }
  };

  const MODES = [
    { id: "read", icon: "📖", label: t.read },
    { id: "flash", icon: "🃏", label: t.flash },
    { id: "quiz", icon: "✅", label: t.quiz },
    { id: "match", icon: "🔗", label: t.match },
    { id: "fill", icon: "✏️", label: t.fill },
    { id: "timed", icon: "⏱", label: t.timed },
  ];

  const totalMcq = byExam(ALL_MCQ, exam).length;
  const totalSeen = byExam(ALL_MCQ, exam).filter((q) => store.seen[q.qid]).length;
  const setExam = (e) => update((prev) => ({ ...prev, exam: e }));

  return (
    <div className={"p3" + (store.dark ? " dark" : "")}>
      <style>{css}</style>
      <TopBar
        lg={lg} setLg={setLg} stars={store.stars}
        dark={store.dark} toggleDark={() => update((prev) => ({ ...prev, dark: !prev.dark }))}
        onHome={view.screen !== "home" ? () => setView({ screen: "home" }) : null}
        title={view.subj ? `${view.subj.icon} ${T(view.subj.name, lg)}` : view.mode === "mock" ? `📝 ${t.mock}` : view.mode === "redo" ? `🔁 ${t.redo}` : view.mode === "report" ? `📊 ${t.report}` : view.mode === "timed" && view.screen !== "home" ? `⏱ ${t.timed}` : null}
      />

      {view.screen === "home" && (
        <div className="pop" style={{ padding: 16, maxWidth: 640, margin: "0 auto" }}>
          <div style={{ textAlign: "center", margin: "8px 0 2px", fontSize: 30, fontWeight: 700 }}>
            {t.appTitle} <span className="starPop">✏️</span>
          </div>
          <div style={{ textAlign: "center", color: "var(--muted)", marginBottom: 10 }}>{t.appSub}</div>

          <div style={{ display: "flex", gap: 6, background: "var(--line)", borderRadius: 999, padding: 4, marginBottom: 8 }}>
            {[["all", t.examAll], ["1", t.exam1], ["2", t.exam2]].map(([val, lbl]) => (
              <button key={val} onClick={() => setExam(val)}
                style={{ flex: 1, borderRadius: 999, padding: "8px 4px", fontWeight: 700, fontSize: 14,
                  background: exam === val ? INK : "transparent", color: exam === val ? "#fff" : "var(--ink)", transition: "all .15s" }}>
                {lbl}
              </button>
            ))}
          </div>
          <div style={{ textAlign: "center", fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
            {t.seenProgress}: {totalSeen}/{totalMcq}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <button onClick={startMock} style={{ background: INK, color: "#fff", borderRadius: 20, padding: 18, textAlign: "left", boxShadow: "0 4px 0 rgba(0,0,0,0.25)" }}>
              <div style={{ fontSize: 26 }}>📝</div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{t.mock}</div>
              <div style={{ fontSize: 13, opacity: 0.85 }}>{t.mockSub}</div>
            </button>
            <button onClick={startTimedAll} style={{ background: "#E8574B", color: "#fff", borderRadius: 20, padding: 18, textAlign: "left", boxShadow: "0 4px 0 rgba(0,0,0,0.25)" }}>
              <div style={{ fontSize: 26 }}>⏱</div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{t.timed}</div>
              <div style={{ fontSize: 13, opacity: 0.9 }}>{t.timedSub}</div>
            </button>
          </div>

          {(() => {
          const wrongN = byExam(store.wrong.map((id) => QID_MAP[id]).filter(Boolean), exam).length;
          return (
          <button onClick={startRedo} disabled={wrongN === 0}
            style={{ width: "100%", background: wrongN ? "#F5B82E" : "var(--line)", color: wrongN ? INK : "var(--muted)", borderRadius: 20, padding: 16, textAlign: "left", boxShadow: wrongN ? "0 4px 0 rgba(0,0,0,0.15)" : "none", marginBottom: 20, cursor: wrongN ? "pointer" : "default" }}>
            <span style={{ fontSize: 22, marginRight: 10 }}>🔁</span>
            <span style={{ fontWeight: 700, fontSize: 18 }}>
              {t.redo} {wrongN > 0 ? `(${wrongN})` : ""}
            </span>
            <div style={{ fontSize: 13, opacity: 0.8, marginLeft: 32 }}>{wrongN ? t.redoSub : t.noWrong}</div>
          </button>
          ); })()}

          <button onClick={() => setView({ screen: "report" })}
            style={{ width: "100%", background: "var(--card)", color: "var(--ink)", borderRadius: 20, padding: 16, textAlign: "left", border: `2px solid ${INK}22`, boxShadow: "0 3px 0 rgba(34,53,107,0.12)", marginBottom: 20 }}>
            <span style={{ fontSize: 22, marginRight: 10 }}>📊</span>
            <span style={{ fontWeight: 700, fontSize: 18 }}>{t.report}</span>
            <div style={{ fontSize: 13, color: "var(--muted)", marginLeft: 32 }}>{t.reportSub}</div>
          </button>

          <div style={{ fontWeight: 700, fontSize: 19, marginBottom: 2 }}>📂 {t.pickSubject}</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>
            {lg === "th" ? "แตะวิชาเพื่อ 📖 อ่านเนื้อหา หรือทำแบบฝึกหัด" : "Tap a subject to 📖 read the lesson or practise"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, paddingBottom: 10 }}>
            {SUBJECTS.map((s) => {
              const pool = byExam(s.mcq, exam);
              const seenC = pool.filter((q) => store.seen[q.qid]).length;
              const pct = pool.length ? Math.round((seenC / pool.length) * 100) : 0;
              return (
                <button key={s.id} onClick={() => setView({ screen: "modes", subj: s })}
                  style={{ background: "var(--card)", borderRadius: 18, padding: "16px 12px 12px", textAlign: "center", borderTop: `10px solid ${s.color}`, boxShadow: "0 4px 0 rgba(34,53,107,0.15)", color: "var(--ink)" }}>
                  <div style={{ fontSize: 34 }}>{s.icon}</div>
                  <div style={{ fontWeight: 700, marginTop: 6, fontSize: 15, lineHeight: 1.3 }}>{T(s.name, lg)}</div>
                  <div style={{ marginTop: 8, height: 6, borderRadius: 3, background: "var(--line)", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: s.color, transition: "width .3s" }} />
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>{seenC}/{pool.length}</div>
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 8, marginBottom: 4 }}>
            <button onClick={doBackup} style={{ background: "var(--card)", color: "var(--ink)", fontSize: 13, fontWeight: 600, borderRadius: 12, padding: "8px 14px", border: `2px solid ${INK}22`, boxShadow: "0 2px 0 rgba(34,53,107,0.12)" }}>
              💾 {t.backup}
            </button>
            <button onClick={doRestore} style={{ background: "var(--card)", color: "var(--ink)", fontSize: 13, fontWeight: 600, borderRadius: 12, padding: "8px 14px", border: `2px solid ${INK}22`, boxShadow: "0 2px 0 rgba(34,53,107,0.12)" }}>
              ♻️ {t.restore}
            </button>
          </div>

          <div style={{ textAlign: "center", paddingBottom: 30 }}>
            <button onClick={resetAll} style={{ background: "none", color: "#bbb", fontSize: 13, textDecoration: "underline" }}>
              {t.resetProgress}
            </button>
          </div>
        </div>
      )}

      {view.screen === "modes" && (
        <div className="pop" style={{ padding: 16, maxWidth: 520, margin: "0 auto" }}>
          <div style={{ textAlign: "center", fontSize: 44 }}>{view.subj.icon}</div>
          <div style={{ textAlign: "center", fontWeight: 700, fontSize: 22, marginBottom: 4 }}>{T(view.subj.name, lg)}</div>
          <div style={{ textAlign: "center", color: "#777", marginBottom: 16 }}>{t.chooseMode}</div>
          <div style={{ display: "grid", gap: 12 }}>
            {MODES.map((m) => (
              <button key={m.id} onClick={() => startMode(m.id, view.subj)}
                style={{ background: "var(--card)", borderRadius: 16, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, border: `2.5px solid ${view.subj.color}44`, boxShadow: "0 3px 0 rgba(34,53,107,0.12)", color: "var(--ink)" }}>
                <span style={{ fontSize: 26 }}>{m.icon}</span>
                <span style={{ fontWeight: 700, fontSize: 18 }}>{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {view.screen === "report" && <Report store={store} lg={lg} onHome={() => setView({ screen: "home" })} />}

      {view.screen === "play" && view.mode === "read" && <Lesson subj={view.subj} lg={lg} onDone={finish} exam={exam} />}
      {view.screen === "play" && view.mode === "flash" && <Flashcards subj={view.subj} lg={lg} onDone={finish} />}
      {view.screen === "play" && view.mode === "quiz" && <Quiz questions={view.qs} lg={lg} color={view.subj.color} instant onDone={finish} />}
      {view.screen === "play" && view.mode === "redo" && <Quiz questions={view.qs} lg={lg} color="#F5B82E" instant onDone={finish} />}
      {view.screen === "play" && view.mode === "match" && <Matching subj={view.subj} lg={lg} onDone={finish} />}
      {view.screen === "play" && view.mode === "fill" && <FillIn items={view.qs} color={view.subj.color} lg={lg} onDone={finish} />}
      {view.screen === "play" && view.mode === "timed" && <Quiz questions={view.qs} lg={lg} color={view.subj ? view.subj.color : "#E8574B"} instant timedSec={60} onDone={finish} />}
      {view.screen === "play" && view.mode === "mock" && <Quiz questions={view.qs} lg={lg} color={INK} instant={false} onDone={finish} />}

      {view.screen === "results" && (
        <Results res={view.res} lg={lg} gotStar={view.gotStar}
          color={view.subj ? view.subj.color : INK}
          onAgain={again}
          onHome={() => setView({ screen: "home" })} />
      )}
    </div>
  );
}
