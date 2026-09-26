'use strict';

/**
 * محرك شجرة الفرز (Triage Decision Tree Engine) — نموذج تصميمي أوّلي.
 *
 * الفكرة المعمارية:
 *  1) المنطق الطبي يسكن في بيانات (JSON) لا في الكود، فيراجعه طبيب بشري ويعدّله بلا برمجة.
 *  2) القواعد (red flags) تُقيَّم قبل المشي في الشجرة، لأن الطوارئ لا تنتظر إكمال الأسئلة.
 *  3) طبقة الذكاء الاصطناعي لا تملك تغيير درجة الخطورات إطلاقًا؛ دورها فهم لغة المستخدم
 *     وتوليد الكلام التوضيحي فقط (mergeAiNarrative / buildAiExplanationPrompt).
 *  4) كل ناتج يحمل وسم `status` و`clinicianReview` — ولا يُعرض كمنطق طبي موثّق قبل المراجعة.
 *
 * هذا الملف بلا أي اعتماد خارجي ليعمل في الويب وفي اختبارات Node.
 */

const URGENCY_ORDER = ['self_care', 'routine', 'soon', 'urgent', 'emergency'];

const URGENCY_LABELS_AR = {
  self_care: 'رعاية منزلية مع متابعة',
  routine: 'مراجعة طبيب بموعد عادي',
  soon: 'مراجعة طبيب خلال أيام',
  urgent: 'تقييم طبي خلال 24 ساعة',
  emergency: 'طوارئ — تدخّل إسعافي فوري',
};

function isObj(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasAnswer(node, answers) {
  const raw = answers ? answers[node.id] : undefined;
  if (raw === undefined || raw === null) return false;
  if (node.type === 'multi' || node.type === 'multi_select') {
    return Array.isArray(raw) && raw.length > 0;
  }
  if (node.type === 'number') return typeof raw === 'number' && Number.isFinite(raw);
  return true;
}

/** تقييم شرط واحد ضد إجابات المستخدم. */
function matchCondition(answers, cond) {
  if (!isObj(cond)) return false;
  const raw = answers ? answers[cond.q] : undefined;
  const op = cond.op || 'eq';
  switch (op) {
    case 'eq':
      return raw === cond.value;
    case 'in':
      return Array.isArray(cond.value) && cond.value.indexOf(raw) !== -1;
    case 'includes':
      return Array.isArray(raw) && raw.indexOf(cond.value) !== -1;
    case 'includes_any':
      return Array.isArray(raw) && Array.isArray(cond.value) && cond.value.some((v) => raw.indexOf(v) !== -1);
    case 'includes_all':
      return Array.isArray(raw) && Array.isArray(cond.value) && cond.value.every((v) => raw.indexOf(v) !== -1);
    case 'gte':
      return typeof raw === 'number' && raw >= cond.value;
    case 'lte':
      return typeof raw === 'number' && raw <= cond.value;
    case 'answered':
      return raw !== undefined && raw !== null && !(Array.isArray(raw) && raw.length === 0);
    default:
      return false;
  }
}

function matchAll(answers, conditions) {
  return Array.isArray(conditions) && conditions.length > 0 && conditions.every((c) => matchCondition(answers, c));
}

/** أول قاعدة إنذار تنطبق — الترتيب في الملف هو ترتيب الأولوية. */
function evaluateRedFlags(tree, answers) {
  const rules = Array.isArray(tree.redFlagRules) ? tree.redFlagRules : [];
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (matchAll(answers, rule.when)) return rule;
  }
  return null;
}

function resolveTransition(node, answers) {
  const raw = answers ? answers[node.id] : undefined;

  if (node.type === 'multi' || node.type === 'multi_select') {
    const branches = Array.isArray(node.branches) ? node.branches : [];
    for (let i = 0; i < branches.length; i++) {
      if (matchAll(answers, branches[i].when)) return branches[i].to;
    }
    return node.default || null;
  }

  if (node.type === 'number') {
    const bands = Array.isArray(node.bands) ? node.bands : [];
    for (let i = 0; i < bands.length; i++) {
      const band = bands[i];
      const minOk = band.min === undefined || (typeof raw === 'number' && raw >= band.min);
      const maxOk = band.max === undefined || (typeof raw === 'number' && raw <= band.max);
      if (minOk && maxOk) return band.to;
    }
    return node.default || null;
  }

  const table = node.transitions || {};
  if (typeof raw === 'string' && table[raw]) return table[raw];
  return node.default || null;
}

