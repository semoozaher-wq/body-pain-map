// services/appAssistant/engine.ts
// ============================================================================
// محرّك المساعد المركزي (Central Assistant Engine)
// ----------------------------------------------------------------------------
// الطبقة المُنسّقة: تستقبل جملة المستخدم + حالة التطبيق، وتُعيد:
//   • ردًّا طبيعيًا (مترجمًا)  • قائمة إجراءات منظّمة آمنة  • العناصر المُحدّدة.
// خط الأنابيب:
//   النص → النوايا (intents) → مطابقة الكتالوج → الفهم المكاني → الإجراءات + الرد.
// لا يخترع أي معلومة تشريحية/طبية: كل شيء من الكتالوج والبيانات المحلية.
// ============================================================================

import {
  CATALOG,
  entriesByKind,
  findTarget,
  getEntry,
  labelFor,
  visibleEntries,
} from './catalog';
import { splitBySafety, withLabel } from './actions';
import { parseIntents, type RawIntent } from './intents';
import {
  describePoint,
  describePosition,
  describeSpatialRelation,
  nearestInDirection,
  DIRECTION_LABELS,
} from './spatial';
import type {
  AppState,
  AssistantAction,
  AssistantTurn,
  CatalogEntry,
  Lang,
  LocalizedText,
  ResolvedTarget,
} from './types';

const L = (ar: string, en: string, fr: string): LocalizedText => ({ ar, en, fr });

function toResolved(entry: CatalogEntry): ResolvedTarget {
  return { id: entry.id, kind: entry.kind, label: entry.label, coords: entry.coords };
}

/** العنصر المرجعي الحالي: من السياق أو من نص الهدف. */
function resolveReference(intent: RawIntent, state: AppState): CatalogEntry | undefined {
  if (intent.refersToContext && state.conversationContext.lastReferencedId) {
    return getEntry(state.conversationContext.lastReferencedId);
  }
  if (intent.targetTerm) {
    const found = findTarget(intent.targetTerm, ['organ', 'point', 'region']);
    if (found) return found;
  }
  if (state.conversationContext.lastReferencedId) {
    return getEntry(state.conversationContext.lastReferencedId);
  }
  return undefined;
}

/** العناصر المرئية/المطابقة للسياق الحالي (للفهم البصري). */
function contextCandidates(state: AppState, kinds: CatalogEntry['kind'][]): CatalogEntry[] {
  const visible = visibleEntries(state).filter((e) => kinds.includes(e.kind));
  if (visible.length) return visible;
  return entriesByKind('organ').concat(entriesByKind('region')).filter((e) => kinds.includes(e.kind));
}

// ---------------------------------------------------------------------------
// وصف الشاشة الحالية
// ---------------------------------------------------------------------------
export function describeScreenState(state: AppState): LocalizedText {
  const visible = visibleEntries(state);
  const names = visible.map((e) => labelFor(e, state.language));
  const list = names.slice(0, 12).join('، ');
  const tabLabel = getEntry(`tab:${state.currentTab}`)?.label;

  const screenName = getEntry(`screen:${state.currentScreen}`)?.label;
  const base = screenName ? labelFor({ ...(getEntry(`screen:${state.currentScreen}`) as CatalogEntry) }, state.language) : '';

  if (state.currentScreen === 'body') {
    const tab = tabLabel ? tabLabel[state.language] : '';
    return L(
      `إنت في ${base} — قسم «${tab}». العناصر الظاهرة: ${list || 'لا يوجد'}.`,
      `You are on ${base} — the “${tab}” section. Visible items: ${list || 'none'}.`,
      `Vous êtes sur ${base} — section « ${tab} ». Éléments visibles : ${list || 'aucun'}.`,
    );
  }
  return L(
    `إنت حاليًا في ${base}.`,
    `You are currently on ${base}.`,
    `Vous êtes actuellement sur ${base}.`,
  );
}

// ---------------------------------------------------------------------------
// بناء إجراءات الإبراز/التحديد لعنصر
// ---------------------------------------------------------------------------
function highlightActions(entry: CatalogEntry): AssistantAction[] {
  const actions: AssistantAction[] = [];
  if (entry.screen) actions.push({ type: 'navigate', targetId: `screen:${entry.screen}` });
  if (entry.tab) actions.push({ type: 'open_tab', targetId: `tab:${entry.tab}` });
  if (entry.view) actions.push({ type: 'set_view', targetId: entry.view });
  actions.push({ type: 'highlight', targetId: entry.id, label: entry.label });
  if (entry.kind === 'organ' || entry.kind === 'point' || entry.kind === 'region') {
    actions.push({ type: 'select', targetId: entry.id, label: entry.label });
    actions.push({ type: 'show_details', targetId: entry.id });
  }
  return actions;
}

