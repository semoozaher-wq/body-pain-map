// services/appAssistant/generalChat.ts
// ============================================================================
// طبقة المحادثة العامة (General AI Conversation Layer)
// ----------------------------------------------------------------------------
// هذه الطبقة مسؤولة عن الكلام الحرّ الذي لا يخصّ الألم ولا التحكّم في التطبيق:
//   • التحيّة ("مساء الخير"، "إزيك")            • السؤال عن الحال ("عامل إيه؟")
//   • المشاعر ("أنا زهقان"، "مخنوق")            • تغيير الموضوع ("غيّر الموضوع")
//   • الشكر ("شكرًا")                            • الوداع ("سلام"، "باي")
//   • الهوية ("انت مين؟")                        • القدرات ("بتعرف تعمل إيه؟")
//
// مهم جدًا (شفافية): هذه الطبقة **قائمة على قواعد (rule-based)** وليست نموذجًا
// لغويًا كبيرًا (LLM). لا يوجد أي اتصال بنموذج ذكاء اصطناعي خارجي في المشروع.
// الهدف هنا أن نتوقف عن الردّ الافتراضي «معليش، مفهمتش الطلب» على الكلام العام،
// وأن نصنّف الجملة إلى: محادثة عامة / محادثة طبية / تحكّم في التطبيق / غامضة.
//
// التصنيف محافظ عن قصد: لا يطابق إلا عند وجود كلمات مفتاحية واضحة، حتى لا
// يسرق جملًا طبية أو أوامر تطبيق (مثل "كلام عشوائي مالوش معنى" تبقى غير مفهومة).
// ============================================================================

import { normalize } from './catalog';
import type { Lang, LocalizedText } from './types';

const L = (ar: string, en: string, fr: string): LocalizedText => ({ ar, en, fr });

export type GeneralChatKind =
  | 'greeting'
  | 'howareyou'
  | 'emotion'
  | 'topic_change'
  | 'thanks'
  | 'farewell'
  | 'identity'
  | 'help'
  | 'chat_request'
  | 'knowledge_question';