/** الموقع التالي في المسار: سؤال جديد، أو نتيجة نهائية، أو خطأ في الشجرة. */
function nextStep(tree, answers) {
  const safeAnswers = answers || {};
  const flag = evaluateRedFlags(tree, safeAnswers);
  if (flag) {
    return {
      kind: 'outcome',
      via: 'red_flag_rule',
      outcome: Object.assign({}, flag.outcome, {
        nodeId: null,
        ruleId: flag.id,
        ruleLabelAr: flag.labelAr || null,
      }),
    };
  }

  const visited = [];
  let currentId = tree.start;
  while (currentId) {
    if (visited.indexOf(currentId) !== -1) return { kind: 'error', error: 'loop_detected', at: currentId };
    visited.push(currentId);

    const node = tree.nodes ? tree.nodes[currentId] : null;
    if (!node) return { kind: 'error', error: 'missing_node', at: currentId };
    if (node.type === 'outcome') {
      return { kind: 'outcome', via: 'tree', outcome: Object.assign({ nodeId: node.id }, node.outcome) };
    }
    if (!hasAnswer(node, safeAnswers)) return { kind: 'question', node };

    const targetId = resolveTransition(node, safeAnswers);
    if (!targetId) return { kind: 'error', error: 'no_transition', at: node.id };
    currentId = targetId;
  }
  return { kind: 'error', error: 'empty_path' };
}

function resolveSources(tree, ids) {
  const list = Array.isArray(tree.sources) ? tree.sources : [];
  const wanted = Array.isArray(ids) ? ids : [];
  const out = [];
  for (let i = 0; i < wanted.length; i++) {
    const hit = list.filter((s) => s.id === wanted[i])[0];
    if (hit) out.push(hit);
  }
  return out;
}

/** الناتج النهائي: درجة الخطورات + الأسباب + التخصص + المصادر + حالة المراجعة. */
function evaluateTriage(tree, answers) {
  const step = nextStep(tree, answers);
  const base = {
    ok: false,
    urgency: null,
    urgencyLabelAr: null,
    escalation: false,
    titleAr: null,
    reasonsAr: [],
    actionsAr: [],
    specialtyKey: null,
    ruleId: null,
    nodeId: null,
    via: step.via || null,
    sources: [],
    status: tree.status || 'unknown',
    clinicianReview: tree.clinicianReview || null,
    validated: Boolean(tree.clinicianReview && tree.clinicianReview.reviewedBy),
    disclaimerAr: tree.disclaimerAr || null,
  };

  if (step.kind === 'question') {
    return Object.assign(base, { ok: true, complete: false, pendingQuestion: step.node });
  }
  if (step.kind === 'error') {
    return Object.assign(base, { complete: false, error: step.error, errorAt: step.at });
  }

  const outcome = step.outcome || {};
  const urgency = outcome.urgency || null;
  return Object.assign(base, {
    ok: Boolean(urgency),
    complete: true,
    urgency: urgency,
    urgencyLabelAr: URGENCY_LABELS_AR[urgency] || null,
    escalation: urgency === 'urgent' || urgency === 'emergency',
    titleAr: outcome.titleAr || null,
    reasonsAr: Array.isArray(outcome.reasonsAr) ? outcome.reasonsAr.slice() : [],
    actionsAr: Array.isArray(outcome.actionsAr) ? outcome.actionsAr.slice() : [],
    specialtyKey: outcome.specialtyKey || null,
    ruleId: outcome.ruleId || null,
    nodeId: outcome.nodeId || null,
    sources: resolveSources(tree, outcome.sourceIds),
    pendingQuestion: null,
  });
}