// ---------------------------------------------------------------------------
// المحرّك الرئيسي
// ---------------------------------------------------------------------------
export interface InterpretOptions {
  /** هل نطلب تأكيدًا للإجراءات الحسّاسة (افتراضي: نعم). */
  confirmSensitive?: boolean;
}

export function interpret(
  utterance: string,
  state: AppState,
  _options: InterpretOptions = {},
): AssistantTurn {
  const lang: Lang = state.language;
  const intents = parseIntents(utterance, lang);

  const actions: AssistantAction[] = [];
  const resolved: ResolvedTarget[] = [];
  const replyParts: LocalizedText[] = [];
  let understood = false;

  for (const intent of intents) {
    switch (intent.kind) {
      case 'back': {
        actions.push({ type: 'back' });
        replyParts.push(L('حاضر، رجعت.', 'Okay, going back.', 'D’accord, retour.'));
        understood = true;
        break;
      }
      case 'home': {
        actions.push({ type: 'navigate', targetId: 'screen:welcome' });
        replyParts.push(L('تمام، الرئيسية.', 'Okay, home.', 'D’accord, accueil.'));
        understood = true;
        break;
      }
      case 'clear_history': {
        actions.push({ type: 'save', targetId: 'clear_history', requiresConfirmation: true, label: L('مسح سجل الألم', 'Clear pain history', 'Effacer l’historique') });
        replyParts.push(L(
          'متأكد إنك عايز تمسح كل سجل الألم؟ ده لا يمكن التراجع عنه. قول «أيوة» للتأكيد.',
          'Are you sure you want to clear all pain history? This cannot be undone. Say “yes” to confirm.',
          'Voulez-vous vraiment effacer tout l’historique ? Action irréversible. Dites « oui » pour confirmer.',
        ));
        understood = true;
        break;
      }
      case 'clear_highlight': {
        actions.push({ type: 'clear_highlight' });
        replyParts.push(L('شيلت الإبراز.', 'Highlight cleared.', 'Mise en évidence effacée.'));
        understood = true;
        break;
      }
      case 'set_view': {
        const view = intent.targetTerm === 'back' ? 'back' : 'front';
        actions.push({ type: 'navigate', targetId: 'screen:body' });
        actions.push({ type: 'set_view', targetId: view });
        replyParts.push(view === 'back'
          ? L('تمام، عرض الظهر.', 'Okay, back view.', 'D’accord, vue de dos.')
          : L('تمام، عرض الأمام.', 'Okay, front view.', 'D’accord, vue de face.'));
        understood = true;
        break;
      }
      case 'set_sex': {
        const sex = intent.targetTerm === 'female' ? 'female' : 'male';
        actions.push({ type: 'navigate', targetId: 'screen:body' });
        actions.push({ type: 'set_sex', targetId: sex });
        replyParts.push(sex === 'female'
          ? L('تمام، النموذج الأنثوي.', 'Okay, female model.', 'D’accord, modèle féminin.')
          : L('تمام، النموذج الذكري.', 'Okay, male model.', 'D’accord, modèle masculin.'));
        understood = true;
        break;
      }
      case 'zoom': {
        actions.push({ type: 'zoom', value: intent.value ?? 1 });
        replyParts.push((intent.value ?? 1) > 0
          ? L('كبّرت العرض.', 'Zoomed in.', 'Zoom avant.')
          : L('صغّرت العرض.', 'Zoomed out.', 'Zoom arrière.'));
        understood = true;
        break;
      }
      case 'search': {
        const query = intent.query ?? '';
        actions.push({ type: 'navigate', targetId: 'screen:body' });
        actions.push({ type: 'open_tab', targetId: 'tab:medicalLibrary' });
        actions.push({ type: 'search', value: query });
        replyParts.push(L(
          `ببحث عن «${query}» في المكتبة الطبية.`,
          `Searching the medical library for “${query}”.`,
          `Recherche de « ${query} » dans la bibliothèque médicale.`,
        ));
        understood = true;
        break;
      }
      case 'filter': {
        const query = intent.query ?? '';
        actions.push({ type: 'navigate', targetId: 'screen:body' });
        actions.push({ type: 'open_tab', targetId: 'tab:acupressure' });
        actions.push({ type: 'filter', value: query });
        replyParts.push(L(
          `فلترت نقاط الضغط حسب «${query}».`,
          `Filtered acupressure points by “${query}”.`,
          `Points d’acupression filtrés par « ${query} ».`,
        ));
        understood = true;
        break;
      }
      case 'describe_screen': {
        replyParts.push(describeScreenState(state));
        understood = true;
        break;
      }
      case 'navigate_screen':
      case 'open_tab': {
        if (!intent.targetTerm) break;
        const tab = findTarget(intent.targetTerm, ['tab']);
        const screen = findTarget(intent.targetTerm, ['screen']);
        if (tab) {
          actions.push({ type: 'navigate', targetId: 'screen:body' });
          actions.push({ type: 'open_tab', targetId: tab.id });
          resolved.push(toResolved(tab));
          replyParts.push(L(
            `تمام، فتحت «${labelFor(tab, lang)}».`,
            `Okay, opened “${labelFor(tab, lang)}”.`,
            `D’accord, ouvert « ${labelFor(tab, lang)} ».`,
          ));
          understood = true;
        } else if (screen) {
          actions.push({ type: 'navigate', targetId: screen.id });
          resolved.push(toResolved(screen));
          replyParts.push(L(
            `تمام، فتحت ${labelFor(screen, lang)}.`,
            `Okay, opened ${labelFor(screen, lang)}.`,
            `D’accord, ouvert ${labelFor(screen, lang)}.`,
          ));
          understood = true;
        }
        break;
      }
      case 'highlight': {
        const entry = resolveReference(intent, state);
        if (entry) {
          actions.push(...highlightActions(entry));
          resolved.push(toResolved(entry));
          const pos = describePosition(entry, lang);
          replyParts.push(L(
            `أهو ${labelFor(entry, lang)}. ${pos?.ar ?? ''}`,
            `Here is ${labelFor(entry, lang)}. ${pos?.en ?? ''}`,
            `Voici ${labelFor(entry, lang)}. ${pos?.fr ?? ''}`,
          ));
          understood = true;
        }
        break;
      }
      case 'spatial_query': {
        const reference = resolveReference(intent, state);
        if (reference && intent.direction) {
          const candidates = contextCandidates(state, ['organ', 'region', 'point']);
          const found = nearestInDirection(reference, candidates, intent.direction);
          if (found) {
            const relation = describeSpatialRelation(found, reference, lang);
            actions.push({ type: 'highlight', targetId: found.id, label: found.label });
            resolved.push(toResolved(found));
            const dirWord = DIRECTION_LABELS[intent.direction][lang];
            replyParts.push(L(
              `${relation?.ar ?? ''} يعني ${labelFor(found, lang)} ${dirWord} ${labelFor(reference, lang)}.`,
              `${relation?.en ?? ''} So ${labelFor(found, lang)} is ${dirWord} ${labelFor(reference, lang)}.`,
              `${relation?.fr ?? ''} Donc ${labelFor(found, lang)} est ${dirWord} ${labelFor(reference, lang)}.`,
            ));
            understood = true;
          } else {
            replyParts.push(L(
              `مفيش عنصر مسجّل ${DIRECTION_LABELS[intent.direction].ar} ${labelFor(reference, lang)} في البيانات الحالية.`,
              `No item is recorded ${DIRECTION_LABELS[intent.direction].en} ${labelFor(reference, lang)} in the current data.`,
              `Aucun élément n’est enregistré ${DIRECTION_LABELS[intent.direction].fr} ${labelFor(reference, lang)} dans les données actuelles.`,
            ));
            understood = true;
          }
        }
        break;
      }
      case 'record_pain': {
        actions.push({ type: 'navigate', targetId: 'screen:body' });
        actions.push({ type: 'open_tab', targetId: 'tab:muscles' });
        if (intent.value !== undefined) {
          actions.push({ type: 'save', targetId: 'pain_entry', value: intent.value, requiresConfirmation: true, label: L(`حفظ ألم شدّته ${intent.value}/10`, `Save pain ${intent.value}/10`, `Enregistrer douleur ${intent.value}/10`) });
          replyParts.push(L(
            `جهّزت تسجيل ألم شدّته ${intent.value} من 10. حدّد المكان على الخريطة وقول «احفظ» للتأكيد.`,
            `Prepared a pain entry with severity ${intent.value}/10. Pick the spot on the map and say “save” to confirm.`,
            `Entrée de douleur ${intent.value}/10 préparée. Choisissez l’emplacement et dites « enregistrer ».`,
          ));
        } else {
          replyParts.push(L(
            'تمام، اضغط على مكان الوجع على الخريطة وقول الشدّة من 10.',
            'Okay, tap where it hurts on the map and tell me the severity out of 10.',
            'D’accord, touchez l’endroit douloureux et indiquez l’intensité sur 10.',
          ));
        }
        understood = true;
        break;
      }
      case 'save': {
        actions.push({ type: 'save', targetId: 'current', requiresConfirmation: true, label: L('حفظ التسجيل', 'Save entry', 'Enregistrer') });
        replyParts.push(L(
          'تحب أحفظ ده في سجل الألم؟ قول «أيوة» للتأكيد.',
          'Shall I save this to your pain history? Say “yes” to confirm.',
          'Enregistrer dans l’historique ? Dites « oui » pour confirmer.',
        ));
        understood = true;
        break;
      }
      case 'show_details': {
        const entry = resolveReference(intent, state);
        if (entry) {
          actions.push({ type: 'show_details', targetId: entry.id });
          replyParts.push(L('فتحت التفاصيل.', 'Opened the details.', 'Détails ouverts.'));
          understood = true;
        }
        break;
      }
      default:
        break;
    }
  }

  const { safe, pending } = splitBySafety(actions.map((a) => withLabel(a, lang)));

  const reply = replyParts.length
    ? combine(replyParts)
    : L(
        'معلش، مفهمتش الطلب. تقدر تقول مثلاً: «روح للأعضاء»، «وريني القلب»، «اللي فوقه إيه؟».',
        'Sorry, I didn’t catch that. Try: “open the organs”, “show me the heart”, “what’s above it?”.',
        'Désolé, je n’ai pas compris. Essayez : « ouvre les organes », « montre le cœur », « qu’y a-t-il au-dessus ? ».',
      );

  return {
    understood,
    reply,
    actions: safe,
    resolved,
    needsConfirmation: pending.length > 0,
    pendingConfirmation: pending,
    suggestions: suggestionsFor(state),
  };
}