// ---------------------------------------------------------------------------
// مفردات التصنيف (مُطبّعة عبر normalize: توحيد الهمزات والياء والتاء المربوطة)
// ---------------------------------------------------------------------------
const PHRASES: Record<GeneralChatKind, string[]> = {
  greeting: [
    'مساء الخير', 'مساء النور', 'صباح الخير', 'صباح النور', 'صباحو',
    'اهلا', 'اهلين', 'اهلا بيك', 'مرحبا', 'هاي', 'هلا', 'هلا والله',
    'السلام عليكم', 'سلام عليكم', 'ازيك', 'ازيك يا', 'ازيكم', 'ازيك عامل ايه',
    'hello', 'hi', 'hey', 'bonjour', 'salut', 'bonsoir', 'coucou',
  ],
  howareyou: [
    'عامل ايه', 'عامله ايه', 'عامل ايه يا', 'اخبارك', 'اخبارك ايه', 'ايه الاخبار',
    'ايه الجديد', 'كيفك', 'كيف حالك', 'شلونك', 'اخبارك اخبار',
    'how are you', 'how r u', 'comment ca va', 'comment vas tu', 'ca va',
  ],
  emotion: [
    'زهقان', 'زهقانه', 'زهقت', 'مليت', 'مخنوق', 'مخنوقه', 'مضايق', 'مضايقه',
    'زعلان', 'زعلانه', 'حزين', 'حزينه', 'متوتر', 'متوتره', 'قلقان', 'قلقانه',
    'مبسوط', 'مبسوطه', 'فرحان', 'فرحانه', 'مش طايق', 'مش مرتاح', 'نفسيتي تعبانه',
    'sad', 'bored', 'anxious', 'stressed', 'happy', 'tired of', 'triste', 'ennuye',
  ],
  topic_change: [
    'غير الموضوع', 'غيري الموضوع', 'سيب الموضوع', 'سيبي الموضوع', 'سيب موضوع',
    'موضوع تاني', 'موضوع اخر', 'موضوع جديد', 'خلاص كفايه', 'كفايه كده', 'بلاش',
    'انسى الموضوع', 'انسي الموضوع', 'مش عايز اتكلم عن', 'مش عايزه اتكلم عن',
    'change the topic', 'change topic', 'another topic', 'something else', 'never mind',
    'change de sujet', 'autre chose', 'laisse tomber',
  ],
  thanks: [
    'شكرا', 'شكرا لك', 'شكرا جدا', 'متشكر', 'متشكره', 'تسلم', 'تسلمي',
    'ربنا يخليك', 'ميرسي', 'thanks', 'thank you', 'thx', 'merci',
  ],
  farewell: [
    'سلام', 'مع السلامه', 'باي', 'وداعا', 'الي اللقاء', 'تصبح علي خير',
    'تصبحي علي خير', 'اشوفك بعدين', 'bye', 'goodbye', 'see you', 'au revoir', 'a plus',
  ],
  identity: [
    'انت مين', 'انتي مين', 'مين انت', 'مين حضرتك', 'اسمك ايه', 'اسمك ايه',
    'انت ايه', 'انتي ايه', 'انت مين اصلا', 'بتعمل ايه', 'وظيفتك ايه',
    'who are you', 'what are you', "what's your name", 'qui es tu', 'tu es qui',
  ],
  help: [
    'ساعدني', 'ساعديني', 'ممكن تساعدني', 'عايز مساعده', 'محتاج مساعده',
    'تقدر تعمل ايه', 'بتعرف تعمل ايه', 'بتعرفي تعمل ايه', 'ايه اللي بتعمله',
    'ايه اللي تعرفه', 'ايه قدراتك', 'help', 'what can you do', "what can you do",
    'aide moi', 'que peux tu faire',
  ],
  chat_request: [
    'خلينا نتكلم', 'خلينا نتكلم في اي حاجه', 'خلينا نتكلم في أي حاجة', 'نتكلم في اي حاجه', 'نتكلم في أي حاجة',
    'عايز اتكلم', 'عاوز اتكلم', 'عايزه اتكلم', 'اتكلم معايا', 'اتكلم معي', 'تعالى نتكلم', 'تعال نتكلم',
    'احكيلي حاجه', 'احكي لي حاجه', 'احكيلي حاجة', 'احكيلي', 'قولي حاجه', 'قولي حاجة', 'قولي حكمه', 'قولي حكمة',
    'هات حكمه', 'هات حكمة', 'قولي نكته', 'قولي نكتة', 'هات نكته', 'هات نكتة', 'قولي معلومه', 'قولي معلومة',
    'tell me something', 'let us talk', "let's talk", 'talk to me', 'say something',
    'raconte moi', 'parlons', 'dis moi quelque chose',
  ],
  knowledge_question: [
    'الفرق بين', 'ايه الفرق', 'إيه الفرق', 'يعني ايه', 'يعني إيه', 'اشرحلي', 'اشرح لي', 'اشرحلي ازاي',
    'عرفني', 'ايه هو', 'إيه هو', 'ايه هي', 'إيه هي', 'ممكن تشرح', 'عايز افهم', 'عاوز افهم', 'افهمني',
    'what is the difference', 'what is', 'explain', 'tell me about',
    'quelle est la difference', 'explique', 'c est quoi',
  ],
};

// ---------------------------------------------------------------------------
// أدوات مطابقة
// ---------------------------------------------------------------------------
function matches(text: string, phrases: string[]): boolean {
  return phrases.some((p) => {
    const np = normalize(p);
    return np && text.includes(np);
  });
}

/**
 * يصنّف الجملة إلى نوع محادثة عامة، أو null إن لم تكن محادثة عامة.
 * الترتيب مهم: نفحص التحيّة قبل الوداع (حتى لا يسرق "سلام" كلمة "السلام عليكم")،
 * ونفحص تغيير الموضوع قبل المشاعر.
 */
