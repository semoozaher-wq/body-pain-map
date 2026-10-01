// tests/geminiIntegration.runner.ts
// ============================================================================
// اختبار تكامل حقيقي (Integration) يستدعي Gemini API الفعلي عبر نقطة النهاية
// الخادمية الحقيقية api/assistant.ts (handler). المسار الكامل:
//
//   User question → Retrieval → Grounded Prompt → Gemini → Structured Response
//
// • إن لم يوجد GEMINI_API_KEY في البيئة، يُخرج { skipped: true } ولا يفشل
//   (حتى لا يكسر CI في بيئة بلا مفتاح)، ويُبلّغ بوضوح أن Gemini الحقيقي لم يُختبر.
// • إن وُجد المفتاح، يستدعي الـhandler فعليًا ويجمع أدلة تُثبت أن Gemini استخدم
//   المعلومات المسترجَعة ومصادرها، ويتحقّق من مسار no_reliable_knowledge.
//
// لا يخترع بيانات طبية ولا مصادر. لا يغيّر أي سلوك في التطبيق.
// ============================================================================

import handler, { prepareGroundedRequest } from '../api/assistant';
import { retrieveMedicalKnowledge, NO_RELIABLE_KNOWLEDGE } from '../services/medical/knowledgeRetrieval';
import { ASSISTANT_INTENTS } from '../services/aiAssistant/schema';

const API_KEY = String(process.env.GEMINI_API_KEY ?? '').trim();

// ── أسئلة الاختبار ─────────────────────────────────────────────────────────
// سؤال له معرفة موثوقة في المكتبة (يُرجع حالة "Migraine" مع مصادر مباشرة).
const GROUNDED_QUERY = { text: 'migraine', language: 'en' as const };
// سؤال لا توجد له معرفة في المكتبة ⇒ يجب أن ينتج no_reliable_knowledge.
const NO_KNOWLEDGE_QUERY = { text: 'xyzzy nonsense 12345', language: 'en' as const };

// ── استدعاء نقطة النهاية الحقيقية (handler) بكائنات req/res وهمية ──────────
interface Captured {
  statusCode: number;
  body: { decision?: unknown; error?: string } | null;
}

