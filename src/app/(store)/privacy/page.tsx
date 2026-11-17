import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Maxfiylik",
  description: `${siteConfig.name} buyurtma berishda siz ulashgan maʼlumotlardan qanday foydalanishi haqida.`,
  alternates: { canonical: "/privacy" },
};

/*
 * PLACEHOLDER TEXT — replace with your own privacy notice.
 * It describes what this website actually does out of the box, but it is not
 * legal advice. Check the rules that apply where you trade.
 */
const sections = [
  {
    title: "Qanday maʼlumotlarni yigʻamiz",
    body: [
      "Buyurtma berganingizda ismingiz, telefon raqamingiz, yetkazib berish manzilingiz va oʻzingiz yozgan izohni soʻraymiz. Telegram foydalanuvchi nomi ixtiyoriy boʻlib, buyurtma boʻyicha siz bilan bogʻlanish uchun ishlatiladi.",
      "Saytda hisob ochish yoki tizimga kirish talab qilinmaydi.",
    ],
  },
  {
    title: "Ulardan qanday foydalanamiz",
    body: [
      "Maʼlumotlaringizdan buyurtmani tasdiqlash, tayyorlash va yetkazib berish hamda u boʻyicha siz bilan bogʻlanish uchun foydalanamiz. Maʼlumotlaringizni sotmaymiz va reklama uchun ishlatmaymiz.",
    ],
  },
  {
    title: "Toʻlovlar",
    body: [
      "Bu saytda toʻlov qabul qilinmaydi. Buyurtmalar yetkazib berilganda yoki doʻkon bilan kelishilgan tartibda toʻlanadi, shuning uchun biz karta maʼlumotlarini koʻrmaymiz va saqlamaymiz.",
    ],
  },
  {
    title: "Cookie fayllar va saqlash",
    body: [
      "Savatingiz oʻz brauzeringizda saqlanadi. Reklama yoki kuzatuv cookie fayllaridan foydalanmaymiz.",
    ],
  },
  {
    title: "Xizmat koʻrsatuvchilar",
    body: [
      "Sayt Vercel serverlarida joylashgan. Buyurtmalar Google Firebase xizmatida saqlanadi, xatlar esa email yuborish xizmati orqali joʻnatiladi. Bu xizmatlar maʼlumotlarni faqat doʻkon ishlashi uchun qayta ishlaydi.",
    ],
  },
  {
    title: "Sizning huquqlaringiz",
    body: ["Istalgan vaqtda maʼlumotlaringizni tuzatish yoki oʻchirishni soʻrashingiz mumkin. Biz bilan bogʻlaning — yordam beramiz."],
  },
];

export default function PrivacyPage() {
  return (
    <div className="container-page max-w-3xl py-8 sm:py-12">
      <h1 className="text-3xl font-semibold sm:text-4xl">Maxfiylik</h1>
      <p className="mt-3 leading-relaxed text-muted">
        Bu sahifada {siteConfig.name} buyurtma berishda siz ulashgan maʼlumotlar bilan nima qilishi tushuntiriladi.
      </p>
      <div className="mt-8 space-y-8">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-xl font-semibold">{section.title}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="mt-2 leading-relaxed text-ink/90">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
      <p className="mt-10 text-sm text-muted">
        Savollaringiz bormi? Qarang:{" "}
        <Link href="/contact" className="font-medium text-brand-700 underline-offset-4 hover:underline">
          aloqa sahifasi
        </Link>
        .
      </p>
    </div>
  );
}
