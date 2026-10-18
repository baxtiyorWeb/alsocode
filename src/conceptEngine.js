"use strict";

/**
 * =======================================================================
 *  CONCEPT DEFINITION & DYNAMIC ONTOLOGY SYNTHESIZER
 * =======================================================================
 *  Foydalanuvchi "X nima?", "X nima degani?", "X tushunchasi" deb
 *  so'raganda, qotib qolgan dialog replikalarini («Choy ichib kitob o'qish»)
 *  ko'chirib bermasdan, tushunchaning haqiqiy mohiyatini semantik fazo,
 *  RAG va ontologik bilimlar orqali sintez qiluvchi mustaqil intellekt.
 * =======================================================================
 */

class ConceptDefinitionEngine {
  constructor(embeddings = null, ragEngine = null, memory = null) {
    this.embeddings = embeddings;
    this.ragEngine = ragEngine;
    this.memory = memory;
    this.conceptHistory = new Map();

    // Fundamental tushunchalar ontologiyasi (Ontological Concept Graph)
    this.conceptOntology = new Map([
      ["it", {
        category: "xonaki uy hayvoni",
        nature: "bo'rilar oilasiga mansub, inson tomonidan eng birinchi xonakilashtirilgan, sodiq va sezgir sutemizuvchi jonivor",
        purpose: "insonlarga do'st bo'lish, xonadon va podani qo'riqlash hamda xizmat vazifalarini bajarish",
        details: "Itlar o'zining yuksak sadoqati, o'tkir hid bilish va eshitish qobiliyati bilan mashhurdir."
      }],
      ["mushuk", {
        category: "xonaki uy hayvoni",
        nature: "mushuksimonlar oilasiga mansub, chaqqon, mayin junli va tungi ko'rish qobiliyati rivojlangan yirtqich sutemizuvchi",
        purpose: "xonadonda insonlar bilan yashash, kemiruvchilarni tutish va xushkayfiyat ulashish",
        details: "Ular tozalikni yaxshi ko'radi va mustaqil xarakterga ega."
      }],
      ["qush", {
        category: "umurtqali jonivor",
        nature: "tanasi patlar bilan qoplangan, parvoz qilishga moslashgan qanotlari va tumshug'i bo'lgan tuxum qo'yuvchi jonzot",
        purpose: "tabiatda urug'larni tarqatish, zararkunanda hasharotlarni yo'q qilish va ekologik muvozanatni saqlash",
        details: "Qushlar o'zining xushovoz sayrashi va parvozi bilan tabiat ko'rkidir."
      }],
      ["kit", {
        category: "dengiz sutemizuvchisi",
        nature: "okean va dengizlarda yashovchi, dunyodagi eng ulkan va nafasini o'pka orqali oluvchi suv jonivori",
        purpose: "dengiz ekotizimida ozuqa zanjirini va biologik muvozanatni ta'minlash",
        details: "Ko'k kit Yer yuzida yashagan eng yirik hayvon hisoblanadi."
      }],
      ["daraxt", {
        category: "ko'p yillik o'simlik",
        nature: "yog'ochlashgan asosiy tana va shox-shabbalarga ega bo'lgan ulkan o'simlik turi",
        purpose: "havoni tozalash, fotosintez orqali kislorod ishlab chiqarish, soyalik va meva berish",
        details: "Daraxtlar biosferaning yashil o'pkasi sanaladi."
      }],
      ["kitob", {
        category: "ma'naviy-ma'rifiy manba",
        nature: "qog'oz sahifalarga bosilgan yoki elektron shaklda jamlangan ilmiy, badiiy yoki ma'rifiy asar",
        purpose: "insoniyat bilimlarini, tajribasini va madaniyatini saqlash hamda kelgusi avlodlarga yetkazish",
        details: "Mutolaa orqali inson tafakkuri, dunyoqarashi va so'z boyligi boyiydi."
      }],
      ["suv", {
        category: "kimyoviy birikma va tabiiy suyuqlik",
        nature: "vodorod va kislorod atomlaridan tashkil topgan ($H_2O$), ta'msiz, hidsiz va shaffof modda",
        purpose: "yer yuzidagi barcha tirik mavjudotlarning (inson, hayvon, o'simlik) hayot faoliyati va biologik metabolizmini ta'minlash",
        details: "Suv tabiatda uch xil holatda (suyuq, qattiq muz va gazsimon bug') uchraydi va biosferaning asosi hisoblanadi."
      }],
      ["quyosh", {
        category: "yulduz",
        nature: "Quyosh tizimining markazida joylashgan, ulkan qizigan plazma shari",
        purpose: "Yer sayyorasini yorug'lik, issiqlik va fotosintez uchun zarur energiya bilan ta'minlash",
        details: "Uning tortishish kuchi barcha sayyoralarni o'z orbitasida ushlab turadi."
      }],
      ["oy", {
        category: "tabiiy yo'ldosh",
        nature: "Yer sayyorasining yagona tabiiy yo'ldoshi bo'lib, o'zidan yorug'lik chiqarmaydi, balki Quyosh nurini qaytaradi",
        purpose: "Yerning aylanish o'qini barqarorlashtirish va okeanlarda ko'tarilish-qaytish (suv toshqini) hodisalarini hosil qilish",
        details: "Insoniyat qadami yetgan yagona boshqa osmon jismi hisoblanadi."
      }],
      ["kompyuter", {
        category: "elektron hisoblash mashinasi",
        nature: "dasturlar asosida ma'lumotlarni qabul qilish, qayta ishlash, saqlash va uzatishga mo'ljallangan universal qurilma",
        purpose: "murakkab hisob-kitoblarni tezkor bajarish, axborot texnologiyalari va jarayonlarni avtomatlashtirish",
        details: "Apparat ta'minoti (hardware) va dasturiy ta'minot (software) uyg'unligida ishlaydi."
      }],
      ["telefon", {
        category: "telekommunikatsiya qurilmasi",
        nature: "ovoz, matn, tasvir va raqamli ma'lumotlarni masofaga uzatuvchi elektron aloqa vositasi",
        purpose: "insonlar o'rtasida masofadan qat'i nazar tezkor va uzluksiz aloqani ta'minlash",
        details: "Zamonaviy smartfonlar shaxsiy kompyuter va internet funksiyalarini to'liq o'zida mujassam etgan."
      }],
      ["fotosintez", {
        category: "biologik-kimyoviy jarayon",
        nature: "yashil o'simliklar, suvo'tlar va ayrim bakteriyalarning xlorofill pigmenti yordamida Quyosh nuri energiyasini kimyoviy energiyaga aylantirishi",
        purpose: "organik moddalarni sintez qilish va atmosferaga kislorod ajratib chiqarish",
        details: "Fotosintez — Yerdagi hayotning davomiyligi va atmosferadagi kislorod muvozanatining kafolatidir."
      }],
      ["demokratiya", {
        category: "siyosiy va davlat boshqaruv tizimi",
        nature: "oliy hokimiyat bevosita xalqqa yoki erkin saylovlar orqali saylanadigan vakillarga tegishli bo'lgan boshqaruv shakli",
        purpose: "qonun ustuvorligi, fuqarolarning erkinliklari, inson huquqlari va tengligini kafolatlash",
        details: "Asosiy tamoyillari: hokimiyatlar bo'linishi, ochiqlik, adolatli saylovlar va ko'ppartiyaviylikdir."
      }],
      ["davlat", {
        category: "ijtimoiy-siyosiy tashkilot",
        nature: "ma'lum bir hududda suveren hokimiyatga ega bo'lgan, qonunlar va boshqaruv organlari tizimiga tayangan jamiyatni boshqarish shakli",
        purpose: "jamiyat tartibini saqlash, fuqarolar xavfsizligini ta'minlash va mamlakat taraqqiyotini yo'lga qo'yish",
        details: "Uning asosiy belgilari: chegaralangan hudud, aholi, suverenitet, soliq tizimi va qonunchilikdir."
      }],
      ["iqtisodiyot", {
        category: "ijtimoiy-iqtisodiy fan va tizim",
        nature: "cheklangan resurslar sharoitida inson ehtiyojlarini qondirish uchun tovar va xizmatlarni ishlab chiqarish, taqsimlash, ayirboshlash va iste'mol qilish munosabatlari",
        purpose: "jamiyat farovonligini oshirish va resurslardan unumli foydalanishni yo'lga qo'yish",
        details: "Mikroiqtisodiyot va makroiqtisodiyot tarmoqlariga bo'linadi."
      }],
      ["til", {
        category: "ijtimoiy muloqot va belgilar tizimi",
        nature: "insonlar o'rtasida fikr almashish, bilimlarni to'plash va ifodalash uchun xizmat qiladigan tovushlar, so'zlar va grammatik qoidalar majmui",
        purpose: "jamiyat a'zolarining o'zaro tushunishi, madaniyat va tafakkurning rivojlanishini ta'minlash",
        details: "Har bir xalqning tili uning milliy o'zligi, ruhiyati va tarixiy merosining ko'zgusidir."
      }],
      ["tarix", {
        category: "ijtimoiy-gumanitar fan",
        nature: "insoniyat jamiyatining o'tmishi, taraqqiyot bosqichlari, madaniyatlari va tarixiy voqea-hodisalarini o'rganuvchi fan",
        purpose: "o'tmish tajribasi va xatolaridan saboq olib, bugungi kunni to'g'ri baholash va kelajakni rejalashtirish",
        details: "Yozma manbalar, arxeologik qazilmalar va og'zaki meros asosida o'rganiladi."
      }],
      ["inson", {
        category: "biologik va ijtimoiy mavjudot",
        nature: "ong, nutq, mavhum fikrlash, mehnat qurollari yaratish va axloqiy qadriyatlarga ega bo'lgan tirik mavjudot",
        purpose: "jamiyatda yashash, ezgulik yaratish, ilm olish va tabiat bilan uyg'unlikda taraqqiy etish",
        details: "Inson biologik tabiati bilan hayvonot olamining bir qismi bo'lsa-da, ongi va ruhiyati bilan ijtimoiy-ma'naviy shaxsdir."
      }],
      ["dasturlash", {
        category: "axborot texnologiyalari va raqamli muhandislik sohasi",
        nature: "kompyuterlar va elektron qurilmalarga ma'lum bir vazifani bajarish buyrug'ini beruvchi dasturiy kodlar va algoritmlarni yaratish jarayoni",
        purpose: "inson faoliyatini avtomatlashtirish, muammolarni hisoblash yo'li bilan hal qilish va raqamli tizimlarni yaratish",
        details: "Dasturlash Python, JavaScript, C++, Java kabi dasturlash tillari yordamida amalga oshiriladi."
      }],
      ["algoritm", {
        category: "matematik va mantiqiy qoidalar majmui",
        nature: "qo'yilgan masalani yechish uchun ketma-ket bajarilishi lozim bo'lgan aniq va chekli buyruqlar tartibi",
        purpose: "har qanday hisoblash yoki mantiqiy masalani eng samarali va to'g'ri yo'l bilan hal qilish",
        details: "Algoritm tushunchasi buyuk alloma Muhammad al-Xorazmiy nomi bilan chambarchas bog'liqdir."
      }],
      ["sun'iy intellekt", {
        category: "zamonaviy kompyuter fanlari va intellektual tizimlar sohasi",
        nature: "inson aqliy faoliyatini (o'rganish, mantiqiy fikrlash, qaror qabul qilish, tushunish) kompyuter tizimlarida modellashtirish va yaratish texnologiyasi",
        purpose: "murakkab vazifalarni inson omilisiz tahlil qilish, avtomatlashtirish va yangi bilimlarni mustaqil kashf etish",
        details: "Mashinaviy o'rganish (Machine Learning), chuqur neyron tarmoqlar va tabiiy tilni qayta ishlash (NLP) yo'nalishlarini qamrab oladi."
      }],
      ["internet", {
        category: "global telekommunikatsiya tarmog'i",
        nature: "butun dunyo bo'ylab millionlab kompyuterlar, serverlar va qurilmalarni o'zaro bog'lovchi yagona axborot tizimi",
        purpose: "axborot almashinuvi, tezkor aloqa, ta'lim, biznes va global ma'lumotlar omboridan erkin foydalanishni ta'minlash",
        details: "TCP/IP protokollari asosida ishlaydi va zamonaviy raqamli iqtisodiyotning tayanchidir."
      }],
      ["fan", {
        category: "bilimlar tizimi",
        nature: "tabiat, jamiyat va tafakkur qonuniyatlarini o'rganuvchi, tajriba va dalillarga asoslangan ob'ektiv bilimlar sohasi",
        purpose: "borliq sirlarini anglash, haqiqatni kashf etish va insoniyat hayotini yaxshilash",
        details: "Aniq fanlar (matematika, fizika), tabiiy fanlar (biologiya, kimyo) va ijtimoiy-gumanitar fanlarga bo'linadi."
      }],
      ["ilm", {
        category: "ma'rifiy va intellektual qadriyat",
        nature: "haqiqatni bilish, o'rganish va tushunish natijasida hosil bo'ladigan chuqur bilim va tushunchalar majmui",
        purpose: "jaholatni bartaraf etish, tafakkurni yuksaltirish va komillikka erishish",
        details: "Ilm o'rganish va uni amalda qo'llash har bir inson taraqqiyotining asosiy kalitidir."
      }],
      ["axborot", {
        category: "fundamental tushuncha",
        nature: "atrof-muhit, hodisalar va ob'ektlar haqidagi signallar, belgilar yoki xabarlar orqali uzatiladigan ma'lumotlar",
        purpose: "qaror qabul qilish, noaniqlikni kamaytirish va tizimlarni boshqarish",
        details: "Zamonaviy dunyoda axborot eng qimmatli strategik resurs sanaladi."
      }],
      ["neyron tarmoq", {
        category: "hisoblash va sun'iy intellekt modeli",
        nature: "inson miyasining biologik neyronlari ishlash tamoyiliga asoslangan, o'zaro bog'langan matematik tugunlar (sun'iy neyronlar) majmui",
        purpose: "katta hajmdagi ma'lumotlardagi murakkab qonuniyatlarni mustaqil o'rganish, tasvirlarni tanish va matn yaratish",
        details: "Zamonaviy LLM (katta til modellari) va chuqur o'rganish (Deep Learning) aynan ko'p qatlamli neyron tarmoqlar asosida quriladi."
      }],
      ["matematika", {
        category: "fundamental aniq fan",
        nature: "miqdoriy munosabatlar, fazoviy shakllar, tuzilmalar va o'zgarishlarni mavhum modellar yordamida o'rganuvchi fan",
        purpose: "barcha tabiiy va muhandislik jarayonlarini aniq hisob-kitoblar va mantiqiy isbotlar bilan ifodalash",
        details: "Fanlar podshosi deb e'tirof etiladi va barcha texnologiyalarning negizidir."
      }],
      ["mantiq", {
        category: "falsafiy va matematik fan",
        nature: "to'g'ri fikrlash, mulohaza yuritish, xulosa chiqarish va isbotlash qonun-qoidalarini o'rganuvchi ta'limot",
        purpose: "fikrlar chalkashligining oldini olish, xatolarni fosh qilish va qat'iy haqiqatga yetishish",
        details: "Deduksiya, induksiya, analogiya va sillogizmlar mantiqning asosiy usullaridir."
      }],
      ["fizika", {
        category: "fundamental tabiiy fan",
        nature: "materiya, energiya, fazo, vaqt va ularning o'zaro ta'siri hamda fundamental qonuniyatlarini o'rganuvchi fan",
        purpose: "koinot qanday ishlashini tushunish va yangi texnologiyalar yaratish",
        details: "Mexanika, termodinamika, elektrodinamika, optika va kvant fizikasi kabi yo'nalishlarni o'z ichiga oladi."
      }],
      ["energiya", {
        category: "fizik kattalik",
        nature: "materiyaning harakat va o'zaro ta'sirining universal miqdoriy o'lchovi bo'lib, ish bajarish qobiliyatini ifodalaydi",
        purpose: "barcha tabiiy jarayonlar, biologik hayot va texnik mexanizmlarning ishlashini harakatga keltirish",
        details: "Energiyaning saqlanish qonuniga ko'ra, energiya yo'qdan bor bo'lmaydi va bordan yo'q bo'lmaydi, faqat bir turdan boshqasiga aylanadi."
      }],
      ["koinot", {
        category: "astronomik va falsafiy tushuncha",
        nature: "cheksiz fazo va vaqtda mavjud bo'lgan butun borliq, barcha galaktikalar, yulduzlar, sayyoralar va materiya shakllari",
        purpose: "moddiy borliqning umumiy mavjudlik muhiti",
        details: "Kuzatiladigan koinot Katta Portlash (Big Bang) natijasida taxminan 13.8 milliard yil muqaddam paydo bo'lgan."
      }],
      ["c++", {
        category: "yuqori darajali dasturlash tili",
        nature: "C tili asosida yaratilgan, obyektga yo'naltirilgan, tizimli va tezkor dasturlar yozishga mo'ljallangan qudratli dasturlash tili",
        purpose: "operatsion tizimlar, o'yin dvigatellari, yuqori unumdorlik talab qiluvchi ilovalar va drayverlar yaratish",
        details: "C++ Bjarne Stroustrup tomonidan 1979 yilda ishlab chiqilgan bo'lib, xotira bilan to'g'ridan-to'g'ri ishlash imkonini beradi."
      }],
      ["javascript", {
        category: "yuqori darajali dasturlash tili",
        nature: "veb-sahifalarga dinamiklik va interaktivlik kiritish, shuningdek serverda (Node.js) ishlashga mo'ljallangan keng tarqalgan zamonaviy dasturlash tili",
        purpose: "veb-saytlar, mobil ilovalar va server dasturlarini ishlab chiqish",
        details: "JavaScript 1995 yilda Brendan Eich tomonidan ishlab chiqilgan bo'lib, zamonaviy dasturlash sohasining asosiy texnologiyalaridan biridir."
      }],
      ["javascript dasturlash tili", {
        category: "yuqori darajali dasturlash tili",
        nature: "veb-sahifalarga dinamiklik va interaktivlik kiritish, shuningdek serverda (Node.js) ishlashga mo'ljallangan keng tarqalgan zamonaviy dasturlash tili",
        purpose: "veb-saytlar, mobil ilovalar va server dasturlarini ishlab chiqish",
        details: "JavaScript 1995 yilda Brendan Eich tomonidan ishlab chiqilgan bo'lib, zamonaviy dasturlash sohasining asosiy texnologiyalaridan biridir."
      }],
      ["somsa", {
        category: "o'zbek milliy taomi, xamirli pishiriq",
        nature: "mayin xamir ichiga maydalangan go'sht, dumba yog'i, piyoz va xushbo'y ziravorlar solib, tandirda yoki duxovkada pishiriladigan to'yimli an'anaviy taom",
        purpose: "to'yimli, xushxo'r va lazzatli taomlanish",
        details: "Somsa tandir somsa, qatlama somsa, ko'k somsa va varaqi somsa kabi ko'plab turlarga ega."
      }],
      ["optika", {
        category: "fizikaning muhim bo'limi",
        nature: "yorug'likning tabiati, tarqalishi, yutilishi, sinishi hamda materiya bilan o'zaro ta'sirini o'rganuvchi fan sohasi",
        purpose: "linzalar, teleskoplar, mikroskoplar, lazer va optik tolali aloqa tizimlarini loyihalash",
        details: "Optika geometrik, to'lqin va kvant optikasi kabi yo'nalishlarga bo'linadi."
      }],
      ["baxt", {
        category: "ma'naviy-ruhiy holat va oliy insoniy qadriyat",
        nature: "insonning o'z hayotidan, ezgu amallaridan va erishgan natijalaridan to'liq qanoatlanishi hamda chuqur qalb xotirjamligi hissi",
        purpose: "insonga ruhiy quvvat bag'ishlash, hayot mazmunini boyitish va mehr-oqibatni mustahkamlash",
        details: "Baxt tashqi moddiy boyliklardan ko'ra, insonning ichki xotirjamligi va yaqinlariga yaxshilik ulashishi bilan chambarchas bog'liqdir."
      }],
      ["do'stlik", {
        category: "yuksak insoniy munosabat",
        nature: "o'zaro ishonch, samimiyat, sadoqat va hurmatga asoslangan ruhiy yaqinlik rishtasi",
        purpose: "insonlarga ruhiy dalda berish, qiyin damlarda yelkadosh bo'lish va quvonchni birga baham ko'rish",
        details: "Haqiqiy do'stlik har qanday sinovlarda sinaladi va inson umrining eng bebaho boyliklaridan biridir."
      }],
      ["adolat", {
        category: "axloqiy, huquqiy va falsafiy mezon",
        nature: "haq-huquqlarning to'g'ri taqsimlanishi, har bir insonga o'z xizmati va haqiga yarasha munosabatda bo'lish tamoyili",
        purpose: "jamiyatda tinchlik, tenglik, ishonch va qonun ustuvorligini ta'minlash",
        details: "Adolat — har qanday sog'lom jamiyat va mustahkam davlatchilikning bosh poydevori sanaladi."
      }],
      ["muvaffaqiyat", {
        category: "natija va shaxsiy rivojlanish mezoni",
        nature: "qo'yilgan ezgu maqsadlarga sabr, intizom va tinimsiz bilim hamda mehnat orqali erishish holati",
        purpose: "insonning o'z salohiyatini to'liq ro'yobga chiqarishi va jamiyatga foyda keltirishini ta'minlash",
        details: "Muvaffaqiyat tasodifiy omad emas, balki to'g'ri odatlar va to'xtovsiz harakat samarasidir."
      }],
      ["kesim", {
        category: "gapning bosh bo'lagi (sintaksis)",
        nature: "ega haqidagi harakat, holat, belgi, miqdor yoki hukmni ifodalovchi asosiy grammatik bo'lak",
        purpose: "gapda fikrni shakllantirish, tasdiqlash yoki inkor etish hamda gapni mazmunan tugallash (nima qildi? nima bo'lyapti? qanday? kimdir?)",
        details: "Kesim odatda fe'l orqali (fe'l-kesim), shuningdek ot, sifat, son va olmoshlar orqali (ot-kesim) ifodalanadi hamda ega bilan shaxs va sonda moslashadi."
      }],
      ["ega", {
        category: "gapning bosh bo'lagi (sintaksis)",
        nature: "gapdagi harakat yoki holatning bajaruvchisini, hukm qaratilgan shaxs yoki narsani bildiruvchi mustaqil bo'lak",
        purpose: "gapda kim yoki nima haqida fikr yuritilayotganini ko'rsatish (kim? nima?)",
        details: "Ega bosh kelishikdagi otlar, olmoshlar yoki otlashgan so'zlar bilan ifodalanadi."
      }],
      ["gap", {
        category: "sintaksisning asosiy birligi",
        nature: "mazmunan va intonatsion jihatdan tugallangan, ma'lum bir fikrni ifodalovchi nutq vositasi",
        purpose: "insonlar o'rtasida to'liq axborot, fikr, his-tuyg'u yoki xabar almashishni ta'minlash",
        details: "Gapning grammatik asosini bosh bo'laklar — ega va kesim tashkil etadi."
      }],
      ["gap va kesim", {
        category: "ona tili grammatikasi (sintaksis)",
        nature: "gap va uning bosh bo'lagi munosabatidir. Gap — tugallangan fikrni ifodalovchi sintaktik birlik bo'lsa, kesim — uning grammatik asosini tashkil etib, ega haqidagi harakat, holat yoki hukmni ifodalaydi",
        purpose: "nutqda to'liq, aniq va tushunarli fikr hosil qilish",
        details: "O'zbek tilida kesim odatda gap oxirida keladi va ega bilan shaxs hamda sonda moslashadi."
      }],
      ["gap kesim", {
        category: "ona tili grammatikasi (sintaksis)",
        nature: "gap va uning bosh bo'lagi munosabatidir. Gap — tugallangan fikrni ifodalovchi sintaktik birlik bo'lsa, kesim — uning grammatik asosini tashkil etib, ega haqidagi harakat, holat yoki hukmni ifodalaydi",
        purpose: "nutqda to'liq, aniq va tushunarli fikr hosil qilish",
        details: "O'zbek tilida kesim odatda gap oxirida keladi va ega bilan shaxs hamda sonda moslashadi."
      }],
      ["ona tili", {
        category: "milliy va ma'naviy qadriyat",
        nature: "inson bolaligidan oila va o'z xalqi muhitida birinchi o'rgangan, uning tafakkuri va milliy o'zligini shakllantiruvchi til",
        purpose: "fikrni erkin va teran ifodalash, madaniy merosni asrab-avaylash hamda avlodlarga yetkazish",
        details: "Ona tili har bir millatning ruhi, g'ururi va eng buyuk ma'naviy boyligidir."
      }]
    ]);
  }

