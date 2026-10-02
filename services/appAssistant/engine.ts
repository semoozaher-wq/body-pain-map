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
  isMidBackTerm,
  labelFor,
  visibleEntries,
} from './catalog';
import { splitBySafety, withLabel } from './actions';
import { parseIntents, type RawIntent } from './intents';
import { classifyGeneralChat, generalChatReply } from './generalChat';
import { analyzeMessage, type AssistantReply, type PainContext } from '../aiAssistant/engine';
import {
  requestGeminiDecision,
  mergePainContext,
  type GeminiDecision,
  type GeminiContext,
} from '../aiAssistant/gemini';
import { collapseRepeatedSegments, collapseWhitespace } from '../speech/transcript';
import {
  describePoint,
  describePosition,
  describeSpatialRelation,
  nearestInDirection,
  nearestBetweenTwo,
  offsetPoint,
  moveToward,
  DIRECTION_LABELS,
  type Direction,
} from './spatial';
import type {
  AppState,
  AssistantAction,
  AssistantTurn,
  CatalogEntry,
  ConversationMode,
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

/**
 * يحدّد مقدار الإزاحة على الخريطة من صيغة الجملة:
 *   «شوية/قليل» → إزاحة صغيرة، «أبعد/بعيد» → كبيرة، «أقرب/قريب» → صغيرة جدًا، وإلا الافتراضي.
 * يعتمد على النص فقط، والإحداثيات الناتجة تبقى مشتقّة من إحداثيات حقيقية (لا اختراع).
 */
function moveAmount(rawText: string): number {
  const t = rawText
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627')
    .replace(/\u0649/g, '\u064a')
    .replace(/\u0629/g, '\u0647');
  if (t.includes('\u0628\u0639\u064a\u062f') || t.includes('\u0627\u0628\u0639\u062f')) return 16;
  // «أكتر/أكثر/بكتير» = تصحيح بمدى أكبر («لا، تحت أكتر») ⇒ إزاحة أكبر من الافتراضي.
  if (t.includes('\u0627\u0643\u062a\u0631') || t.includes('\u0627\u0643\u062b\u0631') || t.includes('\u0628\u0643\u062a\u064a\u0631')) return 14;
  if (t.includes('\u0642\u0631\u064a\u0628') || t.includes('\u0627\u0642\u0631\u0628')) return 4;
  if (t.includes('\u0634\u0648\u064a') || t.includes('\u0642\u0644\u064a\u0644') || t.includes('\u0628\u0633\u064a\u0637')) return 6;
  return 8;
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
    const painBits: string[] = [];
    if (state.selectedPainLocation) {
      painBits.push(state.language === 'ar' ? 'في علامة ألم محدّدة على الخريطة' : state.language === 'fr' ? 'un repère de douleur est placé' : 'a pain marker is placed');
    }
    if (state.painSeverity != null) {
      painBits.push(state.language === 'ar' ? `شدّتها ${state.painSeverity}/10` : state.language === 'fr' ? `intensité ${state.painSeverity}/10` : `severity ${state.painSeverity}/10`);
    }
    const pain = painBits.length ? ` ${painBits.join('، ')}.` : '';
    return L(
      `إنت في ${base} — قسم «${tab}». العناصر الظاهرة: ${list || 'لا يوجد'}.${pain}`,
      `You are on ${base} — the “${tab}” section. Visible items: ${list || 'none'}.${pain}`,
      `Vous êtes sur ${base} — section « ${tab} ». Éléments visibles : ${list || 'aucun'}.${pain}`,
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
  /** السياق الطبي المُجمَّع من الجولات السابقة (spec #4d): يُمرَّر إلى محرّك الفهم الطبي
   *  حتى لا يُعيد المساعد السؤال عن معلومة قالها المستخدم بالفعل. */
  previousContext?: PainContext | null;
  /**
   * قرار موحّد (Structured JSON) قادم من طبقة الذكاء الاصطناعي الحقيقية (Gemini)
   * عبر {@link interpretAsync}. عند وجوده يُفسَّر هنا إلى إجراءات موجودة فعلًا،
   * ويُطبَّق عليه سياسة العلامة الواحدة. عند غيابه (فشل/عدم تهيئة) لا يتغيّر أي
   * سلوك: محرّك القواعد يبقى المرجع الاحتياطي.
   */
  aiDecision?: GeminiDecision | null;
  /** هل توجد صورة مرفقة مع الجملة؟ (تُمرَّر لمحرّك القواعد كطبقة احتياطية). */
  hasImage?: boolean;
  /** صورة كـ data URL (اختياري) — تُمرَّر إلى Gemini كمدخل متعدّد الوسائط. */
  image?: string | null;
  /** آخر رسائل المستخدم (سياق حواري قصير المدى يُمرَّر إلى Gemini). */
  recentUserMessages?: string[];
  /** كاسر الحلقة: منع السؤال التوضيحي بعد عدد محدّد (يُمرَّر لمحرّك القواعد). */
  forceAnswer?: boolean;
  /** عدد الأسئلة التوضيحية التي طُرحت بالفعل (يُمرَّر لمحرّك القواعد). */
  askCount?: number;
  /** عدد رسائل المستخدم (سقف كسر الحلقة، يُمرَّر لمحرّك القواعد). */
  userTurnCount?: number;
}

export function interpret(
  utterance: string,
  state: AppState,
  options: InterpretOptions = {},
): AssistantTurn {
  const lang: Lang = state.language;
  const hasBase = !!(state.selectedPainLocation || state.conversationContext.lastReferencedCoords);
  const intents = parseIntents(utterance, lang, { hasBase });

  const actions: AssistantAction[] = [];
  const resolved: ResolvedTarget[] = [];
  const replyParts: LocalizedText[] = [];
  let understood = false;
  let wantsClose = false;

  for (const intent of intents) {
    switch (intent.kind) {
      case 'close': {
        actions.push({ type: 'close' });
        replyParts.push(L('تمام، قفلت المساعد.', 'Okay, closing the assistant.', 'D’accord, je ferme l’assistant.'));
        understood = true;
        wantsClose = true;
        break;
      }
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
        replyParts.push(query
          ? L(
              `فلترت نقاط الضغط حسب «${query}».`,
              `Filtered acupressure points by “${query}”.`,
              `Points d’acupression filtrés par « ${query} ».`,
            )
          : L(
              'فتحت نقاط الضغط. اكتب المنطقة لعرض النقاط الخاصة بها.',
              'Opened acupressure points. Type an area to filter.',
              'Points d’acupression ouverts. Saisissez une zone pour filtrer.',
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
          let found: CatalogEntry | null = null;
          if (
            intent.direction === 'between_two' &&
            reference.coords &&
            state.conversationContext.previousReferencedCoords
          ) {
            found = nearestBetweenTwo(reference.coords, state.conversationContext.previousReferencedCoords, candidates);
          }
          if (!found) found = nearestInDirection(reference, candidates, intent.direction);
          if (found) {
            const relation = describeSpatialRelation(found, reference, lang);
            actions.push({ type: 'highlight', targetId: found.id, label: found.label });
            resolved.push(toResolved(found));
            const dirWord = DIRECTION_LABELS[intent.direction][lang];
            if (intent.direction === 'between_two') {
              const prevEntry = state.conversationContext.previousReferencedId
                ? getEntry(state.conversationContext.previousReferencedId)
                : null;
              const otherLabel = prevEntry
                ? labelFor(prevEntry, lang)
                : L('العنصر السابق', 'the previous item', 'l’élément précédent')[lang];
              replyParts.push(L(
                `${relation?.ar ?? ''} يعني ${labelFor(found, lang)} بين ${labelFor(reference, lang)} و${otherLabel}.`,
                `${relation?.en ?? ''} So ${labelFor(found, lang)} is between ${labelFor(reference, lang)} and ${otherLabel}.`,
                `${relation?.fr ?? ''} Donc ${labelFor(found, lang)} est entre ${labelFor(reference, lang)} et ${otherLabel}.`,
              ));
            } else {
              replyParts.push(L(
                `${relation?.ar ?? ''} يعني ${labelFor(found, lang)} ${dirWord} ${labelFor(reference, lang)}.`,
                `${relation?.en ?? ''} So ${labelFor(found, lang)} is ${dirWord} ${labelFor(reference, lang)}.`,
                `${relation?.fr ?? ''} Donc ${labelFor(found, lang)} est ${dirWord} ${labelFor(reference, lang)}.`,
              ));
            }
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
      case 'locate_pain': {
        // شكوى ألم أو طلب وضع علامة: نفتح الخريطة، نحدّد أقرب منطقة حقيقية، ونطلب الدقة.
        actions.push({ type: 'navigate', targetId: 'screen:body' });
        const target = intent.targetTerm
          ? (isMidBackTerm(intent.targetTerm)
              ? getEntry('region:mid:back') ?? findTarget(intent.targetTerm, ['region', 'organ', 'point'])
              : findTarget(intent.targetTerm, ['region', 'organ', 'point']))
          : undefined;
        if (target && target.coords) {
          if (target.tab) actions.push({ type: 'open_tab', targetId: `tab:${target.tab}` });
          if (target.view) actions.push({ type: 'set_view', targetId: target.view });
          // فهم مكاني داخل الجملة: لو المستخدم قال "تحت صدري بشوية" أو "جنب القلب ناحية الشمال"،
          // نزيح العلامة عن إحداثيات الهدف الحقيقية في الاتجاه المذكور (لا إحداثيات مُختلقة).
          const dir: Direction | undefined = intent.direction;
          const hasDir = !!dir && dir !== 'between' && dir !== 'between_two';
          const placed = hasDir
            ? offsetPoint({ x: target.coords.x, y: target.coords.y, view: target.coords.view }, dir as Direction, moveAmount(utterance))
            : { x: target.coords.x, y: target.coords.y, view: target.coords.view };
          actions.push({ type: 'set_marker', targetId: target.id, value: `${placed.x},${placed.y},${placed.view}` });
          actions.push({ type: 'highlight', targetId: target.id, label: target.label });
          resolved.push(toResolved(target));
          if (hasDir) {
            const dirWord = DIRECTION_LABELS[dir as Direction][lang];
            replyParts.push(L(
              `تمام، علّمت المنطقة ${dirWord} ${labelFor(target, lang)} على الخريطة. لو عايز أدقّ قول «فوق شوية» أو «تحت شوية».`,
              `Okay, I marked the area ${dirWord} ${labelFor(target, lang)} on the map. Say “a bit up” or “a bit down” to fine-tune.`,
              `D’accord, j’ai marqué la zone ${dirWord} ${labelFor(target, lang)} sur la carte. Dites « un peu plus haut » ou « plus bas » pour ajuster.`,
            ));
          } else {
            // ROOT-CAUSE FIX (premature questionnaire): a bare complaint with a
            // named region already placed the marker, so we must NOT interrogate
            // the user ("فين بالظبط؟ فوق، تحت…"). We give a natural, optional
            // fine-tune hint instead — no question, no questionnaire.
            replyParts.push(L(
              `تمام، علّمت ${labelFor(target, lang)} على الخريطة. لو حبيت أدقّ قول «فوق شوية» أو «تحت شوية» أو «ناحية اليمين».`,
              `Okay, I marked ${labelFor(target, lang)} on the map. Say “a bit up”, “a bit down” or “to the right” to fine-tune.`,
              `D’accord, j’ai marqué ${labelFor(target, lang)} sur la carte. Dites « un peu plus haut », « plus bas » ou « à droite » pour ajuster.`,
            ));
          }
        } else {
          replyParts.push(L(
            'تمام، فتحت خريطة الجسم. قول لي الألم فين بالظبط (مثلاً: جنبي، كتفي، بطني، ظهري) وأنا هحدّد العلامة.',
            'Okay, I opened the body map. Just tell me where it hurts (e.g. my flank, my shoulder, my belly, my back) and I’ll place the marker.',
            'D’accord, j’ai ouvert la carte. Dites-moi où vous avez mal (par ex. le flanc, l’épaule, le ventre, le dos) et je place le repère.',
          ));
        }
        understood = true;
        break;
      }
      case 'move_marker': {
        // تحريك علامة الألم الحالية بالنسبة لموقعها السابق ("تحت شوية").
        const base = state.selectedPainLocation ?? state.conversationContext.lastReferencedCoords;
        if (base && intent.direction) {
          const moved = offsetPoint({ x: base.x, y: base.y, view: base.view }, intent.direction, moveAmount(utterance));
          actions.push({ type: 'move_marker', targetId: 'pain_marker', value: `${moved.x},${moved.y},${moved.view}` });
          const dirWord = DIRECTION_LABELS[intent.direction][lang];
          replyParts.push(L(
            `حرّكت العلامة ${dirWord} المكان اللي قبل كده. لو عايز أدقّ أكتر قول لي «فوق شوية» أو «ناحية اليمين».`,
            `I moved the marker ${dirWord} its previous spot. Say “a bit up” or “to the right” to fine-tune.`,
            `J’ai déplacé le repère ${dirWord} sa position précédente. Dites « un peu plus haut » ou « à droite ».`,
          ));
          understood = true;
        } else {
          replyParts.push(L(
            'قول لي الألم فين الأول (مثلاً: جنبي، كتفي، بطني، ظهري) وأنا هحدّد العلامة وأحرّكها معاك.',
            'First tell me where it hurts (e.g. my flank, my shoulder, my belly, my back) and I’ll set and move the marker with you.',
            'Dites-moi d’abord où vous avez mal (par ex. le flanc, l’épaule, le ventre, le dos) et je place le repère.',
          ));
          understood = true;
        }
        break;
      }
      case 'move_toward': {
        // تحريك العلامة الحالية نحو منطقة حقيقية («أقرب للكتف»، «ناحية البطن») باستخدام إحداثيات الكتالوج فقط (لا اختراع مواضع).
        const base = state.selectedPainLocation ?? state.conversationContext.lastReferencedCoords;
        const anchor = intent.targetTerm
          ? findTarget(intent.targetTerm, ['region', 'organ', 'point'])
          : undefined;
        if (base && anchor && anchor.coords) {
          const moved = moveToward(
            { x: base.x, y: base.y, view: base.view },
            { x: anchor.coords.x, y: anchor.coords.y, view: anchor.coords.view },
            0.6,
          );
          actions.push({ type: 'move_marker', targetId: 'pain_marker', value: `${moved.x},${moved.y},${moved.view}` });
          replyParts.push(L(
            `قرّبت العلامة ناحية ${labelFor(anchor, lang)}. لو عايز أدقّ أكتر قول «فوق شوية» أو «ناحية اليمين».`,
            `Moved the marker closer to ${labelFor(anchor, lang)}. Say “a bit up” or “to the right” to fine-tune.`,
            `J’ai rapproché le repère de ${labelFor(anchor, lang)}. Dites « un peu plus haut » ou « à droite » pour ajuster.`,
          ));
          understood = true;
        } else {
          replyParts.push(L(
            'قول لي الألم فين الأول (مثلاً: جنبي، كتفي، بطني) وأنا هحدّد العلامة، وبعدها أقرّبها من أي منطقة تقولها.',
            'First tell me where it hurts (e.g. my flank, my shoulder, my belly), then I can move it closer to any area you name.',
            'Dites-moi d’abord où vous avez mal (par ex. le flanc, l’épaule, le ventre), puis je le rapproche de la zone que vous indiquez.',
          ));
          understood = true;
        }
        break;
      }
      case 'keep_marker': {
        // «نفس المكان»: نُبقي العلامة الحالية كما هي ولا نعيد السؤال. نُبرز العنصر
        // المرجعي فقط إن وُجد فعلاً في الكتالوج (لا اختراع معرّفات).
        const refId = state.conversationContext.lastReferencedId;
        const refEntry = refId ? getEntry(refId) : undefined;
        const hasMarker = !!(state.selectedPainLocation || state.conversationContext.lastReferencedCoords);
        if (hasMarker && refEntry) {
          actions.push({ type: 'highlight', targetId: refEntry.id, label: refEntry.label });
          replyParts.push(L(
            `تمام، سايب العلامة في نفس المكان (${labelFor(refEntry, lang)}). لو حبيت أحرّكها قول «فوق شوية» أو «ناحية اليمين».`,
            `Okay, I’ll keep the marker in the same place (${labelFor(refEntry, lang)}). Say “a bit up” or “to the right” to move it.`,
            `D’accord, je garde le repère au même endroit (${labelFor(refEntry, lang)}). Dites « un peu plus haut » ou « à droite » pour le déplacer.`,
          ));
        } else if (hasMarker) {
          replyParts.push(L(
            'تمام، سايب العلامة في نفس المكان. لو حبيت أحرّكها قول «فوق شوية» أو «ناحية اليمين».',
            'Okay, I’ll keep the marker in the same place. Say “a bit up” or “to the right” to move it.',
            'D’accord, je garde le repère au même endroit. Dites « un peu plus haut » ou « à droite » pour le déplacer.',
          ));
        } else {
          replyParts.push(L(
            'تمام. قول لي الألم فين بالظبط (مثلاً: جنبي، كتفي، بطني، ظهري) وأنا أعلّم المكان.',
            'Okay. Tell me exactly where it hurts (e.g. my flank, my shoulder, my belly, my back) and I’ll place the marker.',
            'D’accord. Dites-moi exactement où vous avez mal (par ex. le flanc, l’épaule, le ventre, le dos) et je place le repère.',
          ));
        }
        understood = true;
        break;
      }
      case 'open_last_entry': {
        actions.push({ type: 'navigate', targetId: 'screen:history' });
        actions.push({ type: 'open_last_entry' });
        replyParts.push(L(
          'فتحت آخر تسجيل في سجل الألم.',
          'Opened the latest pain history entry.',
          'J’ai ouvert la dernière entrée de l’historique.',
        ));
        understood = true;
        break;
      }
      case 'doctor_summary': {
        actions.push({ type: 'navigate', targetId: 'screen:history' });
        actions.push({ type: 'doctor_summary' });
        replyParts.push(L(
          'تمام، هجهّز ملخص لطبيبك من سجل الألم.',
          'Okay, I’ll prepare a summary for your doctor from the pain history.',
          'D’accord, je prépare un résumé pour votre médecin.',
        ));
        understood = true;
        break;
      }
      case 'medications': {
        actions.push({ type: 'navigate', targetId: 'screen:body' });
        actions.push({ type: 'open_tab', targetId: 'tab:drugLookup' });
        if (intent.query) actions.push({ type: 'search', value: intent.query });
        replyParts.push(intent.query
          ? L(
              `فتحت الأدوية وببحث عن «${intent.query}». ملاحظة: ده للاطّلاع فقط ومش نظام وصف علاج.`,
              `Opened medications and searching “${intent.query}”. Note: this is for reference only, not a prescribing system.`,
              `Médicaments ouverts, recherche « ${intent.query} ». À titre indicatif uniquement, pas de prescription.`,
            )
          : L(
              'فتحت قسم الأدوية. اكتب اسم الدواء للبحث. ملاحظة: للاطّلاع فقط.',
              'Opened the medications section. Type a drug name to search. Reference only.',
              'Section médicaments ouverte. Saisissez un nom pour rechercher. À titre indicatif.',
            ));
        understood = true;
        break;
      }
      case 'record_pain': {
        // استكمال محادثة: «شدته 7» بدون فعل حفظ صريح → نحدّث الشدة على العلامة الحالية
        // بدل بدء تسجيل جديد أو طلب تأكيد. الطلب الصريح («سجّل ألم شدته 7») يبقى كما هو.
        if (intent.value !== undefined && !intent.explicit) {
          actions.push({ type: 'set_severity', value: intent.value });
          replyParts.push(L(
            `تمام، سجّلت الشدة ${intent.value} من 10. بقاله قد إيه؟ ولو تحب تعدّل المكان قول لي «فوق شوية» أو «تحت شوية».`,
            `Okay, noted severity ${intent.value}/10. How long has it been? Say “a bit up” or “a bit down” to adjust the spot.`,
            `Noté : intensité ${intent.value}/10. Depuis combien de temps ? Dites « un peu plus haut » ou « plus bas » pour ajuster.`,
          ));
          understood = true;
          break;
        }
        actions.push({ type: 'navigate', targetId: 'screen:body' });
        actions.push({ type: 'open_tab', targetId: 'tab:muscles' });
        if (intent.value !== undefined) {
          actions.push({ type: 'save', targetId: 'pain_entry', value: intent.value, requiresConfirmation: true, label: L(`حفظ ألم شدّته ${intent.value}/10`, `Save pain ${intent.value}/10`, `Enregistrer douleur ${intent.value}/10`) });
          replyParts.push(L(
            `جهّزت تسجيل ألم شدّته ${intent.value} من 10. قول «احفظ» للتأكيد.`,
            `Prepared a pain entry with severity ${intent.value}/10. Say “save” to confirm.`,
            `Entrée de douleur ${intent.value}/10 préparée. Dites « enregistrer » pour confirmer.`,
          ));
        } else {
          replyParts.push(L(
            'تمام، قول لي مكان الوجع (مثلاً: جنبي، كتفي، بطني) والشدّة من 10 وأنا هحدّد العلامة.',
            'Okay, tell me where it hurts (e.g. my flank, my shoulder, my belly) and the severity out of 10, and I’ll place the marker.',
            'D’accord, dites-moi où vous avez mal (par ex. le flanc, l’épaule, le ventre) et l’intensité sur 10, et je place le repère.',
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

  // ---------------------------------------------------------------------------
  // دمج المرحلة الثانية والثالثة: نفس المساعد يفهم الكلام الطبيعي وينفّذ إجراءات التطبيق.
  // نستدعي محرّك الفهم الطبي الطبيعي (aiAssistant) جنبًا إلى جنب مع محرّك التحكّم،
  // فلا يستبدل أحدهما الآخر: التحكّم يفتح/يبرز، والفهم الطبيعي يكمل الحوار.
  // ---------------------------------------------------------------------------
  let aiReply: AssistantReply | null = null;
  try {
    aiReply = analyzeMessage(utterance, lang, options.hasImage ?? false, {
      // كاسر الحلقة (spec): نمرّر عدّاد الأسئلة التوضيحية وسقف رسائل المستخدم حتى
      // لا يظل المساعد يسأل عن الموقع إلى ما لا نهاية. عند غيابها تبقى القيم الافتراضية.
      forceAnswer: options.forceAnswer,
      askCount: options.askCount,
      userTurnCount: options.userTurnCount,
      // السياق الطبي بين الرسائل (spec #4d): نمرّر ما فهمناه سابقًا حتى يبني عليه
      // بدل أن يسأل من جديد. مصدره حالة التطبيق (state.painContext) أو الخيارات.
      previousContext: options.previousContext ?? state.painContext ?? undefined,
    });
  } catch {
    aiReply = null;
  }

  // تصنيف المحادثة العامة مرّة واحدة. «تغيير الموضوع» أمر صريح له أولوية قصوى في أي وقت،
  // حتى لو التقط المحرّك الطبي كلمة عرض داخل الجملة (مثال: «غير الموضوع» → sym:general-pain).
  const generalKind = !wantsClose ? classifyGeneralChat(utterance) : null;
  const isTopicChange = generalKind === 'topic_change';

  let mode: 'idle' | 'general' | 'medical' | 'app' = understood ? 'app' : (state.conversationMode ?? 'idle');

  if (isTopicChange && generalKind) {
    understood = true;
    mode = 'general';
    replyParts.push(generalChatReply(generalKind, utterance));
    // تغيير الموضوع: نطلب من طبقة الإجراءات تفريغ سياق الحوار (آمن، بلا تأكيد).
    actions.push({ type: 'reset_context' });
  }

  if (!wantsClose && !isTopicChange && aiReply && aiReply.understood) {
    if (!understood) {
      // محرّك التحكّم لم يفهم الأمر، لكنه كلام طبيعي مفهوم → نردّ طبيعيًا
      // ونشتقّ إجراءات التطبيق (فتح الخريطة + العلامة + الإبراز) إن وُجد عنصر حقيقي.
      understood = true;
      const natural = aiNaturalParts(aiReply);
      if (natural) replyParts.push(natural);
      const derived = actionsFromAiReply(aiReply);
      actions.push(...derived.actions);
      if (derived.entry) resolved.push(toResolved(derived.entry));
      if (mode !== 'app') mode = 'medical';
    } else {
      // محرّك التحكّم فهم الأمر → نُثري الرد بسؤال طبيعي متابعة إن لم يكن الرد يسأل بالفعل.
      const alreadyAsks = replyParts.some((p) => /[؟?]/.test(p.ar));
      // لا نكرّر سؤال «مكان الألم فين؟» لو وضعنا العلامة بالفعل (سؤال توضيحي متناقض مع «علّمت المنطقة…»).
      // لا نُثري ردّ أوامر التحكّم الصريحة (مثل «وريني القلب») ولا تحريك العلامة («تحت شوية») بسؤال طبي متابِع؛
      // نُثري فقط عندما تكون الجملة شكوى ألم جديدة (locate_pain) لنطلب التوضيح/المتابعة الطبيعية.
      const complaint = intents.some((i) => i.kind === 'locate_pain');
      const controlMarked = actions.some((a) => a.type === 'set_marker');
      // ROOT-CAUSE FIX (premature severity / medical question): when the control
      // layer already handled the complaint by placing a marker for a named
      // region, the turn is complete. We must NOT tack on the medical engine's
      // follow-up (the "قيّم شدة الألم من 1 لـ 10" severity question) — that
      // question belongs to its own, later turn. Enrich only when the control
      // layer did not already place a marker.
      if (complaint && !alreadyAsks && !controlMarked) {
        const natural = aiNaturalParts(aiReply);
        if (natural) replyParts.push(natural);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // طبقة المحادثة العامة: كلام حرّ لا يخصّ الألم ولا التحكّم (تحيّة، حال، مشاعر،
  // تغيير موضوع، شكر، وداع، هوية، قدرات). نصنّفه هنا بدل الردّ الافتراضي الفاشل.
  // ---------------------------------------------------------------------------
  if (!wantsClose && !understood && generalKind) {
    understood = true;
    mode = 'general';
    replyParts.push(generalChatReply(generalKind, utterance));
  }

  // ---------------------------------------------------------------------------
  // طبقة الذكاء الاصطناعي الحقيقية (Gemini): قرار مُوحّد (Structured JSON) يصل من
  // interpretAsync. نُفسّره هنا إلى إجراءات موجودة فعلًا (لا اختراع إجراءات/إحداثيات)،
  // ونُطبّق سياسة العلامة الواحدة، ونجعل ردّ النموذج الطبيعي هو الردّ الأساسي.
  // الأمان لا يعتمد على Gemini وحده: عند وجود علامة خطر من المحرّك المحلي نُبقي
  // رسالة الأمان. عند غياب القرار (فشل/عدم تهيئة) لا يتغيّر أي سلوك.
  // ---------------------------------------------------------------------------
  let geminiPainContext: PainContext | null = null;
  if (options.aiDecision) {
    const decision = options.aiDecision;
    const g = actionsFromGeminiDecision(decision, state);
    let gReply = geminiReplyText(decision);
    const redFlags = aiReply?.redFlags?.length ?? 0;

    // ثقة منخفضة: لا نخمّن مكانًا/اتجاهًا عبر Gemini إطلاقًا.
    //   • إن كان محرّك القواعد قد فهم المكان بوضوح ⇒ نُبقي فهمه وردّه (الأوامر الواضحة Rule-Based).
    //   • وإلا ⇒ نُلغي إجراء العلامة ونردّ بسؤال توضيحي قصير بدل التخمين.
    // (لا نُخفي تحذير الخطر الطبي المحلي: نتجاهل هذا المنطق عند وجود علامة خطر.)
    const lowConfidence = decision.confidence < GEMINI_CONFIDENCE_THRESHOLD;
    const geminiGuessingLocation =
      lowConfidence &&
      (g.hasMarker || decision.intent === 'locate_pain' || decision.intent === 'move_marker');
    if (geminiGuessingLocation) {
      const rulesHaveMarker = actions.some((a) => a.type === 'set_marker' || a.type === 'move_marker');
      for (let i = g.actions.length - 1; i >= 0; i--) {
        if (g.actions[i].type === 'set_marker' || g.actions[i].type === 'move_marker') g.actions.splice(i, 1);
      }
      g.hasMarker = false;
      if (rulesHaveMarker) {
        gReply = null;
      } else if (redFlags === 0) {
        gReply = lowConfidenceClarification(decision);
      }
    }

    if (g.hasMarker) {
      // Gemini هو المرجع في العلامة: نُزيل أي علامة أنتجها محرّك القواعد لنفس الجولة
      // حتى لا تظهر علامتان (set_marker/move_marker) على الخريطة.
      for (let i = actions.length - 1; i >= 0; i--) {
        if (actions[i].type === 'set_marker' || actions[i].type === 'move_marker') actions.splice(i, 1);
      }
    }
    if (g.actions.length) actions.push(...g.actions);
    if (g.entry) resolved.push(toResolved(g.entry));

    if (gReply) {
      if (redFlags > 0) {
        // إبقاء رسالة الأمان المحلية + إضافة فهم النموذج (لا نحجب تحذير الخطر).
        replyParts.push(gReply);
      } else {
        replyParts.length = 0;
        replyParts.push(gReply);
      }
      understood = true;
    } else if (g.actions.length && !understood) {
      understood = true;
    }

    if (g.mode) mode = g.mode;

    if (decision.painContext) {
      geminiPainContext = mergePainContext(
        options.previousContext ?? state.painContext ?? null,
        decision.painContext,
      );
    }
  }

  // ضبط الوضع النهائي: الجولات الطبية (شكوى ألم / تحريك العلامة / الشدّة) تُصنَّف «طبي» لا «تحكّم»،
  // لأن إجراءاتها المشتقّة (فتح الخريطة + العلامة + الإبراز) نتيجة الفهم الطبي لا أمر تنقّل مباشر.
  if (understood && mode === 'app') {
    const medicalish = intents.some(
      (i) => i.kind === 'locate_pain' || i.kind === 'record_pain' || i.kind === 'move_marker' || i.kind === 'move_toward',
    );
    const appish = intents.some(
      (i) =>
        i.kind === 'navigate_screen' || i.kind === 'open_tab' || i.kind === 'highlight' ||
        i.kind === 'select' || i.kind === 'filter' || i.kind === 'search' || i.kind === 'set_view' ||
        i.kind === 'set_sex' || i.kind === 'zoom' || i.kind === 'back' || i.kind === 'home' ||
        i.kind === 'save' || i.kind === 'show_details' || i.kind === 'clear_history' || i.kind === 'clear_highlight',
    );
    if (medicalish && !appish) mode = 'medical';
  }

  // إزالة التكرار: قد تنتج أكثر من نيّة عن نفس الإجراء/الرد (مثل «روح للأعضاء»).
  const seenActions = new Set<string>();
  const dedupedActions = actions.filter((a) => {
    const key = `${a.type}|${a.targetId ?? ''}|${String(a.value ?? '')}`;
    if (seenActions.has(key)) return false;
    seenActions.add(key);
    return true;
  });
  const seenReplies = new Set<string>();
  const dedupedReplies = replyParts.filter((p) => {
    if (seenReplies.has(p.ar)) return false;
    seenReplies.add(p.ar);
    return true;
  });

  const seenResolved = new Set<string>();
  const dedupedResolved = resolved.filter((r) => {
    if (seenResolved.has(r.id)) return false;
    seenResolved.add(r.id);
    return true;
  });

  const { safe, pending } = splitBySafety(dedupedActions.map((a) => withLabel(a, lang)));

  // الردّ الافتراضي عند عدم الفهم ليس «معليش، مفهمتش الطلب»، بل سؤال توضيحي يوجّه
  // المستخدم للطبقات الثلاث (عام/طبي/تحكّم) — التصنيف يسبق الرفض.
  const reply = cleanAssistantReply(dedupedReplies.length
    ? combine(dedupedReplies)
    : L(
        'مش متأكد إني فهمت صح. تقصد تسألني عن ألم أو عرض، ولا عايز تتحكّم في التطبيق (تنقّل/إبراز/تسجيل)، ولا مجرد كلام عام؟',
        'I’m not sure I got that. Do you mean to ask about a pain or symptom, control the app (navigate/highlight/log), or just chat?',
        'Je ne suis pas sûr d’avoir compris. Veux-tu parler d’une douleur, contrôler l’app (naviguer/surligner), ou discuter ?',
      ));

  return {
    understood,
    reply,
    actions: safe,
    resolved: dedupedResolved,
    needsConfirmation: pending.length > 0,
    pendingConfirmation: pending,
    suggestions: suggestionsFor(state),
    mode,
    // شفافية المصدر: هل فهمت هذه الجولة عبر LLM حقيقي (Gemini) أم عبر محرّك القواعد؟
    // لا يغيّر السلوك؛ يُعرض فقط كمؤشّر صادق في الواجهة.
    source: options.aiDecision ? 'llm' : 'rules',
    // السياق الطبي الموحّد القادم من Gemini (إن وُجد) بعد دمجه مع السياق السابق،
    // حتى يُحفظ بين الرسائل ولا يُعيد المساعد السؤال عن معلومة معروفة.
    painContext: geminiPainContext ?? undefined,
    // الردّ الطبي الكامل (إن وُجد) يُمرَّر مع الجولة حتى تعرضه شاشة «المساعد الذكي»
    // كبطاقة غنية دون استدعاء محرّك ثانٍ متناقض.
    medical: aiReply ?? undefined,
  };
}

/**
 * يبني جملة طبيعية من رد محرّك الفهم الطبي (سؤال توضيحي أو سؤال متابعة أو مقدّمة).
 * تُستخدم لدمج المحادثة الطبيعية مع إجراءات التطبيق في رد واحد.
 */
function aiNaturalParts(reply: AssistantReply): LocalizedText | null {
  const q = reply.clarifyingQuestion ?? reply.followUpQuestion;
  const pick = (l: Lang): string => (q ? q[l] : reply.intro[l]);
  const ar = pick('ar');
  const en = pick('en');
  const fr = pick('fr');
  if (!ar && !en && !fr) return null;
  return L(ar, en, fr);
}

/**
 * يشتقّ إجراءات التطبيق من رد الفهم الطبيعي: يحوّل المنطقة/العضو المفهوم إلى عنصر
 * حقيقي في الكتالوج (بلا اختراع معرّفات)، ثم يفتح الخريطة ويضع العلامة ويبرز العنصر.
 */
function actionsFromAiReply(reply: AssistantReply): { entry?: CatalogEntry; actions: AssistantAction[] } {
  const candidates: Array<[string, CatalogEntry['kind'][]]> = [];
  if (reply.organs[0]) candidates.push([reply.organs[0].label.ar, ['organ']]);
  if (reply.regions[0]) candidates.push([reply.regions[0].label.ar, ['region']]);
  if (reply.suggestedOrganLabel) candidates.push([reply.suggestedOrganLabel.ar, ['organ']]);
  if (reply.suggestedRegionLabel) candidates.push([reply.suggestedRegionLabel.ar, ['region']]);

  let entry: CatalogEntry | undefined;
  for (const [term, kinds] of candidates) {
    const found = findTarget(term, kinds);
    if (found) { entry = found; break; }
  }
  if (!entry) return { actions: [] };

  const actions: AssistantAction[] = [{ type: 'navigate', targetId: 'screen:body' }];
  if (entry.tab) actions.push({ type: 'open_tab', targetId: `tab:${entry.tab}` });
  if (entry.view) actions.push({ type: 'set_view', targetId: entry.view });
  if (entry.coords) {
    actions.push({ type: 'set_marker', targetId: entry.id, value: `${entry.coords.x},${entry.coords.y},${entry.coords.view}` });
  }
  actions.push({ type: 'highlight', targetId: entry.id, label: entry.label });
  return { entry, actions };
}

// ---------------------------------------------------------------------------
// طبقة الذكاء الاصطناعي الحقيقية (Gemini) — تفسير القرار الموحّد إلى إجراءات فعلية
// ---------------------------------------------------------------------------
/** تحويل اتجاه Gemini النصّي إلى اتجاه مكاني موجود فعلاً في المحرّك. */
const GEMINI_DIRECTIONS: Record<string, Direction> = {
  above: 'above',
  up: 'above',
  over: 'above',
  below: 'below',
  down: 'below',
  under: 'below',
  left: 'left',
  right: 'right',
  behind: 'behind',
  back: 'behind',
  in_front: 'in_front',
  front: 'in_front',
  ahead: 'in_front',
  near: 'near',
  far: 'far',
};

function geminiDirection(raw?: string | null): Direction | null {
  if (!raw) return null;
  return GEMINI_DIRECTIONS[raw.trim().toLowerCase()] ?? null;
}

/** تحويل مقدار الحركة النصّي من Gemini إلى وحدات الإحداثيات (0..100). */
function geminiMoveAmount(raw?: string | null): number {
  switch ((raw ?? '').trim().toLowerCase()) {
    case 'little':
    case 'slight':
    case 'small':
    case 'a_little':
      return 6;
    case 'more':
    case 'much':
    case 'big':
    case 'a_lot':
      return 14;
    case 'far':
      return 16;
    case 'near':
      return 4;
    default:
      return 8;
  }
}

const GEMINI_SCREENS = new Set<string>(['welcome', 'body', 'details', 'results', 'history', 'assistant', 'healthInfo', 'settings']);
const GEMINI_TABS = new Set<string>(['muscles', 'organs', 'acupressure', 'naturalRelief', 'medicalLibrary', 'drugLookup']);

/**
 * عتبة ثقة قرار Gemini (0..1). قرارٌ يخمّن مكانًا/اتجاهًا بثقة أقل من هذه القيمة لا يُنفَّذ مباشرةً،
 * بل نطلب من المستخدم توضيحًا قصيرًا بدل التخمين. الأوامر الواضحة تبقى عبر محرّك القواعد (Rule-Based).
 */
const GEMINI_CONFIDENCE_THRESHOLD = 0.5;

interface GeminiDerived {
  actions: AssistantAction[];
  entry?: CatalogEntry;
  hasMarker: boolean;
  mode?: ConversationMode;
}

/**
 * يُفسّر قرار Gemini إلى إجراءات {@link AssistantAction} حقيقية موجودة في التطبيق.
 * لا يُخترع أي إجراء أو إحداثي: المناطق تُحلّ عبر الكتالوج (findTarget) والحركة
 * تُحسب عبر offsetPoint من موضع العلامة الحالي. سياسة العلامة الواحدة:
 *   • set_marker فقط عند عدم وجود علامة سابقة (أول مرة).
 *   • move_marker فقط عند وجود علامة سابقة، ونفس العلامة (لا علامة جديدة).
 *   • عند intent=keep_marker أو direction=same: لا set_marker ولا move_marker.
 */
function actionsFromGeminiDecision(decision: GeminiDecision, state: AppState): GeminiDerived {
  const actions: AssistantAction[] = [];
  let entry: CatalogEntry | undefined;
  let hasMarker = false;

  const base = state.selectedPainLocation
    ? { x: state.selectedPainLocation.x, y: state.selectedPainLocation.y, view: state.selectedPainLocation.view }
    : state.conversationContext.lastReferencedCoords ?? null;
  const hasBase = !!base;
  const keepMarker = decision.intent === 'keep_marker';

  for (const ga of decision.actions) {
    switch (ga.type) {
      case 'set_marker': {
        // العلامة الواحدة: لا نُنشئ علامة جديدة إن وُجدت علامة، ولا عند «نفس المكان».
        if (keepMarker || hasBase) break;
        const found = ga.target ? findTarget(ga.target, ['region', 'organ', 'point']) : undefined;
        if (found?.coords) {
          entry = found;
          actions.push({
            type: 'set_marker',
            targetId: found.id,
            value: `${found.coords.x},${found.coords.y},${found.coords.view}`,
          });
          hasMarker = true;
        }
        break;
      }
      case 'move_marker': {
        // نُحرّك نفس العلامة الحالية فقط (لا نُنشئ واحدة جديدة).
        if (keepMarker || !hasBase || !base) break;
        const dir = geminiDirection(ga.direction);
        if (!dir) break; // «same» أو اتجاه غير معروف ⇒ لا حركة.
        const moved = offsetPoint(base, dir, geminiMoveAmount(ga.amount));
        actions.push({ type: 'move_marker', targetId: 'pain_marker', value: `${moved.x},${moved.y},${moved.view}` });
        hasMarker = true;
        break;
      }
      case 'set_view': {
        const v = ga.view === 'back' ? 'back' : ga.view === 'front' ? 'front' : null;
        if (v) actions.push({ type: 'set_view', targetId: v });
        break;
      }
      case 'set_sex': {
        const s = ga.value === 'female' ? 'female' : ga.value === 'male' ? 'male' : null;
        if (s) actions.push({ type: 'set_sex', targetId: s });
        break;
      }
      case 'navigate': {
        const screen = ga.screen && GEMINI_SCREENS.has(ga.screen) ? ga.screen : null;
        if (screen) actions.push({ type: 'navigate', targetId: `screen:${screen}` });
        break;
      }
      case 'open_tab': {
        const tab = ga.tab && GEMINI_TABS.has(ga.tab) ? ga.tab : null;
        if (tab) {
          actions.push({ type: 'navigate', targetId: 'screen:body' });
          actions.push({ type: 'open_tab', targetId: `tab:${tab}` });
        }
        break;
      }
      case 'highlight': {
        const found = ga.target ? findTarget(ga.target, ['organ', 'point', 'region']) : undefined;
        if (found) {
          entry = entry ?? found;
          actions.push({ type: 'highlight', targetId: found.id, label: found.label });
        }
        break;
      }
      case 'clear_highlight':
        actions.push({ type: 'clear_highlight' });
        break;
      case 'search':
        if (ga.value != null) actions.push({ type: 'search', value: String(ga.value) });
        break;
      case 'filter':
        if (ga.value != null) actions.push({ type: 'filter', value: String(ga.value) });
        break;
      case 'zoom':
        if (ga.value != null) actions.push({ type: 'zoom', value: Number(ga.value) || 1 });
        break;
      case 'set_severity':
        if (ga.value != null) actions.push({ type: 'set_severity', value: ga.value });
        break;
      case 'back':
        actions.push({ type: 'back' });
        break;
      case 'open_last_entry':
        actions.push({ type: 'navigate', targetId: 'screen:history' });
        actions.push({ type: 'open_last_entry' });
        break;
      case 'doctor_summary':
        actions.push({ type: 'navigate', targetId: 'screen:history' });
        actions.push({ type: 'doctor_summary' });
        break;
      case 'reset_context':
        actions.push({ type: 'reset_context' });
        break;
      case 'save':
        actions.push({ type: 'save', targetId: 'current', requiresConfirmation: true });
        break;
      default:
        break;
    }
  }

  let mode: ConversationMode | undefined;
  if (
    decision.intent === 'locate_pain' ||
    decision.intent === 'move_marker' ||
    decision.intent === 'keep_marker' ||
    decision.intent === 'medical_question'
  ) {
    mode = 'medical';
  } else if (actions.length) {
    mode = 'app';
  }

  return { actions, entry, hasMarker, mode };
}

/**
 * سؤال توضيحي قصير يُستخدم عند انخفاض ثقة النموذج في فهم المكان/الاتجاه/الطلب:
 * نُفضّل سؤال المتابعة الذي صاغه النموذج نفسه إن وُجد، وإلا نستخدم صيغة محلية قصيرة
 * توجّه المستخدم لتحديد المنطقة بدل أن نخمّنها.
 */
function lowConfidenceClarification(decision: GeminiDecision): LocalizedText {
  const follow = (decision.followUpQuestion ?? '').trim();
  if (follow) return L(follow, follow, follow);
  return L(
    'ممكن توضّح المكان بالظبط؟ قول لي المنطقة أو الاتجاه اللي بيوجعك.',
    'Could you be more specific about the spot? Tell me the area or direction that hurts.',
    'Peux-tu préciser l’endroit exact ? Dis-moi la zone ou la direction qui fait mal.',
  );
}

/**
 * يبني الردّ الطبيعي من قرار Gemini (ردّ + سؤال متابعة). النموذج يجيب بلغة المستخدم
 * بالفعل، فنضع النص في اللغات الثلاث حتى يظهر مهما كانت لغة الواجهة.
 */
function geminiReplyText(decision: GeminiDecision): LocalizedText | null {
  const main = (decision.reply ?? '').trim();
  const follow = (decision.followUpQuestion ?? '').trim();
  const text = [main, follow].filter(Boolean).join(' ').trim();
  if (!text) return null;
  return L(text, text, text);
}

/** يبني سياقًا مضغوطًا (بلا بيانات حسّاسة) يُرسَل إلى Gemini مع كل جملة. */
function buildGeminiContext(
  state: AppState,
  previousContext?: PainContext | null,
  recentUserMessages?: string[],
): GeminiContext {
  const marker = state.selectedPainLocation
    ? { x: state.selectedPainLocation.x, y: state.selectedPainLocation.y, view: state.selectedPainLocation.view }
    : state.conversationContext.lastReferencedCoords ?? null;
  return {
    screen: state.currentScreen,
    tab: state.currentTab,
    view: state.currentBodyView,
    sex: state.currentSex,
    painSeverity: state.painSeverity,
    painMarker: marker,
    lastReferenced: state.conversationContext.lastReferencedId,
    lastReferencedKind: state.conversationContext.lastReferencedKind,
    lastReferencedCoords: state.conversationContext.lastReferencedCoords,
    // The hook-held context is newer than MainApp's AppState (which intentionally
    // stays UI-focused). Prefer it so Gemini sees the same medical conversation
    // context that the local engine sees on this turn.
    painContext: previousContext ?? state.painContext ?? null,
    recentUserMessages: recentUserMessages ?? [],
  };
}

/**
 * المسار الموحّد للذكاء الاصطناعي: يستدعي Gemini أولًا (نصّ + صورة + سياق + لغة)،
 * ثم يمرّر قراره إلى {@link interpret} (نفس محرّك القواعد) الذي يُفسّره إلى إجراءات
 * موجودة فعلًا ويطبّق السياسات. عند فشل Gemini يُستدعى interpret بدون قرار فيسقط
 * النظام تلقائيًا إلى محرّك القواعد (نفس السلوك السابق تمامًا).
 */
export async function interpretAsync(
  utterance: string,
  state: AppState,
  options: InterpretOptions = {},
): Promise<AssistantTurn> {
  let aiDecision: GeminiDecision | null = null;
  try {
    aiDecision = await requestGeminiDecision({
      text: utterance,
      image: options.image ?? null,
      language: state.language,
      context: buildGeminiContext(state, options.previousContext ?? state.painContext ?? null, options.recentUserMessages),
    });
  } catch {
    aiDecision = null;
  }
  return interpret(utterance, state, { ...options, aiDecision });
}

/**
 * Split a message into sentence-ish segments on the terminators we use in the
 * three supported languages. A '.' only ends a segment when followed by
 * whitespace/end, so decimals like «7.5» are not broken apart.
 */
function splitSentences(text: string): string[] {
  const parts: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const terminator = ch === '؟' || ch === '?' || ch === '!';
    const dot = ch === '.' && (i === text.length - 1 || /\s/.test(text[i + 1] ?? ' '));
    if (terminator || dot) {
      parts.push(text.slice(start, i + 1).trim());
      start = i + 1;
    }
  }
  const tail = text.slice(start).trim();
  if (tail) parts.push(tail);
  return parts.filter(Boolean);
}

/**
 * Keep at most ONE follow-up question in an assistant message.
 *
 * The spec requires exactly one clear question per turn. Statements are always
 * preserved; only *extra* question sentences are dropped (the first question
 * wins). A single sentence that mixes a statement and a question is untouched.
 */
export function enforceSingleQuestion(text: string): string {
  const value = collapseWhitespace(text);
  if (!value) return '';
  const segments = splitSentences(value);
  if (segments.length <= 1) return value;
  let questionSeen = false;
  const kept: string[] = [];
  for (const segment of segments) {
    const isQuestion = /[؟?]/.test(segment);
    if (isQuestion) {
      if (questionSeen) continue; // drop the 2nd, 3rd, ... question
      questionSeen = true;
    }
    kept.push(segment);
  }
  return kept.join(' ').trim();
}

/**
 * Final hygiene applied to EVERY assistant reply before it is displayed:
 *   • collapse accidental word/phrase repetition (STT or model artefacts),
 *   • keep exactly one follow-up question per message.
 * Applied per-language so ar/en/fr each stay natural and short.
 */
export function cleanAssistantReply(reply: LocalizedText): LocalizedText {
  const clean = (value: string): string =>
    enforceSingleQuestion(collapseRepeatedSegments(value ?? ''));
  return { ar: clean(reply.ar), en: clean(reply.en), fr: clean(reply.fr) };
}

function combine(parts: LocalizedText[]): LocalizedText {  return {
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