async function callEndpoint(text: string, language: string): Promise<Captured> {
  const captured: Captured = { statusCode: 0, body: null };
  const res = {
    status(code: number) {
      captured.statusCode = code;
      return res;
    },
    json(body: unknown) {
      captured.body = body as Captured['body'];
      return res;
    },
    setHeader() {
      /* no-op */
    },
    end() {
      /* no-op */
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await handler({ method: 'POST', body: { text, language } } as any, res as any);
  return captured;
}

// ── أدوات مساعدة ────────────────────────────────────────────────────────────
const norm = (s: unknown) => String(s ?? '').toLowerCase();

function decisionShape(decision: unknown) {
  const d = decision as Record<string, unknown> | null;
  if (!d || typeof d !== 'object') {
    return { isObject: false, intentValid: false, replyIsString: false, replyLength: 0 };
  }
  const intent = typeof d.intent === 'string' ? d.intent : '';
  const reply = typeof d.reply === 'string' ? d.reply : '';
  return {
    isObject: true,
    intentValid: (ASSISTANT_INTENTS as readonly string[]).includes(intent),
    replyIsString: typeof d.reply === 'string',
    replyLength: reply.length,
  };
}

async function main() {
  if (!API_KEY) {
    process.stdout.write(
      JSON.stringify({
        skipped: true,
        reason: 'no_api_key',
        note: 'GEMINI_API_KEY غير موجود في بيئة التشغيل؛ لم يُنفَّذ اختبار Gemini الحقيقي. الاختبار جاهز ويعمل تلقائيًا عند توفّر المفتاح.',
        configured: false,
        constants: { NO_RELIABLE_KNOWLEDGE },
      }),
    );
    return;
  }

  // ── (1) المسار المُقيَّد بالمعرفة: User → Retrieval → Grounded Prompt → Gemini → Structured Response ──
  const prep = prepareGroundedRequest({ text: GROUNDED_QUERY.text, language: GROUNDED_QUERY.language });
  const retrieval = retrieveMedicalKnowledge(GROUNDED_QUERY.text, GROUNDED_QUERY.language);
  const topItem = retrieval.items[0];
  const topName = topItem?.name ?? '';
  const sourceUrls = retrieval.items.flatMap((i) => i.sources.map((s) => s.url));
  const sourceTitles = retrieval.items.flatMap((i) => i.sources.map((s) => s.title));
  const sourceDomains = Array.from(
    new Set(
      sourceUrls
        .map((u) => {
          try {
            return new URL(u).hostname.replace(/^www\./, '');
          } catch {
            return '';
          }
        })
        .filter(Boolean),
    ),
  );

  const groundedCall = await callEndpoint(GROUNDED_QUERY.text, GROUNDED_QUERY.language);
  const groundedDecision = groundedCall.body?.decision ?? null;
  const groundedReply = (groundedDecision as { reply?: string } | null)?.reply ?? '';
  const replyNorm = norm(groundedReply);

  const grounded = {
    query: GROUNDED_QUERY.text,
    language: GROUNDED_QUERY.language,
    endpointStatusCode: groundedCall.statusCode,
    endpointError: groundedCall.body?.error ?? null,
    // الاسترجاع
    retrievalStatus: retrieval.status,
    retrievalItemCount: retrieval.items.length,
    topName,
    sourceCount: sourceUrls.length,
    sourceDomains,
    // الـPrompt المُقيَّد الذي أُرسل إلى Gemini
    systemHasTopName: topName ? prep.system.includes(topName) : false,
    systemHasSourceUrl: sourceUrls.length ? sourceUrls.some((u) => prep.system.includes(u)) : false,
    systemHasKnowledgeLayer: prep.system.includes('KNOWLEDGE LAYER'),
    // الاستجابة المنظّمة من Gemini
    decisionShape: decisionShape(groundedDecision),
    reply: groundedReply,
    // هل استخدم Gemini المعلومات المسترجَعة فعلًا؟ (الاسم + المصدر)
    replyMentionsRetrievedName: topName ? replyNorm.includes(norm(topName)) : false,
    replyMentionsSourceDomain: sourceDomains.some((d) => replyNorm.includes(norm(d))),
    replyMentionsAnySourceTitle: sourceTitles.some((t) => t && replyNorm.includes(norm(t))),
    decision: groundedDecision,
  };

  // ── (2) مسار no_reliable_knowledge ──────────────────────────────────────────
  const prepNo = prepareGroundedRequest({ text: NO_KNOWLEDGE_QUERY.text, language: NO_KNOWLEDGE_QUERY.language });
  const noCall = await callEndpoint(NO_KNOWLEDGE_QUERY.text, NO_KNOWLEDGE_QUERY.language);
  const noDecision = noCall.body?.decision ?? null;
  const noReply = (noDecision as { reply?: string } | null)?.reply ?? '';
  const noReplyNorm = norm(noReply);
  const noKnowledgePhrases = [
    'no reliable',
    'لا أملك',
    'لا توجد',
    'لا تتوفر',
    'لا تتوفّر',
    'not have',
    'do not have',
    'استشارة',
    'consult',
    'specialist',
    'مختص',
  ];

  const noKnowledge = {
    query: NO_KNOWLEDGE_QUERY.text,
    language: NO_KNOWLEDGE_QUERY.language,
    endpointStatusCode: noCall.statusCode,
    endpointError: noCall.body?.error ?? null,
    retrievalStatus: retrieval.status === 'ok' ? 'ok' : retrieval.status, // informational
    noRetrievalStatus: retrieveMedicalKnowledge(NO_KNOWLEDGE_QUERY.text, NO_KNOWLEDGE_QUERY.language).status,
    noRetrievalItemCount: retrieveMedicalKnowledge(NO_KNOWLEDGE_QUERY.text, NO_KNOWLEDGE_QUERY.language).items.length,
    systemHasSentinel: prepNo.system.includes(NO_RELIABLE_KNOWLEDGE),
    decisionShape: decisionShape(noDecision),
    reply: noReply,
    replySignalsNoKnowledge: noKnowledgePhrases.some((p) => noReplyNorm.includes(norm(p))),
    decision: noDecision,
  };

  const out = {
    skipped: false,
    configured: true,
    grounded,
    noKnowledge,
    constants: { NO_RELIABLE_KNOWLEDGE },
  };

  process.stdout.write(JSON.stringify(out));
}

main().catch((err) => {
  process.stdout.write(
    JSON.stringify({
      skipped: false,
      configured: true,
      fatal: true,
      error: String(err?.message ?? err),
      constants: { NO_RELIABLE_KNOWLEDGE },
    }),
  );
});