export function classifyGeneralChat(rawText: string): GeneralChatKind | null {
  const text = normalize(rawText);
  if (!text) return null;

  // تحيّة موسّعة (تغطّي صيغًا جديدة لم تُضَف للمعجم مثل «صباح الفل يا نجم»، «مساء الفل»):
  // جملة تبدأ بـ«صباح/مساء» أو تحمل «إزيك/ازيك» تُعدّ تحيّة، بشرط ألّا تحمل كلمة شكوى
  // (حتى لا تسرق جملة طبية مثل «مساء الخير عندي وجع في ضهري»).
  const painHint = ['وجع', 'بيوجعني', 'بتوجعني', 'يوجعني', 'وجعني', 'بتالم', 'بيالم', 'ألم'].map(normalize).some((w) => w && text.includes(w));
  const looseGreeting =
    (text.startsWith('صباح') || text.startsWith('مساء') ||
      ['ازيك', 'إزيك', 'ازيكم', 'إزيكم'].some((w) => text.includes(normalize(w)))) &&
    !painHint;
  if (looseGreeting) return 'greeting';

  // تحيّة صريحة أولًا
  if (matches(text, PHRASES.greeting)) return 'greeting';
  // تغيير الموضوع (مهم أن يسبق المشاعر لأن "مش عايز اتكلم" قد تحتوي مشاعر)
  if (matches(text, PHRASES.topic_change)) return 'topic_change';
  // السؤال عن الحال
  if (matches(text, PHRASES.howareyou)) return 'howareyou';
  // الهوية والقدرات
  if (matches(text, PHRASES.identity)) return 'identity';
  if (matches(text, PHRASES.help)) return 'help';
  // المشاعر
  if (matches(text, PHRASES.emotion)) return 'emotion';
  // الشكر
  if (matches(text, PHRASES.thanks)) return 'thanks';
  // الوداع (بعد التحيّة حتى لا يتعارض "سلام")
  if (matches(text, PHRASES.farewell)) return 'farewell';

  // طلب محادثة عامة («خلينا نتكلم»، «احكيلي حاجة»). لا يسرق جملًا تحمل شكوى ألم.
  if (!painHint && matches(text, PHRASES.chat_request)) return 'chat_request';
  // سؤال معرفة عامة غير طبي («إيه الفرق بين...؟») — نردّ بصراحة أنه خارج نطاق المساعد القائم على القواعد.
  if (!painHint && matches(text, PHRASES.knowledge_question)) return 'knowledge_question';

  return null;
}

