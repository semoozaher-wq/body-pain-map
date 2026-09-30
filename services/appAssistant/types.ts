// services/appAssistant/types.ts
// ============================================================================
// المساعد المركزي للتطبيق — عقود الأنواع (App-wide Assistant contracts)
// ----------------------------------------------------------------------------
// هذه الطبقة مستقلة عن محرّك الفرز الطبي (services/aiAssistant). هنا نُعرّف:
//   • AppState      : ما يعرفه المساعد عن الشاشة الحالية والمستخدم والاختيارات.
//   • AssistantAction: الأوامر المنظّمة (structured actions) التي ينفّذها التطبيق.
//   • AssistantTurn : نتيجة كل جولة حوار (رد + إجراءات + عناصر مُحدّدة).
// لا يوجد أي تخمين تشريحي: كل عنصر له id ثابت وإحداثيات فعلية من ملفات data/.
// ============================================================================

import type { AssistantReply, PainContext } from '../aiAssistant/engine';

export type Lang = 'ar' | 'en' | 'fr';

/** نص مترجم بثلاث لغات. */
export interface LocalizedText {
  ar: string;
  en: string;
  fr: string;
}

/** الشاشات المعروفة في التطبيق. */
export type AppScreen =
  | 'welcome'
  | 'body'
  | 'details'
  | 'results'
  | 'history'
  | 'assistant'
  | 'healthInfo';

/** أقسام شاشة الخريطة (BodyPickerScreen). */
export type BodyTab =
  | 'muscles'
  | 'organs'
  | 'acupressure'
  | 'naturalRelief'
  | 'medicalLibrary'
  | 'drugLookup';

export type BodyView = 'front' | 'back';
export type Sex = 'male' | 'female';

/** نوع العنصر القابل للتحديد على الخريطة/الشاشة. */
export type TargetKind =
  | 'screen'
  | 'tab'
  | 'region'
  | 'organ'
  | 'point'
  | 'article'
  | 'action';

/** إحداثيات على الخريطة (0..100). y=0 أعلى الصورة. */
export interface Coords {
  x: number;
  y: number;
  view: BodyView;
}

/** نقطة ألم اختارها المستخدم على خريطة الجسم. */
export interface SelectedPainLocation {
  x: number;
  y: number;
  view: BodyView;
  label?: LocalizedText;
}

/** سياق الحوار — يمكّن المساعد من فهم "هنا/ده/دي/فوقها/تحتها". */
export interface ConversationContext {
  /** آخر عنصر أشار إليه المساعد أو اختاره المستخدم. */
  lastReferencedId: string | null;
  lastReferencedKind: TargetKind | null;
  lastReferencedLabel: LocalizedText | null;
  lastReferencedCoords: Coords | null;
  /** العنصر المرجعي قبل الأخير — لأسئلة "بين الاتنين" (بين ده وده). */
  previousReferencedId: string | null;
  previousReferencedCoords: Coords | null;
}

/** مرحلة الحوار الحالية (تستخدمها آلة حالة الصوت والواجهة). */
export type ConversationState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'awaiting_location'
  | 'awaiting_confirmation';

/**
 * حالة التطبيق التي يراها المساعد (آمنة ومنظّمة).
 * تُبنى في MainApp وتُمرَّر للمحرّك عند كل جولة.
 */
export interface AppState {
  currentScreen: AppScreen;
  currentTab: BodyTab;
  currentBodyView: BodyView;
  currentSex: Sex;
  selectedBodyRegion: string | null;
  selectedAnatomyStructure: string | null;
  selectedPoint: string | null;
  selectedPainLocation: SelectedPainLocation | null;
  /** شدّة الألم الحالية (0..10) إن وُجدت. */
  painSeverity: number | null;
  /** الأعراض التي ذكرها المستخدم (نصوص مُطبّعة). */
  symptoms: string[];
  /** آخر إجراء نفّذه المساعد (نوعه) — لتفادي التكرار وفهم السياق. */
  lastAssistantAction: AssistantActionType | null;
  /** آخر مرجع صريح من المستخدم (نص أو id) — للضمائر والإحالات. */
  lastUserReference: string | null;
  /** مرحلة الحوار الحالية (خاملة/استماع/تفكير/تحدّث/انتظار موقع/انتظار تأكيد). */
  conversationState: ConversationState;
  zoomLevel: number;
  visibleStructures: string[];
  conversationContext: ConversationContext;
  /** السياق الطبي المُجمَّع بين الرسائل (spec #4d). اختياري للتوافق مع الاستدعاءات القديمة. */
  painContext?: PainContext | null;
  language: Lang;
  /** نمط الحوار الحالي (اختياري للتوافق مع الاستدعاءات القديمة). */
  conversationMode?: ConversationMode;
}

