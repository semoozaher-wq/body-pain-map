// services/appAssistant/actions.ts
// ============================================================================
// سجل الإجراءات الآمنة (Safe Action Registry)
// ----------------------------------------------------------------------------
// يحدّد أي إجراء يُنفَّذ مباشرة وأيّها يحتاج تأكيدًا صريحًا من المستخدم.
// القاعدة:
//   • التنقّل/العرض/التحديد/الفلترة/البحث/التكبير → آمنة (تُنفَّذ فورًا).
//   • الحذف/مسح السجل/الحفظ/تغيير بيانات المستخدم → تحتاج تأكيدًا.
// ============================================================================

import type { AssistantAction, AssistantActionType, Lang, LocalizedText } from './types';

/** تصنيف خطورة كل إجراء. */
export const ACTION_SAFETY: Record<AssistantActionType, 'safe' | 'confirm'> = {
  navigate: 'safe',
  open_tab: 'safe',
  set_view: 'safe',
  set_sex: 'safe',
  highlight: 'safe',
  clear_highlight: 'safe',
  select: 'safe',
  filter: 'safe',
  search: 'safe',
  open: 'safe',
  back: 'safe',
  focus: 'safe',
  zoom: 'safe',
  show_details: 'safe',
  speak: 'safe',
  set_marker: 'safe',
  move_marker: 'safe',
  open_last_entry: 'safe',
  doctor_summary: 'safe',
  save: 'confirm',
  confirm: 'safe',
};

const ACTION_LABELS: Record<AssistantActionType, LocalizedText> = {
  navigate: { ar: 'الانتقال إلى صفحة', en: 'Navigate to a screen', fr: 'Aller à un écran' },
  open_tab: { ar: 'فتح قسم', en: 'Open a section', fr: 'Ouvrir une section' },
  set_view: { ar: 'تبديل العرض', en: 'Switch view', fr: 'Changer la vue' },
  set_sex: { ar: 'تبديل النموذج', en: 'Switch model', fr: 'Changer le modèle' },
  highlight: { ar: 'إبراز عنصر', en: 'Highlight an item', fr: 'Mettre en évidence' },
  clear_highlight: { ar: 'إزالة الإبراز', en: 'Clear highlight', fr: 'Effacer la mise en évidence' },
  select: { ar: 'تحديد عنصر', en: 'Select an item', fr: 'Sélectionner' },
  filter: { ar: 'فلترة', en: 'Filter', fr: 'Filtrer' },
  search: { ar: 'بحث', en: 'Search', fr: 'Rechercher' },
  open: { ar: 'فتح', en: 'Open', fr: 'Ouvrir' },
  back: { ar: 'الرجوع', en: 'Go back', fr: 'Retour' },
  focus: { ar: 'تركيز', en: 'Focus', fr: 'Focus' },
  zoom: { ar: 'تكبير', en: 'Zoom', fr: 'Zoom' },
  show_details: { ar: 'عرض التفاصيل', en: 'Show details', fr: 'Afficher les détails' },
  speak: { ar: 'نطق', en: 'Speak', fr: 'Parler' },
  set_marker: { ar: 'تحديد مكان الألم', en: 'Set pain marker', fr: 'Placer le repère de douleur' },
  move_marker: { ar: 'تحريك علامة الألم', en: 'Move pain marker', fr: 'Déplacer le repère' },
  open_last_entry: { ar: 'فتح آخر تسجيل', en: 'Open last entry', fr: 'Ouvrir la dernière entrée' },
  doctor_summary: { ar: 'توليد ملخص للطبيب', en: 'Generate doctor summary', fr: 'Générer le résumé médecin' },
  save: { ar: 'حفظ', en: 'Save', fr: 'Enregistrer' },
  confirm: { ar: 'تأكيد', en: 'Confirm', fr: 'Confirmer' },
};

/** هل يحتاج الإجراء تأكيدًا؟ */
export function requiresConfirmation(action: AssistantAction): boolean {
  if (typeof action.requiresConfirmation === 'boolean') return action.requiresConfirmation;
  return ACTION_SAFETY[action.type] === 'confirm';
}

/** يضيف تسمية بشرية للإجراء إن لم تكن موجودة. */
export function withLabel(action: AssistantAction, _lang: Lang): AssistantAction {
  if (action.label) return action;
  return { ...action, label: ACTION_LABELS[action.type] };
}

/**
 * يقسّم الإجراءات إلى: ما يُنفَّذ فورًا، وما ينتظر تأكيدًا.
 */
export function splitBySafety(actions: AssistantAction[]): {
  safe: AssistantAction[];
  pending: AssistantAction[];
} {
  const safe: AssistantAction[] = [];
  const pending: AssistantAction[] = [];
  for (const action of actions) {
    if (requiresConfirmation(action)) pending.push(action);
    else safe.push(action);
  }
  return { safe, pending };
}

export function actionLabel(type: AssistantActionType): LocalizedText {
  return ACTION_LABELS[type];
}
