import { Banknote, PackageCheck, PhoneCall } from "lucide-react";

/** The shop's three promises, shown on the home page and in the side rails. */
export const promises = [
  {
    icon: Banknote,
    title: "Toʻlov yetkazib berilganda",
    text: "Onlayn toʻlov shart emas. Buyurtma yetib kelganda yoki biz bilan kelishilgan tartibda toʻlaysiz.",
  },
  {
    icon: PhoneCall,
    title: "Telefon orqali tasdiqlanadi",
    text: "Har bir buyurtmani joʻnatishdan oldin qoʻngʻiroq qilib yoki yozib tasdiqlaymiz.",
  },
  {
    icon: PackageCheck,
    title: "Ehtiyotkorlik bilan qadoqlanadi",
    text: "Har bir buyurtma joʻnatishdan oldin tekshiriladi va qoʻlda qadoqlanadi.",
  },
];
