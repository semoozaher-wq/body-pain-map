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
import { classifyGeneralChat, generalChatReply } from './generalChat';
import { analyzeMessage, type AssistantReply } from '../aiAssistant/engine';
import {
  describePoint,
  describePosition,
  describeSpatialRelation,
  nearestInDirection,
  nearestBetweenTwo,
  offsetPoint,
  DIRECTION_LABELS,
  type Direction,
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
}

export function interpret(
  utterance: string,
  state: AppState,
  _options: InterpretOptions = {},
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
        const target = intent.targetTerm ? findTarget(intent.targetTerm, ['region', 'organ', 'point']) : undefined;
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
            replyParts.push(L(
              `تمام، علّمت ${labelFor(target, lang)} على الخريطة. فين بالظبط؟ فوق، تحت، يمين، شمال، ولا جنب حاجة تانية؟`,
              `Okay, I marked ${labelFor(target, lang)} on the map. Where exactly? Above, below, left, right, or next to something?`,
              `D’accord, j’ai marqué ${labelFor(target, lang)} sur la carte. Où exactement ? Au-dessus, en dessous, à gauche, à droite ?`,
            ));
          }
        } else {
          replyParts.push(L(
            'تمام، فتحت خريطة الجسم. اضغط على مكان الألم أو قول لي المنطقة (مثلاً: أسفل الظهر، الركبة، البطن).',
            'Okay, I opened the body map. Tap where it hurts, or tell me the area (e.g. lower back, knee, abdomen).',
            'D’accord, j’ai ouvert la carte. Touchez l’endroit ou nommez la zone (bas du dos, genou, abdomen).',
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
            'محتاج أعرف مكان الألم الأول. قول لي المنطقة أو اضغط على الخريطة.',
            'I need the pain location first. Tell me the area or tap the map.',
            'J’ai d’abord besoin de l’emplacement. Nommez la zone ou touchez la carte.',
          ));
          understood = true;
        }
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

  // ---------------------------------------------------------------------------
  // دمج المرحلة الثانية والثالثة: نفس المساعد يفهم الكلام الطبيعي وينفّذ إجراءات التطبيق.
  // نستدعي محرّك الفهم الطبي الطبيعي (aiAssistant) جنبًا إلى جنب مع محرّك التحكّم،
  // فلا يستبدل أحدهما الآخر: التحكّم يفتح/يبرز، والفهم الطبيعي يكمل الحوار.
  // ---------------------------------------------------------------------------
  let aiReply: AssistantReply | null = null;
  try {
    aiReply = analyzeMessage(utterance, lang, false);
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
      const controlMarked = actions.some((a) => a.type === 'set_marker');
      const naturalIsClarify = !!aiReply.clarifyingQuestion && !aiReply.followUpQuestion;
      if (!alreadyAsks && !(controlMarked && naturalIsClarify)) {
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

  // ضبط الوضع النهائي: الجولات الطبية (شكوى ألم / تحريك العلامة / الشدّة) تُصنَّف «طبي» لا «تحكّم»،
  // لأن إجراءاتها المشتقّة (فتح الخريطة + العلامة + الإبراز) نتيجة الفهم الطبي لا أمر تنقّل مباشر.
  if (understood && mode === 'app') {
    const medicalish = intents.some(
      (i) => i.kind === 'locate_pain' || i.kind === 'record_pain' || i.kind === 'move_marker',
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
  const reply = dedupedReplies.length
    ? combine(dedupedReplies)
    : L(
        'مش متأكد إني فهمت صح. تقصد تسألني عن ألم أو عرض، ولا عايز تتحكّم في التطبيق (تنقّل/إبراز/تسجيل)، ولا مجرد كلام عام؟',
        'I’m not sure I got that. Do you mean to ask about a pain or symptom, control the app (navigate/highlight/log), or just chat?',
        'Je ne suis pas sûr d’avoir compris. Veux-tu parler d’une douleur, contrôler l’app (naviguer/surligner), ou discuter ?',
      );

  return {
    understood,
    reply,
    actions: safe,
    resolved: dedupedResolved,
    needsConfirmation: pending.length > 0,
    pendingConfirmation: pending,
    suggestions: suggestionsFor(state),
    mode,
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
