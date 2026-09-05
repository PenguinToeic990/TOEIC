'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

declare global {
  interface Document { modelContext?: { registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void> } }
}

type Skill = { en: string; zh: string; part: string; approx: string };
const listeningSkills: Skill[] = [
  { en: 'Can infer gist, purpose and context in short spoken texts', zh: '能從簡短口語內容推論主旨、目的與基本情境', part: 'Part 2', approx: '約 10～15 題' },
  { en: 'Can infer gist, purpose and context in extended spoken texts', zh: '能從較長口語內容推論主旨、目的與基本情境', part: 'Part 3 / Part 4', approx: '約 15～22 題' },
  { en: 'Can understand details in short spoken texts', zh: '能理解簡短口語內容中的細節', part: 'Part 1 / Part 2', approx: '約 15～22 題' },
  { en: 'Can understand details in extended spoken texts', zh: '能理解較長口語內容中的細節', part: 'Part 3 / Part 4', approx: '約 30～40 題' },
  { en: 'Can understand a speaker’s purpose or implied meaning', zh: '能理解說話者的目的或隱含意義', part: 'Part 2 / Part 3 / Part 4', approx: '約 10～18 題' },
];
const readingSkills: Skill[] = [
  { en: 'Can make inferences based on information in written texts', zh: '能根據書面內容進行推論', part: 'Part 6 / Part 7', approx: '約 12～18 題' },
  { en: 'Can locate and understand specific information in written texts', zh: '能找出並理解書面內容中的特定資訊', part: 'Part 6 / Part 7', approx: '約 20～28 題' },
  { en: 'Can connect information across sentences and texts', zh: '能串連單一或多篇文章中的資訊', part: 'Part 7', approx: '約 12～20 題' },
  { en: 'Can understand vocabulary in written texts', zh: '能理解書面內容中的字彙', part: 'Part 5 / Part 6 / Part 7', approx: '約 17～23 題' },
  { en: 'Can understand grammar in written texts', zh: '能理解書面內容中的文法', part: 'Part 5 / Part 6', approx: '約 20～26 題' },
];
const defaults = { listening: [100, 100, 93, 93, 100], reading: [95, 100, 96, 100, 100] };
const difficultyOptions = [
  { value: 'very-hard', label: '超難', offset: -2 }, { value: 'hard', label: '難', offset: -1 },
  { value: 'normal', label: '普通', offset: 0 }, { value: 'easy', label: '簡單', offset: 1 },
  { value: 'very-easy', label: '超簡單', offset: 2 },
] as const;
type Difficulty = typeof difficultyOptions[number]['value'];
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const difficultyOffset = (difficulty: Difficulty) => difficultyOptions.find(option => option.value === difficulty)?.offset ?? 0;
const estimateListening = (score: number, difficulty: Difficulty) => Number(clamp((score - 5 * 5 + difficultyOffset(difficulty) * 5) / 5, 0, 100).toFixed(1));
const estimateReading = (score: number, difficulty: Difficulty) => Number(clamp((score - 0 * 5 + difficultyOffset(difficulty) * 5) / 5, 0, 100).toFixed(1));
function distributeByPart(total: number, maxima: number[]) {
  const maximum = maxima.reduce((a, b) => a + b, 0), target = Math.round(clamp(total, 0, maximum));
  const exact = maxima.map(max => target * max / maximum), values = exact.map(Math.floor);
  let remaining = target - values.reduce((a, b) => a + b, 0);
  exact.map((value, i) => ({ i, fraction: value - Math.floor(value) })).sort((a, b) => b.fraction - a.fraction).forEach(({ i }) => { if (remaining > 0 && values[i] < maxima[i]) { values[i]++; remaining--; } });
  return values;
}

