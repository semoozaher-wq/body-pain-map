// api/assistant.ts
// ============================================================================
// نقطة نهاية خادمية (Serverless endpoint) لطبقة الذكاء الاصطناعي — Gemini.
// ----------------------------------------------------------------------------
// • هذا هو المكان الوحيد الذي يُقرأ فيه مفتاح GEMINI_API_KEY (من بيئة الخادم).
// • المفتاح لا يُرسَل أبدًا إلى تطبيق العميل ولا يُسجَّل في السجلات.
// • يستقبل: { text, image?, language, context? } ويُعيد: { decision: <Structured JSON> }.
// • عند أي فشل يُعيد { decision: null } كي يسقط التطبيق إلى المحرّك القائم على القواعد.
//
// الترقية (Vercel AI SDK): صار توليد القرار المنظّم يتم عبر `generateObject` من
// حزمة `ai` + مزوّد `@ai-sdk/google` + مخطط `zod` مشترك (Structured Output)،
// بدل نداء REST يدوي. عقد الاستجابة `{ decision }` لم يتغيّر، لذا بقي مسار
// العميل (services/aiAssistant/gemini.ts → requestGeminiDecision) كما هو تمامًا.
//
// النشر: Vercel يكتشف مجلد api/ تلقائيًا. اضبط متغيّر البيئة GEMINI_API_KEY
// (واختياريًا GEMINI_MODEL) في إعدادات المشروع على Vercel — وليس في الكود.
// ============================================================================

import { generateObject, APICallError, NoObjectGeneratedError } from 'ai';
import type { UserModelMessage } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { GEMINI_SYSTEM_PROMPT } from '../services/aiAssistant/gemini';
import { assistantDecisionSchema } from '../services/aiAssistant/schema';

// أنواع مبسّطة (بلا اعتماد على حزم خارجية) حتى يمرّ tsc --noEmit.
interface ServerRequest {
  method?: string;
  body?: unknown;
}
interface ServerResponse {
  status: (code: number) => ServerResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
  end: () => void;
}

const GEMINI_MODEL = String(process.env.GEMINI_MODEL ?? 'gemini-2.5-flash').trim() || 'gemini-2.5-flash';
const GEMINI_TIMEOUT_MS = 15_000;

interface InlineImage {
  mimeType: string;
  data: string;
}

/** يحوّل data URL إلى جزء inlineData لـ Gemini، أو null إن كان غير صالح. */
function parseDataUrl(dataUrl: unknown): InlineImage | null {
  if (typeof dataUrl !== 'string') return null;
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl.trim());
  if (!match) return null;
  const mimeType = match[1] || 'image/jpeg';
  const data = match[2];
  if (!data || data.length > 12_000_000) return null;
  return { mimeType, data };
}

/** يبني نص المستخدم (اللغة + السياق + الكلام). */
function buildUserText(body: Record<string, unknown>): string {
  const language = typeof body.language === 'string' ? body.language : 'ar';
  const text = typeof body.text === 'string' ? body.text : '';
  const context = body.context ?? null;
  return [
    `language: ${language}`,
    `context: ${JSON.stringify(context ?? {})}`,
    `user: ${text}`,
  ].join('\n');
}

/** يبني رسائل النموذج (نص + صورة اختيارية) بصيغة Vercel AI SDK. */
function buildMessages(body: Record<string, unknown>): UserModelMessage[] {
  const userText = buildUserText(body);
  const image = parseDataUrl(body.image);
  const content: UserModelMessage['content'] = image
    ? [
        { type: 'text', text: userText },
        { type: 'image', image: image.data, mediaType: image.mimeType },
      ]
    : userText;
  return [{ role: 'user', content }];
}

export default async function handler(req: ServerRequest, res: ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method && req.method !== 'POST') {
    res.status(405).json({ decision: null, error: 'method_not_allowed' });
    return;
  }

  const apiKey = String(process.env.GEMINI_API_KEY ?? '').trim();
  if (!apiKey) {
    // لا مفتاح ⇒ لا نُفشل التطبيق: نُعيد null ليسقط إلى المحرّك القائم على القواعد.
    res.status(200).json({ decision: null, error: 'not_configured' });
    return;
  }

  let body: Record<string, unknown>;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body as Record<string, unknown>) ?? {};
  } catch {
    res.status(400).json({ decision: null, error: 'bad_json' });
    return;
  }

  const provider = createGoogleGenerativeAI({ apiKey });
  const messages = buildMessages(body);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    // توليد قرار منظّم (Structured Output) عبر zod: يضمن أن الشكل مطابق للعقد.
    const { object } = await generateObject({
      model: provider(GEMINI_MODEL),
      schema: assistantDecisionSchema,
      schemaName: 'AssistantDecision',
      schemaDescription: 'قرار موحّد لمساعد BodyMap Pain: نية + ردّ بلغة المستخدم + سياق طبي + إجراءات تطبيق.',
      system: GEMINI_SYSTEM_PROMPT,
      messages,
      temperature: 0.2,
      maxOutputTokens: 1024,
      maxRetries: 0,
      abortSignal: controller.signal,
    });
    res.status(200).json({ decision: object });
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      res.status(200).json({ decision: null, error: 'unparseable' });
    } else if (APICallError.isInstance(error)) {
      // لا نطبع المفتاح ولا جسم الطلب؛ رمز الحالة فقط.
      res.status(200).json({ decision: null, error: `gemini_${error.statusCode ?? 'error'}` });
    } else {
      res.status(200).json({ decision: null, error: 'request_failed' });
    }
  } finally {
    clearTimeout(timer);
  }
}