/** فحص سلامة الشجرة قبل النشر — يمنع مسارات ميتة ونتائج بلا درجة خطورات. */
function validateTree(tree) {
  const errors = [];
  const warnings = [];
  if (!isObj(tree)) return { ok: false, errors: ['tree_not_object'], warnings: warnings };

  const nodes = isObj(tree.nodes) ? tree.nodes : null;
  if (!nodes) errors.push('nodes_missing');
  if (!tree.start) errors.push('start_missing');
  if (nodes && tree.start && !nodes[tree.start]) errors.push('start_node_missing:' + tree.start);

  const targetIds = [];
  if (nodes) {
    Object.keys(nodes).forEach((id) => {
      const node = nodes[id];
      if (node.type === 'outcome') {
        if (!node.outcome || URGENCY_ORDER.indexOf(node.outcome.urgency) === -1) {
          errors.push('outcome_urgency_invalid:' + id);
        }
        return;
      }
      if (node.default) targetIds.push([id, node.default]);
      if (node.transitions) {
        Object.keys(node.transitions).forEach((k) => targetIds.push([id, node.transitions[k]]));
      }
      if (Array.isArray(node.branches)) node.branches.forEach((b) => targetIds.push([id, b.to]));
      if (Array.isArray(node.bands)) node.bands.forEach((b) => targetIds.push([id, b.to]));
    });
  }

  targetIds.forEach((pair) => {
    if (nodes && !nodes[pair[1]]) errors.push('dangling_target:' + pair[0] + '->' + pair[1]);
  });

  const rules = Array.isArray(tree.redFlagRules) ? tree.redFlagRules : [];
  rules.forEach((rule, index) => {
    if (!Array.isArray(rule.when) || rule.when.length === 0) errors.push('red_flag_without_condition:' + index);
    if (!rule.outcome || URGENCY_ORDER.indexOf(rule.outcome.urgency) === -1) {
      errors.push('red_flag_outcome_invalid:' + (rule.id || index));
    }
  });

  if (!tree.disclaimerAr) errors.push('disclaimer_missing');
  if (!tree.clinicianReview || tree.clinicianReview.required !== true) errors.push('clinician_review_flag_missing');
  if (tree.clinicianReview && !tree.clinicianReview.reviewedBy) {
    warnings.push('clinician_review_pending — الشجرة غير موثّقة المراجعة ولا يجوز إطلاقها للمستخدمين');
  }
  if (tree.status !== 'validated') warnings.push('tree_status_not_validated');

  return { ok: errors.length === 0, errors: errors, warnings: warnings };
}

/**
 * تعليمات طبقة الذكاء الاصطناعي: النموذج يُحرّر كلامًا فقط.
 * يُمرَّر الناتج إلى أي مزوّد LLM، ويُمنع صريحًا من تغيير درجة الخطورات.
 */
function buildAiExplanationPrompt(result, tree) {
  const title = (tree && tree.titleAr) || '';
  const reasons = (result && result.reasonsAr ? result.reasonsAr : []).join(' | ');
  return [
    'أنت مساعد يشرح للمستخدم نتيجة فرز محسوبة مسبقًا عبر قواعد ثابتة. مهمتك الشرح لا التشخيص.',
    'قواعد صارمة:',
    '1) لا تغيّر درجة الخطورات المذكورة أدناه ولا تختلق درجة جديدة.',
    '2) لا تذكر تشخيصًا قاطعًا؛ استخدم صياغة «قد يرتبط بـ» و«يحتاج تقييمًا».',
    '3) لا توصِ بجرعة أو دواء محدد. لا تُقلّل من أهمية العلامات التحذيرية أبدًا.',
    '4) اجعل الرد في حدود 120 كلمة بالعربية الفصحى المبسطة، واختم بجملة الإخلاء الطبي.',
    ' المنطقة: ' + title,
    ' درجة الخطورات المحسوبة: ' + ((result && result.urgency) || '') + ' — ' + ((result && result.urgencyLabelAr) || ''),
    ' أسباب الفرز: ' + reasons,
    ' إخلاء المسؤولية الواجب إرفاقه: ' + ((tree && tree.disclaimerAr) || 'فرز إرشادي وليس تشخيصًا.'),
  ].join('\n');
}

/** إلحاق الشرح اللغوي بالناتج مع الحفاظ التام على درجة الخطورات المحسوبة. */
function mergeAiNarrative(result, aiText) {
  return Object.assign({}, result, {
    aiNarrative: typeof aiText === 'string' ? aiText.trim() : null,
    aiNarrativeMutatesUrgency: false,
  });
}

module.exports = {
  URGENCY_ORDER,
  URGENCY_LABELS_AR,
  matchCondition,
  matchAll,
  evaluateRedFlags,
  resolveTransition,
  nextStep,
  evaluateTriage,
  validateTree,
  buildAiExplanationPrompt,
  mergeAiNarrative,
};
