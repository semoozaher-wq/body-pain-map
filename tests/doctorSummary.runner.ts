// tests/doctorSummary.runner.ts
// ============================================================================
// Functional verification for the SHORT doctor-summary feature.
// Runs the rule-based engine on representative Arabic scenarios and prints a
// JSON report so we can assert:
//   • self_care / routine  -> doctorSummary === ''
//   • soon / urgent / emergency (or any red flag) -> a SHORT summary with the
//     five required fields + the explicit closing line "خذ هذا الملخص معك للطبيب."
// No network access: we call analyzeMessage() directly (rule-based path).
// ============================================================================

import { analyzeMessage } from '../services/aiAssistant/engine';
import type { AssistantReply } from '../services/aiAssistant/engine';

type Scenario = {
  name: string;
  text: string;
  expectSummary: boolean;
};

const scenarios: Scenario[] = [
  // --- self_care: mild, no red flags, single region, short duration -------
  { name: 'self_care_mild_neck', text: 'عندي ألم خفيف في الرقبة', expectSummary: false },
  { name: 'self_care_mild_knee', text: 'ألم بسيط في الركبة من يومين', expectSummary: false },

  // --- routine: long duration or multiple regions -------------------------
  { name: 'routine_long_duration', text: 'ألم في الكتف من أسابيع', expectSummary: false },

  // --- soon: severity >= 7 ------------------------------------------------
  { name: 'soon_severity_8', text: 'ألم في أسفل ظهري شدته 8 من 3 أيام', expectSummary: true },

  // --- urgent: severity >= 9 ----------------------------------------------
  { name: 'urgent_severity_9', text: 'ألم شديد في الرقبة شدته 9', expectSummary: true },

  // --- emergency: chest pressure red flag ---------------------------------
  { name: 'emergency_chest_pressure', text: 'ضغط في صدري مع ضيق نفس', expectSummary: true },

  // --- urgent red flag: leg heaviness with swelling -----------------------
  { name: 'urgent_leg_swelling', text: 'ثقل في الساق مع تورم', expectSummary: true },

  // --- soon + aggravating/relieving factors -------------------------------
  { name: 'soon_with_factors', text: 'ألم في أسفل ظهري شدته 8 من 3 أيام، بيزيد بعد الجلوس الطويل وبيخف مع الراحة', expectSummary: true },
];

const CLOSING_AR = 'خذ هذا الملخص معك للطبيب.';

function run(): void {
  const results = scenarios.map((scenario) => {
    const reply: AssistantReply = analyzeMessage(scenario.text, 'ar');
    const summary = reply.doctorSummary ?? '';
    const lines = summary ? summary.split('\n') : [];
    const hasClosing = summary.includes(CLOSING_AR);
    const hasFiveFields = [
      'مكان الألم',
      'المدة',
      'الشدة',
      'الأعراض المصاحبة',
      'ما يزيده أو يخففه',
    ].every((field) => summary.includes(field));
    // Short = header + 5 field lines + closing line = 7 lines max.
    const isShort = lines.length > 0 && lines.length <= 7;
    return {
      name: scenario.name,
      text: scenario.text,
      triage: reply.triage?.level ?? null,
      redFlagCount: reply.painContext?.redFlags?.length ?? 0,
      expectSummary: scenario.expectSummary,
      gotSummary: summary.length > 0,
      ok: scenario.expectSummary === (summary.length > 0),
      hasClosing,
      hasFiveFields,
      lineCount: lines.length,
      isShort,
      summary,
    };
  });

  const failures = results.filter((r) => !r.ok);
  const summaryFailures = results.filter((r) => r.gotSummary && (!r.hasClosing || !r.hasFiveFields || !r.isShort));

  console.log(JSON.stringify({ results, failures: failures.length, summaryFailures: summaryFailures.length }, null, 2));

  if (failures.length > 0 || summaryFailures.length > 0) {
    process.exitCode = 1;
  }
}

run();
