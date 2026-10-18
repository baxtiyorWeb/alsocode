/**
 * =======================================================================
 *  ILLOGICAL & PARADOX REASONING ENGINE (Mantiqsiz va Paradoksal Savollar)
 * =======================================================================
 *  Insoniy tafakkur darajasidagi mantiqiy nazorat tizimi:
 *  1. Kategoriya xatosi (Category Mistake / Ontological Mismatch):
 *     - Shakllarga/ranglarga vazn, ta'm, harorat berish ("uchburchak necha kilo?");
 *     - Jonsiz buyumlarga biologik ehtiyoj berish ("tosh nima haqida o'ylaydi?", "suv qachon uxlaydi?");
 *     - Absurd fizik/biologik harakatlar ("daraxt avtobusga minadimi?", "baliq cho'kadimi?").
 *  2. Mantiqiy Paradokslar (Logical Paradoxes & Contradictions):
 *     - "Yolg'onchi paradoksi", "Hamma narsani teshuvchi nayza", "Dumaloq kvadrat".
 *  3. Metamantiqiy savollar:
 *     - "Agar mantiqsiz savol bersam nima deysan?", "Mantiqsiz gaplarga qanday qaraysan?".
 *  4. Bemantiq / Ma'nosiz so'zlar uyumi (Incoherent word salads).
 * =======================================================================
 */