function DifficultySelect({ label, value, onChange }: { label: string; value: Difficulty; onChange: (value: Difficulty) => void }) {
  return <div className="difficulty-group"><label>{label}</label><Select value={value} onValueChange={(next) => onChange(next as Difficulty)}><SelectTrigger className="difficulty-trigger"><SelectValue /></SelectTrigger><SelectContent>{difficultyOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>;
}

function ScoreRow({ label, zh, score, onChange, tone }: { label: string; zh: string; score: number; onChange: (v: number) => void; tone: string }) {
  const [draft, setDraft] = useState(String(score));
  useEffect(() => { setDraft(String(score)); }, [score]);
  const commitScore = () => {
    const parsed = Number(draft);
    const normalized = Number.isFinite(parsed) && draft.trim() !== "" ? clamp(Math.round(parsed / 5) * 5, 5, 495) : score;
    setDraft(String(normalized));
    onChange(normalized);
  };
  const pos = ((score - 5) / 490) * 100;
  return <section className="score-row">
    <div className="score-heading"><div className={`score-label ${tone}`}>{label}</div>
      <label className="score-input"><span>YOUR SCORE<small>你的分數</small></span><input aria-label={`${zh}分數`} type="number" min="5" max="495" step="5" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commitScore} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} /><span className="score-steppers"><button type="button" aria-label={`${zh}增加 5 分`} disabled={score >= 495} onClick={() => onChange(clamp(score + 5, 5, 495))}>▲</button><button type="button" aria-label={`${zh}減少 5 分`} disabled={score <= 5} onClick={() => onChange(clamp(score - 5, 5, 495))}>▼</button></span></label>
    </div>
    <div className="score-control">
      <div className="track-wrap"><span>5</span><div className="score-track"><i style={{ width: `${pos}%` }} /><b style={{ left: `${pos}%` }}>{score}</b></div><span>495</span></div>
    </div>
  </section>;
}

function AbilityPanel({ title, zh, color, skills, values, onChange }: { title: string; zh: string; color: string; skills: Skill[]; values: number[]; onChange: (index: number, value: number) => void }) {
  return <section className={`ability-panel ${color}`}>
    <header><div><strong>{title}</strong><span>{zh}</span></div><p>TOEIC PART<br/><small>對應多益 Part</small></p><p>PERCENT CORRECT<br/><small>能力指標答對百分比</small></p></header>
    {skills.map((skill, i) => <div className="ability-row" key={skill.en}>
      <div className="ability-copy"><p>{skill.en}</p><span>{skill.zh}</span></div>
      <div className="ability-part"><strong>{skill.part}</strong><span>{skill.approx}</span></div>
      <div className="percent-control"><label><input aria-label={`${skill.zh}百分比`} type="number" min="0" max="100" value={values[i]} onChange={(e) => onChange(i, clamp(Number(e.target.value), 0, 100))}/><span className="percent-steppers"><button type="button" aria-label={`${skill.zh}增加 1%`} disabled={values[i] >= 100} onClick={() => onChange(i, clamp(values[i] + 1, 0, 100))}>▲</button><button type="button" aria-label={`${skill.zh}減少 1%`} disabled={values[i] <= 0} onClick={() => onChange(i, clamp(values[i] - 1, 0, 100))}>▼</button></span><em>%</em></label>
        <div className="percent-track"><i style={{width: `${values[i]}%`}} /></div><div className="ends"><span>0%</span><span>100%</span></div>
      </div>
    </div>)}
  </section>;
}