/** الإجراءات المنظّمة الآمنة التي ينفّذها التطبيق. */
export type AssistantActionType =
  | 'navigate'
  | 'open_tab'
  | 'set_view'
  | 'set_sex'
  | 'highlight'
  | 'clear_highlight'
  | 'select'
  | 'filter'
  | 'search'
  | 'open'
  | 'back'
  | 'save'
  | 'focus'
  | 'zoom'
  | 'show_details'
  | 'confirm'
  | 'speak'
  | 'set_marker'
  | 'move_marker'
  | 'open_last_entry'
  | 'doctor_summary'
  | 'set_severity'
  | 'close'
  | 'reset_context';

export interface AssistantAction {
  type: AssistantActionType;
  /** معرّف ثابت للهدف (screen id / tab id / organ id / point id / region id). */
  targetId?: string;
  /** قيمة إضافية (اسم التبويب، نص البحث، مستوى التكبير، الشدّة…). */
  value?: string | number;
  /** إن كان الإجراء يحتاج تأكيدًا صريحًا قبل التنفيذ. */
  requiresConfirmation?: boolean;
  /** تسمية بشرية للإجراء (للعرض في شريط التأكيد). */
  label?: LocalizedText;
}

/** عنصر تمّت إجابته من الكتالوج. */
export interface ResolvedTarget {
  id: string;
  kind: TargetKind;
  label: LocalizedText;
  coords?: Coords;
}

/**
 * نمط الحوار الحالي (لطبقات المساعد الثلاث). يُحفظ بين الجولات حتى يبقى السياق
 * محفوظًا عند التبديل بين الكلام العام والطبي والتحكّم.
 */
export type ConversationMode = 'idle' | 'general' | 'medical' | 'app';

/** نتيجة جولة واحدة من الحوار. */
export interface AssistantTurn {
  understood: boolean;
  reply: LocalizedText;
  actions: AssistantAction[];
  resolved: ResolvedTarget[];
  /** إجراءات خطرة/حسّاسة تنتظر تأكيد المستخدم. */
  needsConfirmation: boolean;
  pendingConfirmation: AssistantAction[];
  /** اقتراحات جاهزة (أزرار سريعة). */
  suggestions: LocalizedText[];
  /** الطبقة التي عالجت هذه الجملة (للتتبّع؛ لا تُغيّر السلوك). */
  mode?: ConversationMode;
  /**
   * الردّ الطبي الكامل (فرز/أعراض/أعضاء/رعاية ذاتية) عندما تكون الجملة طبية.
   * يُستخدم لعرض البطاقة الغنية في شاشة «المساعد الذكي» دون محرّك ثانٍ.
   */
  medical?: AssistantReply;
}

/**
 * أمر تحكّم يُمرَّر إلى شاشة الخريطة (BodyPickerScreen) من طبقة المساعد.
 * يحمل nonce يتغيّر مع كل أمر حتى يُعاد تطبيق نفس الأمر عند تكراره.
 */
export interface BodyControlCommand {
  nonce: number;
  tab?: BodyTab;
  view?: BodyView;
  sex?: Sex;
  organId?: string;
  pointId?: string;
  highlightId?: string;
  filter?: string;
  search?: string;
  openDetails?: boolean;
  /** علامة ألم على الخريطة (null لإزالتها). */
  painMarker?: { x: number; y: number; view: BodyView } | null;
}

/** حالة شاشة الخريطة التي تُبلَّغ للمساعد (للفهم البصري). */
export interface BodyScreenState {
  tab: BodyTab;
  view: BodyView;
  sex: Sex;
  organId: string | null;
  pointId: string | null;
}

/** مدخل الكتالوج: كل عنصر قابل للوصف/التحديد في التطبيق. */
export interface CatalogEntry {
  id: string;
  kind: TargetKind;
  label: LocalizedText;
  /** كلمات مفتاحية مُطبّعة (normalized) للمطابقة اللغوية. */
  aliases: string[];
  screen?: AppScreen;
  tab?: BodyTab;
  view?: BodyView;
  sex?: Sex;
  coords?: Coords;
  /** منطقة/مجموعة تشريحية (للفلترة). */
  region?: string;
  /** كود النقطة (مثل LI4). */
  code?: string;
  meta?: Record<string, unknown>;
}
