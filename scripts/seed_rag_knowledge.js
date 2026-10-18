"use strict";

const path = require("path");
const DocumentRAGEngine = require("../src/rag");

/**
 * =======================================================================
 *  SEED RAG KNOWLEDGE BASE (ENSIKLOPEDIK VA FAKTIK BILIMLARNI YUKLASH)
 * =======================================================================
 *  RAG tizimini boyitish uchun fundamental fanlar, geografiya, tabiat,
 *  hayvonot olami, kundalik tushunchalar va texnologiyalarga oid bilimlarni
 *  'data/documents.json' ga vektorlashtirib indekslaydi.
 * =======================================================================
 */

const docPath = path.join(__dirname, "..", "data", "documents.json");
const rag = new DocumentRAGEngine(null, docPath);

const knowledgeDocs = [
  {
    title: "Astronomiya va Sayyoralar",
    category: "ilm-fan",
    content: "Oy — Yer sayyorasining yagona tabiiy yo'ldoshi hisoblanadi. Quyosh — Quyosh tizimining markazida joylashgan yagona yulduz bo'lib, butun tizimga yorug'lik va issiqlik tarqatadi. Yer Quyosh atrofida 365 kunda bir marta to'liq aylanadi. Mars — Quyosh tizimidagi to'rtinchi sayyora bo'lib, qizil sayyora deb ham ataladi."
  },
  {
    title: "Fizika va Fundamental Qonunlar",
    category: "fizika",
    content: "Suv normal atmosfera bosimida (101.3 kPa) 100°C haroratda qaynaydi va 0°C haroratda muzlaydi. Yorug'lik tezligi vakuumda taxminan 300 000 km/s ga teng bo'lib, olamdagi eng yuqori fundamental tezlik hisoblanadi. Tovush tezligi esa havoda taxminan 340 m/s tezlikda tarqaladi. Yerning tortishish kuchi erkin tushish tezlanishi g = 9.8 m/s² bilan belgilanadi."
  },
  {
    title: "Hayvonot Olami va Yirtqichlar",
    category: "biologiya",
    content: "Sher — mushuksimonlar oilasiga mansub yirik yirtqich hayvon bo'lib, o'zining kuchi, chaqqonligi va ulug'vor qiyofasi tufayli 'hayvonlar podshosi' deb nom olgan. Ular guruh-guruh (prayd) bo'lib yashaydi. Bo'ri — itlar oilasiga kiruvchi jamoaviy yirtqich bo'lib, tulkidan ancha yirik va kuchliroq. Tulki esa ayyorligi va moslashuvchanligi bilan mashhur bo'lgan kichikroq yirtqichdir."
  },
  {
    title: "O'quv Qurollari va Ma'naviyat",
    category: "jamiyat",
    content: "Kitob — insoniyat tafakkuri, bilimlari va tajribasini avloddan-avlodga yetkazuvchi ma'naviy-ma'rifiy xazina hisoblanadi. Daftar — fan, o'qish, mashq qilish yoki amaliy hayotda ma'lumotlarni qayd etish uchun maxsus tayyorlangan, varaqlari chiziqli yoki katakli qog'ozlar majmuasidir. Qalam va ruchka yozuv quroli bo'lib, fikrlarni qog'ozga muhrlashda xizmat qiladi."
  },
  {
    title: "Inson Salomatligi va Charchoq",
    category: "salomatlik",
    content: "Charchoq — inson uzoq davom etgan aqliy yoki jismoniy faoliyat natijasida tanadagi energiya zaxiralarining kamayishi holatidir. Charchoqni bartaraf etish uchun to'yib uxlash (kuniga 7-8 soat), toza suv ichish, toza havoda sayr qilish va qisqa muddat dam olish zarur. Inson tanasining 60 foizdan ortig'i suvdan iborat bo'lgani sababli kun davomida yetarli suv ichish sog'liq uchun nihoyatda muhimdir."
  },
  {
    title: "Geografiya va Dunyo Poytaxtlari",
    category: "geografiya",
    content: "O'zbekiston Respublikasining rasmiy poytaxti — Toshkent shahri. Fransiya poytaxti — Parij shahri. Germaniya poytaxti — Berlin. Yaponiya poytaxti — Tokio. Buyuk Britaniya poytaxti — London. Rossiya poytaxti — Moskva. AQSH poytaxti — Vashington shahridir. O'zbekiston hududidan Amudaryo va Sirdaryo kabi yirik daryolar oqib o'tadi."
  },
  {
    title: "Sun'iy Intellekt va LLM Modellari",
    category: "texnologiya",
    content: "Gemini — Google tomonidan yaratilgan eng ilg'or multimodal sun'iy intellekt modellari oilasi hisoblanadi. Katta til modellari (LLM) — millionlab va milliardlab parametrlar yordamida inson tilidagi matnlarni tahlil qilish, savollarga mantiqiy javob berish va dasturiy kod yozish qobiliyatiga ega neyron tarmoqlaridir."
  },
  {
    title: "Matematika va Arifmetika Qoidalari",
    category: "matematika",
    content: "Arifmetik amallarni bajarish tartibi: avval qavs ichidagi amallar, so'ngra ko'paytirish va bo'lish, eng oxirida qo'shish va ayirish amallari chapdan o'ngga qarab bajariladi. Foiz — sonning yuzdan bir ulushidir. Masalan, 500 ning 20 foizi 100 ga teng bo'ladi."
  },
  {
    title: "Biologiya va Fotosintez",
    category: "biologiya",
    content: "Fotosintez — yashil o'simliklar, suvo'tlar va ayrim bakteriyalar tomonidan quyosh nuri energiyasi, suv va karbonat angidrid (CO₂) gazidan foydalanib organik moddalar (glyukoza) hamda kislorod (O₂) hosil qilish jarayonidir. Fotosintez xloroplastlarda joylashgan xlorofill pigmenti yordamida amalga oshadi va Yerdagi barcha tirik mavjudotlarni hayotiy kislorod bilan ta'minlaydi."
  },
  {
    title: "Quyosh Tizimi va Sayyoralar",
    category: "astronomiya",
    content: "Quyosh tizimida 8 ta asosiy sayyora mavjud: Merkuriy, Venera, Yer, Mars, Yupiter, Saturn, Uran va Neptun. Yupiter — Quyosh tizimidagi eng yirik gaz giganti hisoblanadi. Mars — temir oksidi ko'pligi sababli 'qizil sayyora' deb ataladi. Quyosh — tizim markazidagi yagona yulduz bo'lib, uning atrofida barcha sayyoralar o'z orbitalari bo'ylab aylanadi."
  },
  {
    title: "Ona Tili va Tilshunoslik",
    category: "tilshunoslik",
    content: "O'zbek tili — turkiy tillar oilasining qarluq guruhiga mansub bo'lib, O'zbekiston Respublikasining davlat tilidir. O'zbek adabiy tilining asoschisi buyuk shoir va mutafakkir Alisher Navoiydir. 1989-yil 21-oktyabrda o'zbek tiliga davlat tili maqomi berilgan."
  },
  {
    title: "Axborot Texnologiyalari va Dasturlash",
    category: "axborot_texnologiyalari",
    content: "Dasturlash tili — kompyuterga aniq buyruqlar va algoritmlarni berish uchun ishlatiladigan sun'iy belgilar tizimidir. Hozirgi kunda JavaScript, Python, C++, Java va Rust kabi dasturlash tillari veb-saytlar, mobil ilovalar va sun'iy intellekt tizimlarini yaratishda keng qo'llaniladi."
  }
];

console.log("=========================================================================");
console.log("  📚 RAG HUJJATLAR BAZASINI BOYITISH (SEEDING)");
console.log("=========================================================================\n");

// Hozirgi mavjud hujjatlar sarlavhalari
const existingTitles = new Set((rag.documents || []).map((d) => d.title.toLowerCase()));

let addedCount = 0;
for (const doc of knowledgeDocs) {
  if (!existingTitles.has(doc.title.toLowerCase())) {
    const res = rag.addDocument(doc.title, doc.content, doc.category);
    console.log(`✔ Yangi hujjat qo'shildi: «${res.title}» (${res.chunksCount} ta semantik bo'lak)`);
    addedCount++;
  } else {
    console.log(`ℹ Mavjud hujjat o'tkazib yuborildi: «${doc.title}»`);
  }
}

console.log(`\n✅ Yakunlandi! Jami qo'shilgan hujjatlar: ${addedCount} ta.`);
console.log(`📊 Jami hujjatlar: ${rag.documents.length} ta, Bo'laklar (Chunks): ${rag.chunks.length} ta.`);
