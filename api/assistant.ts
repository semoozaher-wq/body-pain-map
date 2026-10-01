// api/assistant.ts
// ============================================================================
// نقطة نهاية خادمية (Serverless endpoint) لطبقة الذكاء الاصطناعي — Gemini.
// ----------------------------------------------------------------------------
// • هذا هو المكان الوحيد الذي يُقرأ فيه مفتاح GEMINI_API_KEY (من بيئة الخادم).
// • المفتاح لا يُرسَل أبدًا إلى تطبيق العميل ولا يُسجَّل في السجلات.
// • يستقبل: { text, image?, language, context? } ويُعيد: { decision: <Structured JSON> }.
// • عند أي فشل يُعيد { decision: null } كي يسقط التطبيق إلى المحرّك القائم على القواعد.
//
// النشر: Vercel يكتشف مجلد api/ تلقائيًا. اضبط متغيّر البيئة GEMINI_API_KEY
// (واختياريًا GEMINI_MODEL) في إعدادات المشروع على Vercel — وليس في الكود.
// ============================================================================

import { GEMINI_SYSTEM_PROMPT } from '../services/aiAssistant/gemini';

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

/** يستخرج أول JSON صالح من نص النموذج (يتحمّل أسوار ```json). */
function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
    if (fenced) {
      try {
        return JSON.parse(fenced[1].trim());
      } catch {
        /* fall through */
      }
    }
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');
    if (first !== -1 && last > first) {
      try {
        return JSON.parse(trimmed.slice(first, last + 1));
      } catch {
        /* fall through */
      }
    }
    return null;
  }
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

  const parts: Array<Record<string, unknown>> = [{ text: buildUserText(body) }];
  const image = parseDataUrl(body.image);
  if (image) parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: GEMINI_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!geminiRes.ok) {
      // لا نطبع المفتاح ولا جسم الطلب؛ رمز الحالة فقط.
      res.status(200).json({ decision: null, error: `gemini_${geminiRes.status}` });
      return;
    }

    const payload = (await geminiRes.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const rawText = (payload.candidates?.[0]?.content?.parts ?? [])
      .map((p) => (typeof p.text === 'string' ? p.text : ''))
      .join('');
    const decision = extractJson(rawText);
    if (!decision) {
      res.status(200).json({ decision: null, error: 'unparseable' });
      return;
    }
    res.status(200).json({ decision });
  } catch {
    res.status(200).json({ decision: null, error: 'request_failed' });
  } finally {
    clearTimeout(timer);
  }
}
