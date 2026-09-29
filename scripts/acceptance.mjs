// scripts/acceptance.mjs
// ============================================================================
// سيناريوهات القبول الحقيقية (Acceptance Scenarios) — تشغيل مباشر على المحرّكين:
//   1) services/aiAssistant/engine.ts  → analyzeMessage  (شاشة المساعد الطبي)
//   2) services/appAssistant/engine.ts → interpret       (المساعد المركزي 3 طبقات)
// الهدف: إثبات السلوك الفعلي (لا الادّعاء) عبر نفس المدخلات الحرفية المطلوبة.
// ============================================================================
import { buildSync } from 'esbuild';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function bundle(entry, name) {
  const outfile = path.join(os.tmpdir(), `${name}-${process.pid}.cjs`);
  buildSync({
    entryPoints: [path.resolve(root, entry)],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile,
    logLevel: 'error',
    loader: { '.json': 'json' },
  });
  return require(outfile);
}

// CJS require inside ESM
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const ai = bundle('services/aiAssistant/engine.ts', 'ai-engine');
const app = bundle('services/appAssistant/engine.ts', 'app-engine');

const analyzeMessage = ai.analyzeMessage;
const interpret = app.interpret;

const baseState = (over = {}) => ({
  currentScreen: 'welcome',
  currentTab: 'muscles',
  currentBodyView: 'front',
  currentSex: 'male',
  selectedBodyRegion: null,
  selectedAnatomyStructure: null,
  selectedPoint: null,
  selectedPainLocation: null,
  painSeverity: null,
  symptoms: [],
  lastAssistantAction: null,
  lastUserReference: null,
  conversationState: 'idle',
  zoomLevel: 1,
  visibleStructures: [],
  conversationContext: {
    lastReferencedId: null,
    lastReferencedKind: null,
    lastReferencedLabel: null,
    lastReferencedCoords: null,
    previousReferencedId: null,
    previousReferencedCoords: null,
  },
  language: 'ar',
  conversationMode: 'idle',
  ...over,
});

const line = (s) => console.log(s);
const hr = (t) => { line('\n' + '='.repeat(78)); line(t); line('='.repeat(78)); };

// ---------------------------------------------------------------------------
// 1) المساعد الطبي (analyzeMessage) — الحوار الطبي + بناء السياق تدريجيًا
// ---------------------------------------------------------------------------
hr('1) MEDICAL — analyzeMessage: «عندي وجع في رجلي من تحت» (أول رسالة)');
{
  const r = analyzeMessage('عندي وجع في رجلي من تحت', 'ar', false, { askCount: 0, userTurnCount: 1 });
  line(`clarificationOnly = ${r.clarificationOnly}`);
  line(`clarifyingQuestion = ${r.clarifyingQuestion?.ar ?? '(none)'}`);
  line(`conditions.length = ${r.conditions.length}`);
  line(`selfCare.length = ${r.selfCare.length}`);
  line(`intro = ${r.intro.ar}`);
}

hr('1b) MEDICAL — سلسلة الحوار الكاملة (رجلي من تحت → في الساق → ناحية الخلف → شدته 7)');
{
  const msgs = ['عندي وجع في رجلي من تحت', 'في الساق', 'ناحية الخلف', 'شدته 7 من 10'];
  let askCount = 0;
  let prev = undefined;
  msgs.forEach((m, i) => {
    const userTurnCount = i + 1;
    const forceAnswer = askCount >= 2;
    const r = analyzeMessage(m, 'ar', false, { forceAnswer, askCount, userTurnCount, previousContext: prev });
    line(`\n>> USER: ${m}`);
    line(`   clarificationOnly=${r.clarificationOnly} | q=${r.clarifyingQuestion?.ar ?? '-'} | followUp=${r.followUpQuestion?.ar ?? '-'}`);
    line(`   conditions=${r.conditions.length} selfCare=${r.selfCare.length} severity=${r.painContext.painSeverity} location=${r.painContext.painLocation}`);
    askCount = r.clarificationOnly ? askCount + 1 : 0;
    prev = r.painContext;
  });
}

