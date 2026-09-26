export type Urgency = 'self_care' | 'routine' | 'soon' | 'urgent' | 'emergency';

export type Condition = {
  q: string;
  op?: 'eq' | 'in' | 'includes' | 'includes_any' | 'includes_all' | 'gte' | 'lte' | 'answered';
  value?: string | number | string[];
};

export type TreeOption = { id: string; labelAr: string };

export type TreeNode =
  | {
      id: string;
      type: 'choice' | 'boolean';
      questionAr: string;
      options?: TreeOption[];
      transitions?: Record<string, string>;
      default?: string;
    }
  | {
      id: string;
      type: 'multi' | 'multi_select';
      questionAr: string;
      options: TreeOption[];
      branches?: Array<{ when: Condition[]; to: string }>;
      default?: string;
    }
  | { id: string; type: 'number'; questionAr: string; bands?: Array<{ min?: number; max?: number; to: string }>; default?: string }
  | { id: string; type: 'outcome'; outcome: OutcomePayload };

export type OutcomePayload = {
  urgency: Urgency;
  titleAr: string;
  specialtyKey: string;
  reasonsAr: string[];
  actionsAr: string[];
  sourceIds?: string[];
};

export type TriageTree = {
  id: string;
  titleAr: string;
  version: string;
  status: 'draft_unvalidated' | 'validated';
  clinicianReview: {
    required: boolean;
    reviewedBy: string | null;
    reviewerLicense?: string | null;
    reviewedAt?: string | null;
    notesAr?: string;
  };
  disclaimerAr: string;
  start: string;
  sources: Array<{ id: string; title: string; url: string; access?: string; noteAr?: string }>;
  redFlagRules: Array<{ id: string; labelAr?: string; when: Condition[]; outcome: OutcomePayload }>;
  nodes: Record<string, TreeNode>;
};

export type TriageResult = {
  ok: boolean;
  complete: boolean;
  urgency: Urgency | null;
  urgencyLabelAr: string | null;
  escalation: boolean;
  titleAr: string | null;
  reasonsAr: string[];
  actionsAr: string[];
  specialtyKey: string | null;
  ruleId: string | null;
  nodeId: string | null;
  via: 'red_flag_rule' | 'tree' | null;
  sources: Array<{ id: string; title: string; url: string }>;
  status: string;
  clinicianReview: TriageTree['clinicianReview'] | null;
  validated: boolean;
  disclaimerAr: string | null;
  pendingQuestion?: TreeNode | null;
  aiNarrative?: string | null;
  aiNarrativeMutatesUrgency?: boolean;
};

export const URGENCY_ORDER: Urgency[];
export const URGENCY_LABELS_AR: Record<Urgency, string>;

export function matchCondition(answers: Record<string, unknown>, cond: Condition): boolean;
export function matchAll(answers: Record<string, unknown>, conditions: Condition[]): boolean;
export function evaluateRedFlags(tree: TriageTree, answers: Record<string, unknown>): TriageTree['redFlagRules'][number] | null;
export function resolveTransition(node: TreeNode, answers: Record<string, unknown>): string | null;
export function nextStep(
  tree: TriageTree,
  answers: Record<string, unknown>
): { kind: 'question'; node: TreeNode } | { kind: 'outcome'; outcome: OutcomePayload & { nodeId: string | null; ruleId?: string } } | { kind: 'error'; error: string; at?: string };
export function evaluateTriage(tree: TriageTree, answers: Record<string, unknown>): TriageResult;
export function validateTree(tree: TriageTree): { ok: boolean; errors: string[]; warnings: string[] };
export function buildAiExplanationPrompt(result: TriageResult, tree: TriageTree): string;
export function mergeAiNarrative(result: TriageResult, aiText: string | null): TriageResult;