// ---------------------------------------------------------------------------
// توليد الردّ الطبيعي (لهجة مصرية طبيعية، بدائل متنوّعة حسب الجملة)
// ---------------------------------------------------------------------------
const RESPONSES: Record<GeneralChatKind, LocalizedText[]> = {
  greeting: [
    L('أهلاً بيك! أنا معاك، تحب نتكلم عن إيه؟',
      'Hi there! I’m here — what would you like to talk about?',
      'Salut ! Je suis là — de quoi veux-tu parler ?'),
    L('مساء الخير! إزاي أقدر أساعدك؟',
      'Good evening! How can I help?',
      'Bonsoir ! Comment puis-je aider ?'),
    L('أهلاً! إنت تمام؟ قولّي محتاج إيه.',
      'Hello! Hope you’re okay. What do you need?',
      'Bonjour ! J’espère que ça va. De quoi as-tu besoin ?'),
  ],
  howareyou: [
    L('أنا تمام الحمد لله، شكرًا لسؤالك. إنت عامل إيه؟',
      'I’m doing well, thanks for asking. How are you?',
      'Je vais bien, merci. Et toi ?'),
    L('كل حاجة تمام هنا. إنت أخبارك إيه؟',
      'All good here. How are things with you?',
      'Tout va bien ici. Et toi, quoi de neuf ?'),
  ],
  emotion: [
    L('حاسس بيك. لو حابب تحكيلي إيه اللي مضايقك، أنا سامعك.',
      'I hear you. If you want to talk about what’s bothering you, I’m listening.',
      'Je te comprends. Si tu veux en parler, je t’écoute.'),
    L('متقلقش، خد نفسك. تحب نتكلم شوية؟',
      'Take it easy — take a breath. Want to talk a bit?',
      'Doucement, respire. On en parle un peu ?'),
    L('تمام، أنا معاك. قولّي إيه اللي في دماغك.',
      'I’m here with you. Tell me what’s on your mind.',
      'Je suis là. Dis-moi ce que tu as en tête.'),
  ],
  topic_change: [
    L('تمام، سيبنا الموضوع ده. تحب نتكلم عن إيه تاني؟',
      'Okay, we’ll drop that. What would you like to talk about instead?',
      'D’accord, on laisse ça. De quoi veux-tu parler ?'),
    L('ماشي، غيّرنا الموضوع. قولّي عايز إيه.',
      'Alright, changing the topic. Tell me what you’d like.',
      'Très bien, on change de sujet. Dis-moi.'),
  ],
  thanks: [
    L('العفو، دايمًا في خدمتك. تحب حاجة تانية؟',
      'You’re welcome — happy to help. Anything else?',
      'Avec plaisir — je suis là si besoin. Autre chose ?'),
    L('تسلم! لو محتاج أي حاجة أنا موجود.',
      'Anytime! I’m here if you need anything.',
      'Quand tu veux ! Je suis là si besoin.'),
  ],
  farewell: [
    L('سلامتك، لو احتجتني أنا هنا. مع السلامة!',
      'Take care — I’m here whenever you need me. Bye!',
      'Prends soin de toi — je suis là si besoin. Au revoir !'),
    L('في رعاية الله. سلام!',
      'Take care. Bye!',
      'À bientôt. Salut !'),
  ],
  identity: [
    L('أنا المساعد بتاع Body Pain Map — بساعدك تفهم جسمك وتلاقي مكان الألم، وكمان أتحكم في التطبيق بالكلام.',
      'I’m the Body Pain Map assistant — I help you understand your body and locate pain, and I can control the app by voice.',
      'Je suis l’assistant de Body Pain Map — je t’aide à comprendre ton corps et à localiser la douleur, et je peux contrôler l’app.'),
  ],
  help: [
    L('أقدر أساعدك في ٣ حاجات: نتكلم بشكل عام، أسألك عن الألم وأفهمه، أو أتحكم في التطبيق (تنقّل، إبراز، تسجيل ألم). قولّي تحب نبدأ بإيه.',
      'I can help with three things: general chat, understanding your pain, or controlling the app (navigate, highlight, log pain). Where shall we start?',
      'Je peux t’aider sur trois plans : discuter, comprendre ta douleur, ou contrôler l’app (naviguer, surligner, enregistrer). On commence par quoi ?'),
  ],
  chat_request: [
    L('تحت أمرك. بس خليني أكون صريح معاك: أنا مساعد قائم على قواعد (Rule-Based) ومش نموذج لغوي كبير، فمش هقدر أحكي قصة طويلة من عندي. أقدر أسمعك وأتكلم معاك في الألم والجسم أو أتحكم في التطبيق. تحب نبدأ بإيه؟',
      'At your service. But let me be honest: I’m a rule-based assistant, not a large language model, so I can’t improvise long stories. I can chat about pain and the body, or control the app. Where shall we start?',
      'À ton service. Mais soyons clairs : je suis un assistant à base de règles, pas un grand modèle de langage, donc je ne peux pas inventer de longues histoires. On peut parler douleur et corps, ou contrôler l’app. On commence par quoi ?'),
    L('أنا معاك. خد بالك إني مساعد بسيط قائم على قواعد، فمش عندي معرفة عامة واسعة زي الـLLM. بس أقدر أساعدك تفهم جسمك أو أتحكم في التطبيق. تحب نتكلم في إيه؟',
      'I’m here. Note that I’m a simple rule-based assistant, not a general LLM, so I don’t have broad general knowledge. But I can help you understand your body or control the app. What shall we talk about?',
      'Je suis là. Note que je suis un assistant simple à base de règles, pas un LLM général, donc je n’ai pas de connaissances générales étendues. Mais je peux t’aider à comprendre ton corps ou contrôler l’app. On parle de quoi ?'),
  ],
  knowledge_question: [
    L('ده سؤال معرفة عامة، وأنا حاليًا مساعد Rule-Based متخصّص في الألم والجسم — مش عندي نموذج لغوي كبير (LLM) أجاوب بيه على أسئلة المعرفة العامة زي دي. لو عايز إجابة دقيقة على أسئلة عامة، لازم يتوصل بموديل LLM/API. لكن أقدر أساعدك في وصف الألم أو التحكّم في التطبيق.',
      'That’s a general-knowledge question. I’m a rule-based assistant focused on pain and the body — I don’t have a large language model (LLM) to answer general knowledge like this. For accurate general answers, an LLM/API would need to be connected. Meanwhile, I can help with pain description or app control.',
      'C’est une question de culture générale. Je suis un assistant à base de règles centré sur la douleur et le corps — je n’ai pas de grand modèle de langage (LLM) pour y répondre. Pour des réponses générales précises, il faudrait connecter un LLM/API. En attendant, je peux aider sur la douleur ou le contrôle de l’app.'),
  ],
};

/** اختيار بديل ثابت (deterministic) حسب الجملة، لتنويع الردود بلا عشوائية. */
function pick(list: LocalizedText[], seed: string): LocalizedText {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return list[h % list.length];
}

/** يبني ردًّا طبيعيًا للغة المطلوبة من نوع المحادثة العامة. */
export function generalChatReply(kind: GeneralChatKind, rawText: string): LocalizedText {
  return pick(RESPONSES[kind], rawText);
}

export function generalChatReplyLang(kind: GeneralChatKind, rawText: string, _lang: Lang): string {
  const reply = pick(RESPONSES[kind], rawText);
  return reply[_lang] ?? reply.ar;
}