export default function Home() {
  const [listeningScore, setListeningScore] = useState(495), [readingScore, setReadingScore] = useState(495);
  const [listening, setListening] = useState(defaults.listening), [reading, setReading] = useState(defaults.reading);
  const [listeningDifficulty, setListeningDifficulty] = useState<Difficulty>('normal'), [readingDifficulty, setReadingDifficulty] = useState<Difficulty>('normal');
  const [isGenerating, setIsGenerating] = useState(false);
  const [chineseName, setChineseName] = useState('假企鵝'), [englishName, setEnglishName] = useState('FAKE PEN-GUIN');
  const pageRef = useRef<HTMLElement>(null);
  const result = useMemo(() => ({ listening: estimateListening(listeningScore, listeningDifficulty), reading: estimateReading(readingScore, readingDifficulty) }), [listeningScore, readingScore, listeningDifficulty, readingDifficulty]);
  const listeningParts = useMemo(() => distributeByPart(result.listening, [6, 25, 39, 30]), [result.listening]);
  const readingParts = useMemo(() => distributeByPart(result.reading, [30, 16, 54]), [result.reading]);
  const update = (setter: React.Dispatch<React.SetStateAction<number[]>>) => (index: number, value: number) => setter(old => old.map((v, i) => i === index ? value : v));
  const generatePdf = async () => {
    if (isGenerating || !pageRef.current) return;
    setIsGenerating(true);
    try {
      await document.fonts.ready;
      pageRef.current.classList.add('pdf-exporting');
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const [{ toCanvas }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
      const canvas = await toCanvas(pageRef.current, { pixelRatio: 1.5, backgroundColor: '#f5f0e7', filter: (node) => !(node instanceof HTMLElement && node.classList.contains('generate-bar')) });
      const image = canvas.toDataURL('image/jpeg', .94);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = 210, pageHeight = 297, imageHeight = canvas.height * pageWidth / canvas.width;
      let offset = 0;
      while (offset < imageHeight) { if (offset > 0) pdf.addPage(); pdf.addImage(image, 'JPEG', 0, -offset, pageWidth, imageHeight); offset += pageHeight; }
      pdf.save(`TOEIC-答對題數估算-${listeningScore + readingScore}.pdf`);
    } catch (error) {
      console.error(error);
      alert('無法生成檔案，請重新整理頁面後再試一次。');
    } finally { pageRef.current?.classList.remove('pdf-exporting'); setIsGenerating(false); }
  };
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const isPercentages = (value: unknown): value is number[] => Array.isArray(value) && value.length === 5 && value.every(v => typeof v === 'number' && v >= 0 && v <= 100);
    void Promise.resolve(context.registerTool({
      name: 'calculate_toeic_correct_answers', title: '計算多益答對題數',
      description: '輸入聽力與閱讀分數及各五項能力百分比，更新畫面並回傳估算答對題數。',
      inputSchema: { type: 'object', properties: { listeningScore: { type: 'number', minimum: 5, maximum: 495 }, readingScore: { type: 'number', minimum: 5, maximum: 495 }, listeningDifficulty: { type: 'string', enum: difficultyOptions.map(x => x.value) }, readingDifficulty: { type: 'string', enum: difficultyOptions.map(x => x.value) }, listeningPercentages: { type: 'array', minItems: 5, maxItems: 5, items: { type: 'number', minimum: 0, maximum: 100 } }, readingPercentages: { type: 'array', minItems: 5, maxItems: 5, items: { type: 'number', minimum: 0, maximum: 100 } } }, required: ['listeningScore','readingScore','listeningPercentages','readingPercentages'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input: unknown) {
        const x = input as Record<string, unknown>;
        if (typeof x.listeningScore !== 'number' || x.listeningScore < 5 || x.listeningScore > 495 || typeof x.readingScore !== 'number' || x.readingScore < 5 || x.readingScore > 495 || !isPercentages(x.listeningPercentages) || !isPercentages(x.readingPercentages)) throw new Error('分數或百分比超出有效範圍');
        const ld = difficultyOptions.some(o => o.value === x.listeningDifficulty) ? x.listeningDifficulty as Difficulty : 'normal';
        const rd = difficultyOptions.some(o => o.value === x.readingDifficulty) ? x.readingDifficulty as Difficulty : 'normal';
        setListeningScore(x.listeningScore); setReadingScore(x.readingScore); setListening(x.listeningPercentages); setReading(x.readingPercentages); setListeningDifficulty(ld); setReadingDifficulty(rd);
        const l = estimateListening(x.listeningScore, ld), r = estimateReading(x.readingScore, rd);
        return { listeningCorrect: l, readingCorrect: r, totalCorrect: l + r };
      }
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);
  return <main ref={pageRef}><div className="topbar"><span>TOEIC® SCORE ESTIMATOR</span><span>多益答對題數計算器</span></div><div className="page-shell">
    <header className="intro"><div><span className="eyebrow">TEST DIFFICULTY · 試題難度</span><div className="difficulty-fields"><DifficultySelect label="聽力" value={listeningDifficulty} onChange={setListeningDifficulty}/><DifficultySelect label="閱讀" value={readingDifficulty} onChange={setReadingDifficulty}/></div></div><p>選擇本次試題難度，再填入聽力與閱讀分數，即時計算估算答對題數。</p></header>
    <section className="report-header"><div className="candidate-photo"><img src="emperor-penguin-chick.jpg" alt="南極皇帝企鵝幼鳥"/><small>Photo: Mtpaley / CC BY 2.5</small></div><div className="candidate-info"><div className="candidate-field"><input className="candidate-name-input zh-name" aria-label="中文姓名" value={chineseName} onChange={(e) => setChineseName(e.target.value)}/><input className="candidate-name-input en-name" aria-label="英文姓名" value={englishName} onChange={(e) => setEnglishName(e.target.value)}/><small>Name</small></div><div className="candidate-field"><strong>1998/06/15</strong><small>Date of Birth<br/>(yyyy/mm/dd)</small></div><div className="candidate-pair"><div className="candidate-field"><strong>26091234</strong><small>Registration<br/>Number</small></div><div className="candidate-field"><strong>2026/08/16</strong><small>Test Date<br/>(yyyy/mm/dd)</small></div></div><div className="candidate-field"><strong>Individual (August 2026)</strong><small>Client</small></div><small className="sample-note">以上為虛構示範資料</small></div><section className="score-card"><div className="score-main"><ScoreRow label="LISTENING" zh="聽力" score={listeningScore} onChange={setListeningScore} tone="orange"/><ScoreRow label="READING" zh="閱讀" score={readingScore} onChange={setReadingScore} tone="orange"/></div><aside className="total-score"><span>TOTAL<br/>SCORE</span><b>{listeningScore + readingScore}</b></aside></section></section>
    <section className="results" aria-live="polite"><div className="result-title"><span>ESTIMATED CORRECT</span><strong>估算答對題數</strong></div><div className="result-stat"><span>LISTENING · 聽力</span><b>{result.listening}</b><em>/ 100 題</em></div><div className="result-stat"><span>READING · 閱讀</span><b>{result.reading}</b><em>/ 100 題</em></div><div className="result-stat total"><span>TOTAL · 合計</span><b>{result.listening + result.reading}</b><em>/ 200 題</em></div></section>
    <div className="ability-grid"><AbilityPanel title="LISTENING ABILITIES" zh="聽力能力指標" color="blue" skills={listeningSkills} values={listening} onChange={update(setListening)}/><AbilityPanel title="READING ABILITIES" zh="閱讀能力指標" color="green" skills={readingSkills} values={reading} onChange={update(setReading)}/></div>
    <section className="part-estimate" aria-live="polite"><header><div><span>PART BREAKDOWN</span><h2>答對題數估算</h2></div><p>依各 Part 正式題數比例分配</p></header><div className="part-columns"><div className="part-column listening"><h3>LISTENING · 聽力</h3>{listeningParts.map((value, i) => <div className="part-row" key={`L${i}`}><span>PART {i + 1}</span><strong>{value}<small> / {[6, 25, 39, 30][i]} 題</small></strong></div>)}</div><div className="part-column reading"><h3>READING · 閱讀</h3>{readingParts.map((value, i) => <div className="part-row" key={`R${i}`}><span>PART {i + 5}</span><strong>{value}<small> / {[30, 16, 54][i]} 題</small></strong></div>)}</div></div><p className="part-note">各 Part 為比例推估；聽力與閱讀的 Part 加總，分別與上方估算答對題數一致。</p></section>
    <div className="generate-bar"><div><strong>完成輸入了嗎？</strong><span>下載這次的完整估算報告</span></div><button type="button" onClick={generatePdf} disabled={isGenerating}>{isGenerating ? '正在生成…' : '生成 PDF'}</button></div>
  </div><footer>TOEIC® 為 ETS 的註冊商標；本工具與 ETS 無關，僅供個人成績分析參考。</footer></main>;
}

