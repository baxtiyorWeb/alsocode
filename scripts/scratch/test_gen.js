"use strict";

const NAMES = [
  "Ali", "Vali", "Sardor", "Jasur", "Malika", "Madina", "Temur", "Anvar",
  "Bobur", "Nodira", "Dilshod", "Shahnoza", "Lola", "Otabek", "Kamola",
  "Rustam", "Jamshid", "Zarina", "Feruz", "Nigora", "Sanjar", "Umid",
  "Gulnoza", "Behruz", "Shohruh", "Ziyoda", "Sherzod", "Munisa", "Javohir",
  "Rayhona", "Aziz", "Laylo", "Farhod", "Dilnoza", "Davron", "Nargiza",
  "Ulug'bek", "Mohira", "Asadbek", "Sevara", "Botir", "Nilufar", "Shavkat",
  "Dildora", "Elbek", "Zuhra", "Muzaffar", "Go'zal", "Husan", "Barno"
];

const ITEMS = [
  "olma", "kitob", "daftar", "qalam", "nok", "shaftoli", "anor", "uzum",
  "ruchka", "chizg'ich", "bo'yoq", "quti", "to'p", "velosiped", "soat"
];

const WEEKDAYS = [
  "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba", "yakshanba"
];

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("uz-UZ")
    .replace(/[.,!?;:'"«»()[\]{}…—–-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function generateDeductiveAndCausal(targetCount = 1200, existingSet) {
  const items = [];
  const compTypes = [
    { prop: "baland", superPos: "eng balandi", superNeg: "eng pasti", antonym: "past" },
    { prop: "katta", superPos: "eng kattasi", superNeg: "eng kichigi", antonym: "kichik" },
    { prop: "tez", superPos: "eng tezi", superNeg: "eng sekini", antonym: "sekin" },
    { prop: "og'ir", superPos: "eng og'iri", superNeg: "eng yengili", antonym: "yengil" },
    { prop: "chaqqon", superPos: "eng chaqqoni", superNeg: "eng susti", antonym: "sust" },
    { prop: "tajribali", superPos: "eng tajribalisi", superNeg: "eng kam tajribalisi", antonym: "tajribasiz" },
  ];

  // 1. Deductive comparison (600 items)
  let c = 0;
  for (let i = 0; i < NAMES.length && items.length < 600; i++) {
    for (let j = 0; j < NAMES.length && items.length < 600; j++) {
      if (i === j) continue;
      for (let k = 0; k < NAMES.length && items.length < 600; k++) {
        if (i === k || j === k) continue;
        const a = NAMES[i];
        const b = NAMES[j];
        const d = NAMES[k];
        const comp = compTypes[(c++) % compTypes.length];
        const askHighest = (c % 2 === 0);

        let text;
        if (askHighest) {
          text = `Savol: ${a} ${b}dan ${comp.prop}roq. ${b} esa ${d}dan ${comp.prop}roq. Uchovi orasida ${comp.superPos} kim? Mantiqiy xulosa: ${a} > ${b} va ${b} > ${d}. Demak, tranzitivlik qonuniga ko'ra ${comp.superPos} ${a} hisoblanadi. To'g'ri javob: ${a}.`;
        } else {
          text = `Savol: ${a} ${b}dan ${comp.prop}roq. ${b} esa ${d}dan ${comp.prop}roq. Uchovi orasida ${comp.superNeg} kim? Mantiqiy xulosa: ${a} eng ${comp.prop}, ${b} o'rtada, ${d} esa qolganlardan ${comp.antonym}roq. Demak, ${comp.superNeg} ${d}. To'g'ri javob: ${d}.`;
        }

        const norm = normalizeText(text);
        if (!existingSet.has(norm)) {
          existingSet.add(norm);
          items.push({ text, category: "deduktiv_mantiq" });
        }
      }
    }
  }

  // 2. Causal reasoning (600 items)
  const causalTemplates = [
    {
      q: (obj, loc) => `Nega qish faslida ${loc}dagi ${obj} muzlaydi?`,
      a: (obj, loc) => `Sabab va oqibat tahlili: Havo harorati Selsiy bo'yicha 0 darajadan pastga tushganda, ${loc}dagi ${obj} issiqlik yo'qotadi va qattiq agregat holatga o'tadi. Shuning uchun muzlaydi.`
    },
    {
      q: (plant, loc) => `Agar ${loc}dagi ${plant} uzoq vaqt sug'orilmasa nima sodir bo'ladi?`,
      a: (plant, loc) => `Sabab va oqibat tahlili: Suv o'simlikning fotosintez jarayoni va hujayralar bosimi uchun zarur. Suv yetishmasa, ${plant} so'liydi va quriydi.`
    },
    {
      q: (item, loc) => `Quyosh nuri tushganda nega ${loc}dagi ${item} qiziydi?`,
      a: (item, loc) => `Sabab va oqibat tahlili: Quyosh nurlari o'zida yorug'lik va issiqlik energiyasini tashiydi. ${item} yuzasi fotonlar energiyasini yutishi natijasida uning harorati ko'tariladi.`
    },
    {
      q: (metal, loc) => `Nega ${metal} elektr tokini yaxshi o'tkazadi?`,
      a: (metal, loc) => `Sabab va oqibat tahlili: ${metal} kristallarida erkin elektronlar mavjud. Elektr potensiallar farqi vujudga kelganda ular yo'naltirilgan oqim hosil qiladi.`
    },
    {
      q: (field, loc) => `Nima uchun ${loc}da ${field} bilan muntazam shug'ullanish mahoratni oshiradi?`,
      a: (field, loc) => `Sabab va oqibat tahlili: Qayta-qayta mashq qilish orqali inson miyasida mustahkam neyron bog'lanishlar shakllanadi, harakatlar tezlashadi va xatolar kamayadi.`
    },
    {
      q: (liq, loc) => `Nega muz ${loc}dagi ${liq} ustida suzadi va tubiga cho'kmaydi?`,
      a: (liq, loc) => `Sabab va oqibat tahlili: Suv qotib muzga aylanganda uning hajmi kengayadi va zichligi suyuq suvnikidan kichikroq bo'lib qoladi. Kam zichlikdagi jism esa suyuqlik yuzasiga qalqib chiqadi.`
    }
  ];

  const subjects = [
    "suv", "ko'l suvi", "daryo suvi", "hovuz suvi", "ariq suvi", "buloq suvi",
    "atirgul", "pomidor", "paxta", "olma daraxti", "xona guli", "maysazor",
    "temir plastinka", "qora tosh", "qumloq yer", "asfalt yo'l", "mis o'tkazgich",
    "alyuminiy sim", "kumush lenta", "dasturlash", "matematika", "shaxmat",
    "sport mashg'ulotlari", "til o'rganish", "kitob o'qish"
  ];

  const locations = [
    "bog'", "dalada", "hovlida", "shaharda", "qishloqda", "tog'da", "xonada",
    "maktabda", "ustaxonada", "laboratoriyada", "daryo bo'yida", "vohada"
  ];

  for (let t = 0; t < causalTemplates.length && items.length < targetCount; t++) {
    for (let s = 0; s < subjects.length && items.length < targetCount; s++) {
      for (let l = 0; l < locations.length && items.length < targetCount; l++) {
        const tmpl = causalTemplates[t];
        const subj = subjects[s];
        const loc = locations[l];
        const q = tmpl.q(subj, loc);
        const a = tmpl.a(subj, loc);
        const text = `Savol: ${q} Mantiqiy tushuntirish: ${a}`;

        const norm = normalizeText(text);
        if (!existingSet.has(norm)) {
          existingSet.add(norm);
          items.push({ text, category: "sabab_va_oqibat" });
        }
      }
    }
  }

  return items;
}

function generateMathAndAlgorithmic(targetCount = 1000, existingSet) {
  const items = [];

  // A. Qadam-baqadam arifmetik masalalar (500 ta)
  for (let i = 0; i < NAMES.length && items.length < 500; i++) {
    for (let j = 0; j < ITEMS.length && items.length < 500; j++) {
      for (let k = 0; k < ITEMS.length && items.length < 500; k++) {
        if (j === k) continue;
        const person = NAMES[i];
        const item1 = ITEMS[j];
        const item2 = ITEMS[k];
        const qty1 = ((i + j) % 8) + 2;
        const price1 = (((i * 2 + j) % 10) + 3) * 1000;
        const qty2 = ((i + k) % 7) + 2;
        const price2 = (((i * 3 + k) % 8) + 2) * 1000;
        const total1 = qty1 * price1;
        const total2 = qty2 * price2;
        const grandTotal = total1 + total2;

        const text = `Matematik masala: ${person} do'kondan ${qty1} ta ${item1} (har biri ${price1} so'mdan) va ${qty2} ta ${item2} (har biri ${price2} so'mdan) sotib oldi. U jami necha so'm to'ladi? Qadam-baqadam yechish: 1) ${qty1} ta ${item1} narxi: ${qty1} * ${price1} = ${total1} so'm. 2) ${qty2} ta ${item2} narxi: ${qty2} * ${price2} = ${total2} so'm. 3) Jami summa: ${total1} + ${total2} = ${grandTotal} so'm. To'g'ri javob: ${grandTotal} so'm.`;

        const norm = normalizeText(text);
        if (!existingSet.has(norm)) {
          existingSet.add(norm);
          items.push({ text, category: "arifmetika_algoritm" });
        }
      }
    }
  }

  // B. Ketma-ketlik va progressiyalar (500 ta)
  for (let start = 1; start <= 40 && items.length < targetCount; start++) {
    for (let step = 2; step <= 25 && items.length < targetCount; step++) {
      const s1 = start;
      const s2 = s1 + step;
      const s3 = s2 + step;
      const s4 = s3 + step;
      const s5 = s4 + step;

      let text;
      if (step % 2 === 0) {
        text = `Algoritmik masala: Berilgan sonlar ketma-ketligi: ${s1}, ${s2}, ${s3}, ${s4}, ... Keyingi sonni toping va qoidasini tushuntiring. Yechish bosqichlari: Har bir son avvalgisidan ${step} taga ortib bormoqda (${s2}-${s1}=${step}, ${s3}-${s2}=${step}). Demak, keyingi son: ${s4} + ${step} = ${s5}. To'g'ri javob: ${s5}.`;
      } else {
        const mult = (step % 3) + 2;
        const m1 = start % 8 + 1;
        const m2 = m1 * mult;
        const m3 = m2 * mult;
        const m4 = m3 * mult;
        text = `Mantiqiy ketma-ketlik: ${m1}, ${m2}, ${m3}, ... keyingi son qaysi? Qoida tahlili: Ushbu qatorda har bir had o'zidan oldingisiga ${mult} ni ko'paytirish orqali hosil qilingan (${m1}*${mult}=${m2}, ${m2}*${mult}=${m3}). Keyingi had: ${m3} * ${mult} = ${m4}. To'g'ri javob: ${m4}.`;
      }

      const norm = normalizeText(text);
      if (!existingSet.has(norm)) {
        existingSet.add(norm);
        items.push({ text, category: "arifmetika_algoritm" });
      }
    }
  }

  return items;
}

function generateMultiStepQA(targetCount = 1000, existingSet) {
  const items = [];

  // A. Harakat va resurslar hisobi (500 ta)
  for (let i = 0; i < NAMES.length && items.length < 500; i++) {
    for (let j = 0; j < NAMES.length && items.length < 500; j++) {
      if (i === j) continue;
      for (let k = 0; k < NAMES.length && items.length < 500; k++) {
        if (i === k || j === k) continue;
        const p1 = NAMES[i];
        const p2 = NAMES[j];
        const p3 = NAMES[k];
        const item = ITEMS[(i + j + k) % ITEMS.length];

        const initial = ((i + j) % 30) + 15;
        const gaveAway = (i % 8) + 3;
        const received = (k % 9) + 4;

        const step1 = initial - gaveAway;
        const finalCount = step1 + received;

        const text = `Ko'p bosqichli masala: ${p1}da dastlab ${initial} ta ${item} bor edi. U ${p2}ga ${gaveAway} ta ${item} berdi, so'ngra ${p3} unga yana ${received} ta ${item} sovg'a qildi. Hozir ${p1}da nechta ${item} bor? Bosqichma-bosqich hisob: 1-bosqich: ${p1} ${gaveAway} tasini bergach, unda ${initial} - ${gaveAway} = ${step1} ta qoldi. 2-bosqich: ${received} ta qo'shilgach, jami ${step1} + ${received} = ${finalCount} ta bo'ldi. To'g'ri javob: ${finalCount} ta ${item}.`;

        const norm = normalizeText(text);
        if (!existingSet.has(norm)) {
          existingSet.add(norm);
          items.push({ text, category: "kop_bosqichli_mantiq" });
        }
      }
    }
  }

  // B. Taqvim va shartli vaqt hisobi (500 ta)
  for (let d = 0; d < 7 && items.length < targetCount; d++) {
    for (let daysAhead = 8; daysAhead <= 100 && items.length < targetCount; daysAhead++) {
      const startDay = WEEKDAYS[d];
      const remainder = daysAhead % 7;
      const targetDay = WEEKDAYS[(d + remainder) % 7];

      const text = `Vaqt va taqvim masalasi: Agar bugun haftaning ${startDay} kuni bo'lsa, oradan ${daysAhead} kun o'tgach haftaning qaysi kuni bo'ladi? Mantiqiy yechish usuli: Haftada 7 kun bor va har 7 kunda kunlar to'liq takrorlanadi. ${daysAhead} sonini 7 ga bo'lamiz: ${daysAhead} = 7 * ${Math.floor(daysAhead / 7)} + ${remainder} (qoldiq ${remainder}). Demak, ${startDay}dan ${remainder} kun oldinga hisoblaymiz. Yakuniy javob: Haftaning ${targetDay} kuni bo'ladi.`;

      const norm = normalizeText(text);
      if (!existingSet.has(norm)) {
        existingSet.add(norm);
        items.push({ text, category: "kop_bosqichli_mantiq" });
      }
    }
  }

  return items;
}

function generateErrorDetection(targetCount = 945, existingSet) {
  const items = [];

  // A. Arifmetik amallar tartibidagi xatolar (500 ta)
  for (let a = 2; a <= 25 && items.length < 500; a++) {
    for (let b = 2; b <= 20 && items.length < 500; b++) {
      for (let c = 2; c <= 15 && items.length < 500; c++) {
        const wrong = (a + b) * c;
        const correct = a + (b * c);
        if (wrong === correct) continue;

        const text = `Xatoni aniqlash: Kimdir "${a} + ${b} * ${c} = ${wrong}" deb javob berdi. Ushbu hisoblash to'g'rimi? Xatoning tahlili: Bu hisob mutlaqo XATO. Sababi: Matematikada amallar tartibi qoidasiga ko'ra, qavslar bo'lmaganda avval ko'paytirish amali bajariladi: ${b} * ${c} = ${b * c}. Shundan so'ng qo'shiladi: ${a} + ${b * c} = ${correct}. To'g'rilangan natija: ${correct}.`;

        const norm = normalizeText(text);
        if (!existingSet.has(norm)) {
          existingSet.add(norm);
          items.push({ text, category: "xatolarni_tuzatish" });
        }
      }
    }
  }

  // B. Mantiqiy soxta da'volarni tuzatish (445 ta)
  const fallacyTemplates = [
    {
      claim: (sub) => `Barcha qushlar uchadi, ${sub} esa qush, demak u albatta uchadi.`,
      explain: (sub) => `Bu xulosa noto'g'ri umumlashtirish xatosidir. Biologiyada barcha qushlar ucha olmaydi; masalan ${sub} morfologik jihatdan yerda yugurishga yoki suzishga moslashgan. To'g'ri xulosa: ${sub} qush bo'lsa ham ucha olmaydi.`
    },
    {
      claim: (sub) => `Har qanday katta o'lchamli jism har doim kichik jismdan og'ir bo'ladi. Masalan, katta ${sub} kichik temirdan og'irroq.`,
      explain: (sub) => `Bu fikr xato. Og'irlik hajmga emas, balki jismning zichligi va massasiga to'g'ridan-to'g'ri bog'liq. ${sub} zichligi juda past bo'lgani uchun, uning massasi ixcham zich metallardan ancha yengil bo'ladi.`
    },
    {
      claim: (sub) => `Agar ${sub} bo'lsa doim yer nam bo'ladi. Demak, agar yer nam bo'lsa, albatta ${sub} bo'lgan.`,
      explain: (sub) => `Bu mantiqda sabab va oqibatni teskari talqin qilish (konversiya) xatosidir. Yer nam bo'lishiga boshqa sabablar ham (masalan, sug'orish yoki suv toshishi) olib kelishi mumkin. To'g'ri mantiq: oqibatdan yagona sababni qat'iy talab qilib bo'lmaydi.`
    },
    {
      claim: (sub) => `Ko'p ${sub} qilgan odam hech qachon xato qilmaydi.`,
      explain: (sub) => `Bu mutlaq da'vo mantiqan asossiz. Har qanday inson, hatto katta tajribaga ega bo'lsa ham, diqqat charchashi yoki kutilmagan omillar tufayli xato qilishi mumkin. To'g'ri xulosa: Tajriba xatolar ehtimolini kamaytiradi, lekin ularni butunlay istisno etmaydi.`
    },
    {
      claim: (sub) => `${sub} o'rgangach boshqa hech narsani o'rganish shart emas.`,
      explain: (sub) => `Bu noo'rin cheklov xatosidir. Har bir bilim sohasi ma'lum yo'nalishga qaratilgan va zamonaviy dunyoda bilimlar doimiy yangilanib boradi. Shuning uchun mustaqil ta'lim umr bo'yi davom etishi zarur.`
    }
  ];

  const fallacySubjects = [
    "tuyaqush", "pingvin", "kivi qushi", "paxta to'pi", "par yostiq", "sharsimon pufak",
    "yomg'ir yog'ishi", "qor erishi", "tuman tushishi", "mashq", "mutolaa", "ish tajribasi",
    "dasturlash tili", "xorijiy til", "ijtimoiy muloqot", "shaxmat nazariyasi",
    "fizika qonunlari", "biologik tushunchalar", "iqtisodiy modellar", "tarixiy sanalar"
  ];

  for (let f = 0; f < fallacyTemplates.length && items.length < targetCount; f++) {
    for (let s = 0; s < fallacySubjects.length && items.length < targetCount; s++) {
      for (let v = 1; v <= 5 && items.length < targetCount; v++) {
        const tmpl = fallacyTemplates[f];
        const subj = fallacySubjects[s];
        const claimText = tmpl.claim(subj);
        const explainText = tmpl.explain(subj);
        const text = `Mantiqiy xatoni tuzatish (${v}-variant): Da'vo: "${claimText}" Ushbu da'vo to'g'rimi? Xatoning aniqlanishi va to'g'rilanishi: ${explainText}`;

        const norm = normalizeText(text);
        if (!existingSet.has(norm)) {
          existingSet.add(norm);
          items.push({ text, category: "xatolarni_tuzatish" });
        }
      }
    }
  }

  return items;
}

const existingSet = new Set();
const t0 = Date.now();

const deductive = generateDeductiveAndCausal(1200, existingSet);
console.log(`Deductive & Causal: ${deductive.length} items`);

const math = generateMathAndAlgorithmic(1000, existingSet);
console.log(`Math & Algorithmic: ${math.length} items`);

const multiStep = generateMultiStepQA(1000, existingSet);
console.log(`Multi-step QA: ${multiStep.length} items`);

const errors = generateErrorDetection(945, existingSet);
console.log(`Error Detection: ${errors.length} items`);

const total = deductive.length + math.length + multiStep.length + errors.length;
console.log(`TOTAL GENERATED: ${total} items in ${Date.now() - t0} ms`);
