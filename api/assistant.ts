export interface AssistantRequestBody {
  prompt?: string;
  painContext?: Record<string, any> | string;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { prompt, painContext }: AssistantRequestBody = req.body || {};

  try {
    const responseText = `تم استلام الاستفسار: ${prompt || 'بدون نص'}`;
    return res.status(200).json({ response: responseText, painContext });
  } catch (error) {
    return res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
}
