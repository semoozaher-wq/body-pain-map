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
}

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
  zoomLevel: number;
  visibleStructures: string[];
  conversationContext: ConversationContext;
  language: Lang;
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
  | 'speak';

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