  /**
   * So'rovdan tushuncha / obyekt nomini ajratib olish
   * @param {string} text
   * @returns {string|null}
   */
  extractTargetConcept(text) {
    if (!text) return null;
    let clean = text.toLowerCase().replace(/[`ʼʻ']/g, "'").trim();
    clean = clean.replace(/^(?:menga|iltimos|aytib\s+bering|aytingchi|aytchi|bilasizmi|o'zi|marhamat\s+qilib|ona\s+tilda|ona\s+tilida|o'zbek\s+tilida|fizikada|astronomiyada|kimyoda|biologiyada)\s+/i, "").trim();

    // "X nima?", "X nima degani?", "X nima o'zi?", "X bu nima?", "X nima ?"
    // Eslatma: "X nima deysan / deysiz / deb o'ylaysan" bu ta'rif emas, fikr/mulohaza so'rovi!
    const defMatch1 = clean.match(/^([a-zа-яёo'g'0-9\s+#.-]+?)\s+(?:bu\s+)?(?:nima(?!\s+(?:deysan|deysiz|deb|aytasan|aytasiz|fikrdasan|fikrdasiz))|nimani\s+anglatadi|qanday\s+jarayon|tushunchasi|ta'rifi)\b/i);
    if (defMatch1) {
      let candidate = defMatch1[1].replace(/^(?:bir\s+|bu\s+)/i, "").replace(/\s+bu$/i, "").trim();
      if (candidate.length >= 1) {
        const wordsCount = candidate.split(/\s+/).length;
        if (wordsCount <= 3 || this.conceptOntology.has(candidate)) {
          return candidate;
        }
      }
    }

    // "X haqida ma'lumot ber", "X haqida tushuntir", "X haqida gapir"
    const defMatch2 = clean.match(/^([a-zа-яёo'g'0-9\s+#.-]+?)\s+haqida\s+(?:ma'lumot|tushuncha|tushuntir|gapir|batafsil)/i);
    if (defMatch2) {
      let candidate = defMatch2[1].replace(/^(?:bir\s+|bu\s+)/i, "").trim();
      if (candidate.length >= 1) {
        return candidate;
      }
    }

    // "X ga ta'rif ber", "X tushunchasiga ta'rif ber"
    const defMatch3 = clean.match(/^([a-zа-яёo'g'0-9\s]+?)(?:ga|ka|qa)?\s+(?:ta'rif|tushuncha)\s+(?:ber|bering)/i);
    if (defMatch3) {
      let candidate = defMatch3[1].replace(/^(?:bir\s+|bu\s+)/i, "").trim();
      if (candidate.length > 1) {
        return candidate;
      }
    }

    // "X qanday taom?", "X qanday meva?", "X qanday hayvon?", "X qanday narsa?"
    const defMatch4 = clean.match(/^([a-zа-яёo'g'0-9\s+#.-]+?)\s+qanday\s+(?:taom|ovqat|pishiriq|meva|sabzavot|hayvon|qush|o'simlik|dastur|til|fan|hodisa|tushuncha|narsa)\b/i);
    if (defMatch4) {
      let candidate = defMatch4[1].replace(/^(?:bir\s+|bu\s+)/i, "").trim();
      if (candidate.length >= 1) {
        return candidate;
      }
    }

    return null;
  }

  /**
   * Tushunchaga intellektual va ontologik ta'rif berish
   * @param {string} text
   * @param {boolean} isFormal
   * @param {Object|null} memory
   * @returns {{ reply: string, concept: string, source: string } | null}
   */
  synthesizeDefinition(text, isFormal = true, memory = null) {
    const concept = this.extractTargetConcept(text);
    if (!concept) return null;

    const lowerConcept = concept.toLowerCase().trim();
    const mem = memory || this.memory;

    // 0. Kognitiv xotiradan (Foydalanuvchi o'rgatgan bilimlar) ustuvor tekshirish
    if (mem && typeof mem.recallFacts === "function") {
      const recalled = mem.recallFacts(concept);
      if (recalled.length > 0 && recalled[0].score >= 2.0) {
        const fact = recalled[0].fact;
        const subLower = fact.subject.toLowerCase();
        if (subLower === lowerConcept || lowerConcept.includes(subLower) || subLower.includes(lowerConcept)) {
          const capConcept = this._capitalize(lowerConcept);
          const cleanObj = fact.object.replace(/\bhisoblanadi\.?$/i, "").trim();
          const endsWithDir = /(?:dir|tir)$/i.test(cleanObj);
          const reply = isFormal
            ? (endsWithDir ? `${capConcept} — bu ${cleanObj}.` : `${capConcept} — bu ${cleanObj} hisoblanadi.`)
            : `${capConcept} — bu ${cleanObj}.`;

          return {
            reply,
            concept: lowerConcept,
            source: "CognitiveMemory"
          };
        }
      }
    }

    // 1. Ontologik bilimlar grafigidan tekshirish (aniq yoki butun so'z mosligi)
    let data = this.conceptOntology.get(lowerConcept);
    let matchedKey = lowerConcept;
    if (!data) {
      for (const [key, val] of this.conceptOntology.entries()) {
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const keyRegex = new RegExp(`(?:^|[^a-zа-яёo'g'0-9])${escapedKey}(?:$|[^a-zа-яёo'g'0-9])`, "i");
        if (keyRegex.test(lowerConcept) || key === lowerConcept) {
          data = val;
          matchedKey = key;
          break;
        }
      }
    }

    if (data) {
      const capConcept = this._capitalize(matchedKey);
      const history = this.conceptHistory.get(matchedKey) || [];
      const turn = history.length;
      const mode = turn % 5;
      let reply = "";

      if (mode === 0) {
        // 1-marta: To'liq, Ilmiy va Tahliliy
        reply = `${capConcept} — bu ${data.category} bo'lib, ${data.nature}.\n\n` +
          `Asosiy vazifasi va mohiyati: ${data.purpose}.\n` +
          `${data.details}`;
      } else if (mode === 1) {
        // 2-marta: Qisqa, Lo'nda va Mohiyatli (Concise Essence)
        reply = `Qisqacha ifodalaganda, ${matchedKey} — ${data.nature}. Uning asosiy mohiyati ${data.purpose}dan iborat bo'lib, ${data.category} sanaladi.`;
      } else if (mode === 2) {
        // 3-marta: Amaliy va Hayotiy Jihat (Pragmatic / Practical)
        reply = `Amaliy jihatdan olganda, ${matchedKey}ning o'rni beqiyos: u ${data.category} sifatida ${data.purpose}ni ta'minlaydi. ${data.details}`;
      } else if (mode === 3) {
        // 4-marta: Tahliliy va Muqobil Qirra (Alternative Perspective)
        reply = `Kengroq tahlil qiladigan bo'lsak, ${matchedKey} — bu ${data.category} bo'lib, insoniyat va tabiatda ${data.nature} sifatida namoyon bo'ladi. Bosh maqsadi: ${data.purpose}.`;
      } else {
        // 5-marta: Ixcham Xulosa (Epistemic Summary)
        reply = `Xulosa o'rnida aytish mumkinki, ${matchedKey} — bu ${data.purpose}ga xizmat qiluvchi muhim ${data.category}dir.`;
      }

      history.push(reply);
      this.conceptHistory.set(matchedKey, history);

      return {
        reply,
        concept: matchedKey,
        source: "ConceptOntologyGraph"
      };
    }

    // 2. Agar ontologiyada ham, xotirada ham aniq ta'rif bo'lmasa, maxsus DocumentRAGEngine ga yo'l berish uchun null qaytaramiz
    return null;
  }

_capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}
}

module.exports = ConceptDefinitionEngine;