class IllogicalEngine {
  constructor() {
    // 1. Jonsiz buyumlar va materiyalar (o'zbekcha kelishik va egalik qo'shimchalari bilan)
    const suf = "(?:ning|ga|ka|qa|da|dan|ni|lar|i|si)?";
    this.inanimateEntities = [
      { pattern: new RegExp(`\\b(?:tosh|qoya|qum|tuproq|loy)${suf}\\b`, "i"), label: "tosh / jism", nature: "jonsiz mineral jism" },
      { pattern: new RegExp(`\\b(?:suv|daryo|dengiz|okean|yomg'ir|muz|qor)${suf}\\b`, "i"), label: "suv / suyuqlik", nature: "fizik modda" },
      { pattern: new RegExp(`\\b(?:quyosh|oy|yulduz|sayyora|osmon|bulut)${suf}\\b`, "i"), label: "astronomik jism", nature: "koinotdagi osmon jismi" },
      { pattern: new RegExp(`\\b(?:uchburchak|doira|kvadrat|romb|chiziq|shakl)${suf}\\b`, "i"), label: "geometrik shakl", nature: "mavhum matematik tushuncha" },
      { pattern: new RegExp(`\\b(?:rang|qizil|ko'k|yashil|oq|qora|sariq)${suf}\\b`, "i"), label: "rang", nature: "optik yorug'lik to'lqini" },
      { pattern: new RegExp(`\\b(?:ruchka|qalam|daftar|kitob|stol|stul|parta|eshik|deraza|devor)${suf}\\b`, "i"), label: "buyum / jihoz", nature: "yasama jonsiz buyum" },
      { pattern: new RegExp(`\\b(?:telefon|kompyuter|noutbuk|televizor|muzlatgich|soat)${suf}\\b`, "i"), label: "elektronika", nature: "elektron asbob" },
      { pattern: new RegExp(`\\b(?:mashina|avtomobil|avtobus|samolyot|poyezd|velosiped)${suf}\\b`, "i"), label: "transport", nature: "mexanik transport vositasi" },
      { pattern: new RegExp(`\\b(?:daraxt|gul|o't|maysa|barg|yog'och)${suf}\\b`, "i"), label: "o'simlik", nature: "harakatsiz o'simlik olami" },
      { pattern: new RegExp(`\\b(?:havo|shamol|olov|tutun|gaz)${suf}\\b`, "i"), label: "tabiiy element", nature: "gaz yoki tabiiy hodisa" },
      { pattern: new RegExp(`\\b(?:vaqt|soat|soniya|asr|daqiqa)${suf}\\b`, "i"), label: "vaqt", nature: "mavhum o'lchov birligi" },
    ];

    // 2. Mos kelmaydigan biologik / jismoniy xususiyatlar (Kategoriya xatosi yaratuvchi predikatlar)
    this.mismatchedPredicates = [
      {
        pattern: /\b(?:necha\s+kilo|necha\s+kg|vazni\s+qancha|og'irligi\s+qancha|necha\s+gramm|tarozida\s+tortsa|tosh\s+bosa|tosh\s+bosadi|tosh\s+bosmoqda)\b/i,
        trait: "vazn / og'irlik",
        incompatibleWith: ["geometrik shakl", "rang", "vaqt"],
        explanation: "mavhum matematik yoki optik tushuncha bo'lib, uning massasi yoki og'irligi mavjud emas"
      },
      {
        pattern: /\b(?:shirinmi|nordonmi|sho'rmi|achchiqmi|ta'mi\s+qanaqa|ta'mi\s+qanday|mazasi\s+qanday)\b/i,
        trait: "ta'm / maza",
        incompatibleWith: ["geometrik shakl", "rang", "buyum / jihoz", "astronomik jism", "vaqt"],
        explanation: "ta'm sezgisiga ega emas, chunki u oziq-ovqat yoki moddiy ta'm uyg'otuvchi kimyoviy birikma emas"
      },
      {
        pattern: /\b(?:qayerda\s+uxlaydi|qachon\s+uxlaydi|uxlaydimi|yotib\s+uxlaydimi|tush\s+ko'radimi|uyquga\s+ketadimi)\b/i,
        trait: "uyqu / tush ko'rish",
        incompatibleWith: ["tosh / jism", "suv / suyuqlik", "astronomik jism", "geometrik shakl", "buyum / jihoz", "transport", "tabiiy element"],
        explanation: "jonsiz materiya bo'lgani uchun unda biologik miya, asab tizimi yoki uyqu fazalari bo'lmaydi"
      },
      {
        pattern: /\b(?:nima\s+haqida\s+o'ylaydi|fikrlaydimi|aqli\s+bormi|xafa\s+bo'ladimi|yig'laydimi|kuladimi|sevadimi)\b/i,
        trait: "tafakkur / his-tuyg'u",
        incompatibleWith: ["tosh / jism", "suv / suyuqlik", "buyum / jihoz", "transport", "o'simlik", "tabiiy element", "geometrik shakl"],
        explanation: "ong, hissiyot va fikrlash faqat oliy asab tizimiga ega ongli mavjudotlarga xosdir"
      },
      {
        pattern: /\b(?:ovqat\s+yeydimi|nima\s+yeydi|qachon\s+ovqatlanadi|qorni\s+ochadimi|chanqaydimi|suv\s+ichadimi|suv\s+ichganda|suv\s+ichsa|yeb\s+qo'ydi|yeb\s+yubordi|yedi)\b/i,
        trait: "ovqatlanish / yeb qo'yish / chanqash",
        incompatibleWith: ["tosh / jism", "suv / suyuqlik", "astronomik jism", "geometrik shakl", "buyum / jihoz", "transport", "tabiiy element", "elektronika"],
        explanation: "jonsiz buyum yoki texnika bo'lib, organik hazm qilish tizimi yoki biologik metabolizmga ega emas"
      },
      {
        pattern: /\b(?:yugurib\s+ketdi|yugurdi|yuguradimi|qochib\s+ketdi|sakradi|sakraydimi)\b/i,
        trait: "mustaqil yugurish / sakrash",
        incompatibleWith: ["tosh / jism", "geometrik shakl", "buyum / jihoz", "astronomik jism", "o'simlik", "tabiiy element", "elektronika"],
        explanation: "jonsiz buyum bo'lib, oyoqlari yoki mustaqil biologik harakatlanish mushaklari mavjud emas"
      },
      {
        pattern: /\b(?:suv\s+ichganda|suv\s+tushganda|suvga\s+tushsa|suv\s+tushsa|ichiga\s+suv\s+kirsa)\b/i,
        trait: "elektronika va suv o'zaro ta'siri",
        incompatibleWith: ["elektronika"],
        explanation: "elektron qurilma bo'lib, suv ichmaydi; agar uning mikrosxemalariga suv kirsa, qisqa tutashuv (short-circuit) yuz berib, qurilma ishdan chiqadi yoki yonadi"
      },
      {
        pattern: /\b(?:muzlab\s+qol|muzlasa|muzlab\s+qolganda|muzlab\s+qolishi)\b/i,
        trait: "osmon jismining muzlashi",
        incompatibleWith: ["astronomik jism"],
        explanation: "ulkan qizigan termoyadroviy plazma shari (sirt harorati ~5500°C, markazida ~15 mln°C) bo'lib, uning muzlab qolishi termodinamika va astrofizika qonunlariga ko'ra mutlaqo imkonsizdir"
      },
      {
        pattern: /\b(?:avtobusga\s+minadimi|taksiga\s+o'tiradimi|metroga\s+tushadimi|yo'l\s+haqi\s+to'laydimi)\b/i,
        trait: "jamoat transportidan foydalanish",
        incompatibleWith: ["daraxt / o'simlik", "tosh / jism", "suv / suyuqlik", "astronomik jism", "buyum / jihoz"],
        explanation: "o'z joyidan mustaqil ko'cha olmaydigan jism yoki o'simlik bo'lib, ijtimoiy transportga ehtiyoji yo'q"
      },
      {
        pattern: /\b(?:cho'kib\s+ketadimi|suvda\s+cho'kadimi)\b/i,
        trait: "suvda cho'kish",
        incompatibleWith: ["baliq"],
        explanation: "baliqlar jabra orqali suvda nafas oluvchi va suzgich pufagi yordamida chuqurlikni boshqaruvchi gidrodinamik jonivorlardir"
      },
      {
        pattern: /\b(?:terlaydimi|sovqotadimi|issiq\s+kiyinadimi)\b/i,
        trait: "terlash / sovqotish",
        incompatibleWith: ["qor", "muz", "tosh / jism", "buyum / jihoz"],
        explanation: "ter bezlari va termoregulyatsiya tizimiga ega emas"
      },
      {
        pattern: /\b(?:qanday\s+rang|qanaqa\s+rang|rangi\s+qanday|rangi\s+qanaqa|rangi\s+nima|qaysi\s+rangda|rangi\s+bormi)\b/i,
        trait: "rang / ko'rinish",
        incompatibleWith: ["geometrik shakl", "vaqt", "tabiiy element"],
        explanation: "mavhum matematik tushuncha yoki rangsiz tabiiy hodisa bo'lib, uning o'ziga xos tabiiy rangi bo'lmaydi (uni qog'ozga ixtiyoriy rangda chizish mumkin, lekin mohiyatan rangsizdir)"
      },
      {
        pattern: /\b(?:hidi\s+qanday|qanday\s+hid|hidi\s+bormi|hidi\s+qanaqa|sasidimi|muattarmi)\b/i,
        trait: "hid / hidlanish",
        incompatibleWith: ["geometrik shakl", "rang", "vaqt", "tabiiy element", "astronomik jism"],
        explanation: "mavhum tushuncha yoki tabiiy element bo'lib, o'ziga xos biologik/organik hidga ega emas"
      },
      {
        pattern: /\b(?:ovoz\s+chiqaradimi|tovushi\s+qanday|qanday\s+ovoz|sayraydimi|qichqiradimi)\b/i,
        trait: "ovoz / tovush chiqarish",
        incompatibleWith: ["geometrik shakl", "rang", "vaqt", "tosh / jism", "suv / suyuqlik", "astronomik jism"],
        explanation: "tovush chiqarish a'zolari yoki akustik mexanizmga ega emas"
      },
      {
        pattern: /\b(?:necha\s+yoshda|yoshi\s+nechida|qachon\s+tug'ilgan|tug'ilgan\s+kuni)\b/i,
        trait: "biologik yosh / tug'ilish",
        incompatibleWith: ["geometrik shakl", "rang", "tosh / jism", "suv / suyuqlik", "buyum / jihoz", "tabiiy element"],
        explanation: "biologik tug'ilish yoki tiriklik yoshiga ega emas"
      }
    ];

    // 3. Mantiqiy Paradokslar
    this.paradoxPatterns = [
      {
        pattern: /\b(?:yolg'onchi\s+paradoksi|aytganim\s+yolg'on|hamma\s+gapim\s+yolg'on|men\s+hozir\s+aldamoqdaman)\b/i,
        type: "liar_paradox",
        title: "Yolg'onchi Paradoksi (Epimenid paradoksi)",
        explanation: "Agar bu gap rost bo'lsa, demak u yolg'on; agar yolg'on bo'lsa, demak u rost! Bu o'z-o'ziga murojaat qiluvchi (self-referential) yechimsiz mantiqiy aylanadir."
      },
      {
        pattern: /\b(?:dumaloq\s+kvadrat|dumaloq\s+uchburchak|to'rtburchak\s+aylana)\b/i,
        type: "geometric_contradiction",
        title: "Geometrik Mutlaq Ziddiyat",
        explanation: "Aylana (burchaksiz egri chiziq) va kvadrat (to'rtta to'g'ri burchak) ta'riflari bir-birini mantiqan inkor etadi. Biri mavjud bo'lgan joyda ikkinchisi bo'lishi imkonsiz."
      },
      {
        pattern: /\b(?:hamma\s+narsani\s+(?:tesh|sindir)|teshilmas\s+qalqon|har\s+qanday\s+qalqonni)\b/i,
        type: "omnipotence_paradox",
        title: "Mutlaq Kuch va Qarshilik Paradoksi (Xitoy nayza va qalqon masali)",
        explanation: "Agar 'har qanday narsani tesha oladigan nayza' mavjud bo'lsa, 'hech narsa tesha olmaydigan qalqon' bo'lishi mantiqan mumkin emas. Ikkisi bir vaqtda mavjud bo'la olmaydi."
      },
      {
        pattern: /\b(?:o'zidan\s+og'ir\s+tosh|o'zi\s+ko'tara\s+olmaydigan\s+tosh)\b/i,
        type: "omnipotence_stone",
        title: "Qudrat Paradoksi",
        explanation: "Bu savol til va mantiq chegaralarini sinash uchun tuzilgan semantik tuzoqdir."
      }
    ];
  }

  /**
   * Kiruvchi matn mantiqsiz savol, kategoriya xatosi yoki paradoks ekanini aniqlash
   */
  detectIllogicalQuery(text) {
    const lower = (text || "").toLowerCase().trim();

    // 1. Metamantiqiy savollar ("agar mantiqsiz savol bersam...", "mantiqsiz gap yozsamchi?")
    const isMetaIllogical = /\b(?:mantiqsiz\s+savol|bema['`ʻ‘]?ni\s+savol|mantiqsiz\s+gap|mantiqqa\s+to['`ʻ‘]?g['`ʻ‘]?ri\s+kelmaydigan|absurd\s+savol|ahmoqona\s+savol)\b/i.test(lower);
    if (isMetaIllogical) {
      return {
        type: "meta_illogical",
        confidence: 99,
        reason: "Foydalanuvchi tizimning mantiqsiz savollarga qanday munosabat bildirishini so'radi.",
      };
    }

    // 2. Mantiqiy Paradokslarni tekshirish
    for (const p of this.paradoxPatterns) {
      if (typeof p.pattern === "function" ? p.pattern(lower) : p.pattern.test(lower)) {
        return {
          type: "paradox",
          subType: p.type,
          title: p.title,
          explanation: p.explanation,
          confidence: 98,
          reason: `Mantiqiy paradoks aniqlandi: ${p.title}`
        };
      }
    }

    // 3. Kategoriya Xatosi (Category Mistake / Ontological Mismatch)
    // Masalan: "Uchburchak necha kilo?", "Quyosh qayerda uxlaydi?", "Tosh nima haqida o'ylaydi?"
    const hasToshBosadi = /\btosh\s+bosa/i.test(lower);

    for (const ent of this.inanimateEntities) {
      if (ent.label === "tosh / jism" && hasToshBosadi) {
        // "tosh bosadi" iborasi og'irlikni anglatadi, mineral tosh emas
        continue;
      }
      const match = ent.pattern.exec(lower);
      if (match) {
        const matchedEntity = ent;
        const matchedWord = match[0];

        for (const pred of this.mismatchedPredicates) {
          if (pred.pattern.test(lower)) {
            // Mos kelmaslikni tekshirish
            const isIncompatible = pred.incompatibleWith.some(inc => 
              matchedEntity.label.includes(inc) || matchedEntity.nature.includes(inc)
            );

            if (isIncompatible) {
              return {
                type: "category_mistake",
                word: matchedWord,
                entity: matchedEntity.label,
                nature: matchedEntity.nature,
                trait: pred.trait,
                explanation: pred.explanation,
                confidence: 96,
                reason: `Kategoriya xatosi: "${matchedWord || matchedEntity.label}" (${matchedEntity.nature}) va "${pred.trait}" bir-biriga mos kelmaydi.`
              };
            }
          }
        }
      }
    }

    // 4. To'liq ma'nosiz / so'zlar aralashmasi (Incoherent mash of unrelated words)
    // Masalan: "kitob osmonda yugurib qoshiq bo'ldi"
    const hasAbsurdWordCombo = /\b(?:kitob\s+yugur|qoshiq\s+uch|muz\s+yon|olov\s+muzla|suv\s+yonmoqda)\b/i.test(lower);
    if (hasAbsurdWordCombo) {
      return {
        type: "absurd_combination",
        confidence: 95,
        reason: "Semantik jihatdan bir-biriga zid fizik harakatlar birlashmasi aniqlandi."
      };
    }

    return null;
  }

  /**
   * Mantiqsiz savolga insoniy, samimiy, hazilomuz va aql-idrok bilan javob sintez qilish
   */
  synthesizeIllogicalResponse(detection, userText, register = "formal", userName = null) {
    const isFormal = register === "formal";
    const namePrefix = userName && Math.random() < 0.25 ? `${userName}, ` : "";

    // 1. METAMANTIQIY SAVOL
    if (detection.type === "meta_illogical") {
      if (isFormal) {
        return `${namePrefix}Agar siz menga mantiqsiz yoki paradoksal savol bersangiz, buni darhol payqayman! Mantiqiy tamoyillar asosida qayerda ziddiyat yoki "kategoriya xatosi" borligini muloyimlik bilan ko'rsatib beraman. Qolaversa, bunday noan'anaviy savollar suhbatga o'zgacha qiziqish va tabassum olib kiradi deb hisoblayman. Bemalol sinab ko'rishingiz mumkin! 😄`;
      } else {
        return `${namePrefix}Agar sen mantiqsiz yoki g'alati savol bersang, buni darhol sezaman, do'stim! Mantiq va ilmga tayanib, savolning qayerida ziddiyat yoki paradoks borligini ko'rsatib beraman. Qolaversa, bunday topishmoqlar zehnni charxlash uchun ayni muddao! Xohlasang, hoziroq birorta mantiqsiz savol berib sinab ko'r :)`;
      }
    }

    // 2. PARADOKS
    if (detection.type === "paradox") {
      if (isFormal) {
        return `${namePrefix}Bu ajoyib klassik mantiqiy jumboq — **${detection.title}**!
${detection.explanation}
Bunday savollar inson tafakkurining cheksizligini va tilimizdagi qiziqarli semantik tuzoqlarni ko'rsatib beradi. Zehningizga qoyil!`;
      } else {
        return `${namePrefix}Qoyil, zo'r mantiqiy jumboq tashlading — bu mashhur **${detection.title}**!
${detection.explanation}
Bunaqa savollar bilan odamning miyasini yaxshigina "qizdirish" mumkin, zehn charxlashga zo'r topishmoq!`;
      }
    }

    // 3. KATEGORIYA XATOSI (Category Mistake)
    if (detection.type === "category_mistake") {
      const subjectName = detection.word ? `"${detection.word}"` : `**${detection.entity}**`;
      if (isFormal) {
        return `${namePrefix}Bu juda qiziq va o'yantiruvchi savol! Biroq mantiq va ontologiya nuqtai nazaridan bu yerda **kategoriya xatosi (Category Mistake)** mavjud.

Chunki ${subjectName} — bu ${detection.nature} hisoblanadi va u ${detection.explanation}. Shuning uchun unga ${detection.trait} tushunchasini qo'llab bo'lmaydi. 

Lekin savolni shunday noodatiy va poetik tarzda berganingiz tahsinga loyiq! Mantiqni sinab ko'ryapsizmi? 😉`;
      } else {
        return `${namePrefix}Qiziq savol berding! Lekin mantiq nuqtai nazaridan bu yerda qiziqarli **kategoriya xatosi** bor :)

Chunki ${subjectName} — bu ${detection.nature}, demak u ${detection.explanation}. Shuning uchun unga ${detection.trait} xususiyati to'g'ri kelmaydi.

Lekin bu zo'r topishmoq yoki ertakona savol bo'libdi! Mantiqimni sinab ko'rdingmi? 😉`;
      }
    }

    // 4. ABSURD KOMBINATSIYA
    if (detection.type === "absurd_combination") {
      if (isFormal) {
        return `${namePrefix}Siz keltirgan jumlada fizik voqelikka zid bo'lgan qiziqarli ramziylik (absurdlik) bor. Real hayot va mantiq qoidalariga ko'ra bunday hodisalar bir vaqtda ro'y bermaydi, lekin metafora yoki syurrealistik fantastika sifatida juda qiziq yangraydi!`;
      } else {
        return `${namePrefix}Bu jumlada fizika va mantiqqa to'g'ri kelmaydigan zo'r syurrealistik kontrast bor ekan! Real hayotda bunday bo'lmaydi, lekin fantastik film yoki ertak uchun ajoyib g'oya :)`;
      }
    }

    return isFormal
      ? "Ushbu savol mantiqan g'ayrioddiy va ziddiyatli tuzilgan. Agar jiddiy biror fikr bo'lsa, uni boshqacharoq tushuntirib bera olasizmi?"
      : "Bu savolda qiziq bir mantiqiy ziddiyat borga o'xshaydi, do'stim. Nimanidir nazarda tutganmisan?";
  }
}

module.exports = new IllogicalEngine();