// ---------------------------------------------------------------------------
// 2) المساعد المركزي (interpret) — الطبقات العامة/الطبية/التحكم + الفهم المكاني
// ---------------------------------------------------------------------------
// يحاكي MainApp.handleAssistantAction: يطبّق الإجراءات على الحالة حتى يكون السياق المكاني/التحكّم واقعيًا.
function applyActions(state, actions) {
  const ctx = { ...state.conversationContext };
  let sel = state.selectedPainLocation;
  let severity = state.painSeverity;
  let screen = state.currentScreen;
  let tab = state.currentTab;
  let view = state.currentBodyView;
  const strip = (id) => { const i = id.indexOf(':'); return i >= 0 ? id.slice(i + 1) : id; };
  for (const a of actions) {
    const t = a.targetId || '';
    switch (a.type) {
      case 'navigate': screen = strip(t); break;
      case 'open_tab': tab = strip(t); break;
      case 'set_view': view = t === 'back' ? 'back' : 'front'; break;
      case 'highlight':
        ctx.previousReferencedId = ctx.lastReferencedId;
        ctx.previousReferencedCoords = ctx.lastReferencedCoords;
        ctx.lastReferencedId = t;
        break;
      case 'select': ctx.lastReferencedId = t; break;
      case 'clear_highlight': ctx.lastReferencedId = null; break;
      case 'set_marker': {
        const [x, y, v] = String(a.value || '').split(',');
        if (!Number.isNaN(Number(x))) { sel = { x: Number(x), y: Number(y), view: v }; ctx.lastReferencedCoords = sel; }
        break;
      }
      case 'move_marker': {
        const [x, y, v] = String(a.value || '').split(',');
        if (!Number.isNaN(Number(x))) { sel = { x: Number(x), y: Number(y), view: v }; ctx.lastReferencedCoords = sel; }
        break;
      }
      case 'set_severity': severity = Number(a.value); break;
      case 'reset_context':
        ctx.lastReferencedId = null; ctx.lastReferencedKind = null; ctx.lastReferencedLabel = null;
        ctx.lastReferencedCoords = null; ctx.previousReferencedId = null; ctx.previousReferencedCoords = null;
        break;
      default: break;
    }
  }
  return { ...state, currentScreen: screen, currentTab: tab, currentBodyView: view, selectedPainLocation: sel, painSeverity: severity, conversationContext: ctx };
}

function runApp(messages, initial = {}) {
  let state = baseState(initial);
  const out = [];
  for (const m of messages) {
    const turn = interpret(m, state);
    out.push({ m, turn });
    // نحمل conversationMode ونطبّق الإجراءات كما يفعل MainApp.
    state = applyActions({ ...state, conversationMode: turn.mode }, turn.actions);
  }
  return out;
}

hr('2) GENERAL — جمل جديدة ليست في اللكسيكون (مساء الخير / عامل إيه / زهقان / خلينا نتكلم / احكيلي حاجة)');
{
  const msgs = ['مساء الخير', 'عامل إيه؟', 'أنا زهقان', 'خلينا نتكلم في أي حاجة', 'احكيلي حاجة', 'غير الموضوع'];
  for (const m of msgs) {
    const t = interpret(m, baseState());
    line(`>> ${m}\n   mode=${t.mode} understood=${t.understood} reply="${t.reply.ar}"`);
  }
}

hr('2b) GENERAL — جملة طبيعية جديدة تمامًا (ليست في القائمة): «إيه الفرق بين البرمجة والذكاء الاصطناعي؟»');
{
  const t = interpret('إيه الفرق بين البرمجة والذكاء الاصطناعي؟', baseState());
  line(`   mode=${t.mode} understood=${t.understood} reply="${t.reply.ar}"`);
}

hr('3) SPATIAL — «عندي وجع تحت صدري بشوية» → «ناحية الشمال شوية» → «لا، تحتها أكتر» → «شدته 7 من 10»');
{
  const turns = runApp([
    'عندي وجع تحت صدري بشوية',
    'ناحية الشمال شوية',
    'لا، تحتها أكتر',
    'شدته 7 من 10',
  ]);
  turns.forEach(({ m, turn }) => {
    const acts = turn.actions.map((a) => a.type + (a.value ? `(${a.value})` : '')).join(', ');
    line(`>> ${m}\n   mode=${turn.mode} reply="${turn.reply.ar}"\n   actions=[${acts}]`);
  });
}

hr('4) APP CONTROL — «افتحلي الأعضاء» → «وريني القلب» → «علم عليه» → «شيله» → «خلاص اقفل»');
{
  const turns = runApp([
    'افتحلي الأعضاء',
    'وريني القلب',
    'علم عليه',
    'شيله',
    'خلاص اقفل',
  ]);
  turns.forEach(({ m, turn }) => {
    const acts = turn.actions.map((a) => a.type + (a.targetId ? `:${a.targetId}` : '') + (a.value ? `=${a.value}` : '')).join(', ');
    line(`>> ${m}\n   mode=${turn.mode} understood=${turn.understood} reply="${turn.reply.ar}"\n   actions=[${acts}]`);
  });
}

hr('5) LAYER SWITCHING — عام → طبي → تحكم → عام');
{
  const turns = runApp([
    'مساء الخير',
    'عندي وجع في ظهري',
    'افتح صفحة الأعضاء',
    'خلاص سيب موضوع الألم واحكيلي حاجة',
  ]);
  turns.forEach(({ m, turn }) => {
    line(`>> ${m}\n   mode=${turn.mode} reply="${turn.reply.ar}"`);
  });
}

hr('6) VOICE — نفس السيناريو نصًّا (الطبقة الصوتية تمر بنفس المحرّك)');
{
  const turns = runApp(['ضهري بيوجعني', 'تحت شوية', 'اقفل']);
  turns.forEach(({ m, turn }) => {
    const acts = turn.actions.map((a) => a.type).join(', ');
    line(`>> ${m}\n   mode=${turn.mode} reply="${turn.reply.ar}"\n   actions=[${acts}]`);
  });
}

line('\n[acceptance] done.');