function combine(parts: LocalizedText[]): LocalizedText {
  return {
    ar: parts.map((p) => p.ar).join(' '),
    en: parts.map((p) => p.en).join(' '),
    fr: parts.map((p) => p.fr).join(' '),
  };
}

/** اقتراحات جاهزة حسب الشاشة الحالية. */
function suggestionsFor(state: AppState): LocalizedText[] {
  if (state.currentScreen === 'body') {
    return [
      L('وريني القلب', 'Show me the heart', 'Montre le cœur'),
      L('اللي فوقه إيه؟', 'What’s above it?', 'Qu’y a-t-il au-dessus ?'),
      L('نقاط الضغط في اليد', 'Acupressure points in the hand', 'Points d’acupression de la main'),
      L('ارجع', 'Go back', 'Retour'),
    ];
  }
  return [
    L('روح للأعضاء الداخلية', 'Open the internal organs', 'Ouvre les organes internes'),
    L('روح لخريطة الجسم', 'Open the body map', 'Ouvre la carte du corps'),
    L('افتح سجل الألم', 'Open pain history', 'Ouvre l’historique'),
    L('أنا فين؟', 'Where am I?', 'Où suis-je ?'),
  ];
}

/** يصف عنصرًا بالتفصيل (اسم + موضع + رمز). */
export function describeEntry(entry: CatalogEntry, lang: Lang): LocalizedText {
  const pos = describePosition(entry, lang);
  const code = entry.code ? ` (${entry.code})` : '';
  return L(
    `${labelFor(entry, lang)}${code}. ${pos?.ar ?? ''}`,
    `${labelFor(entry, lang)}${code}. ${pos?.en ?? ''}`,
    `${labelFor(entry, lang)}${code}. ${pos?.fr ?? ''}`,
  );
}

export { describePoint, CATALOG };
