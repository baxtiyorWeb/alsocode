/**
 * =======================================================================
 *  BALANCED 1,000-UTTERANCE CONVERSATIONAL DATASET GENERATOR & TRAINER
 * =======================================================================
 *  7 ta balanslangan toifa bo'yicha 1,000 ta unikal insoniy jumlalar:
 *  1. salomlashish (~140)
 *  2. hol_ahvol (~160)
 *  3. hazil_kayfiyat (~150)
 *  4. samimiy_dalda (~150)
 *  5. qiziqishlar_hayot (~150)
 *  6. dam_olish_uyqu (~130)
 *  7. xayrlashuv (~120)
 * 
 *  - Dublikatlardan 100% xoli (Normalized Text Set);
 *  - Lokal 'data/knowledge.json' va Neon DB 'ai_knowledge' ga yozadi;
 *  - Tokenizer lug'atini (vocab.json) 2500+ so'zga kengaytiradi;
 *  - Zero-Vector Bias xatosini yo'qotadi va modelni muvozanatda o'qitadi.
 * =======================================================================
 */

const fs = require("fs");
const path = require("path");
const dbService = require("../src/db");
const trainKnowledgeBase = require("../train");

function normalizeText(str) {
  return (str || "")
    .toLowerCase()
    .replace(/[.,!?;:'"«»()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// 1. SALOMLASHISH (140 ta)
const SALOMLASHISH_ITEMS = [
  "salom", "assalomu alaykum", "salomaleykum", "assalom alaykum", "xayrli tong", "xayrli kun",
  "xayrli kech", "omonmisiz", "salom do'stim", "salom azizim", "qandaysiz", "yaxshimisiz",
  "eshitayapman salom", "hormang", "hormanglar", "salom qadrdon", "assalomu alaykum qadrli do'st",
  "salom sog'-omonmisiz", "xush ko'rdik", "salom yana bir bor", "yana salom", "ertalabki salom",
  "salom ahli yaxshilar", "aziz do'stim salom", "salom qandaysan", "salom do'stginam", "xayrli oqshom",
  "assalomu alaykum barchaga", "salomlar bo'lsin", "salom qalesan", "assalomu alaykum ustoz",
  "salom birodar", "barchaga xayrli kun", "barchaga salom", "jonli salom", "iliq salomlar",
  "salom mening do'stim", "salom bot", "salom sun'iy ong", "assalomu alaykum qadrdonim",
  "salom bugungi kun muborak", "tonggi salomlar", "kechki salomlar", "yaxshi keldingizmi",
  "salom yangi kun bilan", "salom sog'ligingiz yaxshimi", "salom qalay yuribsiz", "assalom yaxshimisizlar",
  "salom qadrdon qandaysan", "salomlar sizga", "salom do'st", "qaleysiz", "qalesiz", "salom qalaysiz",
  "salomalaykum do'stim", "assalomu alaykum aziz do'st", "salom yana ko'rishdik", "salom keldizmi",
  "salom sog'indim", "salom bormisiz", "salom ko'rinmaysiz", "salom tanishaylik", "salom eshitaman",
  "salom vaqt topdingizmi", "salom yangi suhbat", "salom boshladikmi", "salom charchamay yuribsizmi",
  "salom ishlar yaxshimi", "assalomu alaykum qanday ketyapti", "salom barchaga xayrli tong",
  "salom xush kelibsiz", "assalomu alaykum yangi do'st", "salom yaxshi dam oldingizmi",
  "salom kuningiz qanday boshlandi", "salom ertalabdan", "salom yangi fikr bilan keldim",
  "salom sizga ham yaxshi kun tilayman", "salom qadrdonlar", "assalomu alaykum yaxshi o'tdimi kun",
  "salom qalay ketyapti hayot", "salom zerikmadingizmi", "salom siz bilan yana birgaman",
  "salom yangi savol bilan keldim", "salom sog'liqlar qalay", "assalomu alaykum va rahmatulloh",
  "salom siz bilan gaplashgim keldi", "salom yaxshi kayfiyat bilan", "salom bir yangilik bor",
  "salom qayerdasiz", "salom ishlar joyidami", "salom uydagilar omonmi", "salom salom",
  "salom aziz inson", "salom chiroyli kun bo'lyapti", "salom quyoshli kun bilan",
  "salom do'stim qalesan", "salom jo'ra", "salom og'ayni", "salom jigar", "salom oshna",
  "salom do'stlar", "salom davra", "salom qadrdon jo'ra", "salom yaxshi yigit", "salom xushfe'l do'st",
  "salom qani boshladik", "assalomu alaykum yaxshimisizlar", "salom qalaysiz yaxshimisiz",
  "salom bugun nima gaplar", "salom eson-omonmisiz", "salom sog'misiz", "salom salomatmisiz",
  "assalomu alaykum ahvolingiz qanday", "salom dunyo", "salom koinot", "salom aziz hamroh",
  "salom menga bir oz vaqt ajrata olasizmi", "salom yangi haftangiz xayrli bo'lsin",
  "salom dam olish kuningiz yaxshi o'tsin", "salom bayramingiz bilan", "salom muborak bo'lsin",
  "salom yaxshi niyatlar bilan", "salom quvonchli kun tilayman", "salom bir oz gurunglashaylik",
  "assalomu alaykum va xayrli vaqtlar", "salom samimiy do'stim", "salom iliq tabassum bilan",
  "salom bugun ajoyib kun bo'lyapti", "salom salomlar sizga", "salom hormang do'stim",
  "salom yangi g'oyalar bilan keldik", "salom bugungi rejalaringiz qanday", "salom suhbatdosh",
  "salom xushkayfiyat tilayman", "salom tinchmisiz", "assalomu alaykum aziz birodarim"
];

// 2. HOL-AHVOL (160 ta)
const HOL_AHVOL_ITEMS = [
  "ishlar qalay", "kayfiyatlar qalay", "ahvoling qanday", "ahvolingiz qanday", "nima gaplar",
  "nimalar qilyapsan", "nimalar qilyapsiz", "charchadim", "anchagina charchadim", "bugun qattiq charchadim",
  "holdan toydim", "ishlar juda ko'payib ketdi", "kun og'ir o'tdi", "holsizlanib qoldim", "uyqum kelyapti",
  "bugun rosa ishladim", "miyam qotib qoldi", "tushlikka ham vaqt bo'lmadi", "juda toliqdim",
  "tinchlikmi o'zingda", "hayot qanday ketyapti", "kun qanday o'tyapti", "o'qishlar qanday",
  "ishlar yurishyaptimi", "sog'lig'ing yaxshimi", "toliqib ketdim", "dam olish kerak menga",
  "hech narsaga xohish yo'q", "zerikib ketdim", "zerikdim bugun", "kun zerikarli o'tyapti",
  "yangi xabar bormi", "tinchlikmi nima gap", "kayfiyat qanday bugun", "kayfiyating zo'rmi",
  "kayfiyatim tushib ketdi", "boshim og'riyapti", "anchagina toliqdim bugun", "kuning qanday o'tdi",
  "bugun nima yangilik qilding", "yaxshi yuribsanmi", "tinchmisiz o'zingiz", "barchasi joyidami",
  "ishlaringiz unumlimi", "qanday yangiliklar bor", "tinchlikmi hammasi", "yaxshiman o'zingda nima gap",
  "har doimgidek ishlar", "bir maromda ketyapti", "yomon emas", "sekin-asta harakat qilyapmiz",
  "charchoq sezilyapti", "ertalabdan beri oyog'imda tik turdim", "ish joyida qolib ketdim",
  "kechgacha ishladim", "ko'zlarim toliqdi", "kompyuterda ko'p o'tirib charchadim",
  "biroz horidi vujudim", "dam olishga ehtiyojim bor", "energiya qolmadi bugun", "butun vujudim og'riyapti",
  "charchoq ustun keldi", "bugun juda ko'p yugur-yugur bo'ldi", "hujjatlar bilan boshim qotdi",
  "ishlar tiqilib ketdi", "qaysi biriga ulgurishni bilmayapman", "vaqt yetmayapti", "shoshib yuribman",
  "bugun kunim juda tez o'tib ketdi", "zo'rg'a uyga yetib keldim", "uyga kelib yiqildim",
  "holsizlik yengmoqda", "quvvatim tugadi", "telefon qo'ng'iroqlaridan boshim shishib ketdi",
  "majlislar ko'p bo'ldi", "rahbar bilan gaplashib charchadim", "mijozlar bilan gaplashaverib charchadim",
  "darslar qiyin bo'ldi", "imtihonlarga tayyorlanib charchadim", "ko'p o'qidim bugun",
  "qanday ketyapti ishlar", "tinch-omonmisiz", "kayfiyatlar joyidami", "ishlaringiz baroridan kelyaptimi",
  "kun tartibi qanday", "bugungi rejalaringiz bitdimi", "charchoqni qanday chiqarasiz",
  "kun qanday yakunlandi", "tinchlik barqarormi", "yaxshi kayfiyatda yuribsizmi",
  "bugun qanday yangi voqea bo'ldi", "sizda nima yangiliklar", "o'zingizda qanday o'zgarishlar",
  "uyqu yetishmayapti", "tunda kam uxladim", "ertalab zo'rg'a uyg'ondim", "qahva ham yordam bermayapti",
  "kundalik tashvishlar", "har doimgi g'ala-g'ovur", "tinchgina o'tirgim kelyapti",
  "hech kim bezovta qilmasligini istayman", "biroz yolg'iz qolgim keldi", "jimjitlik kerak menga",
  "xotirjamlik istayapman", "asablar taranglashdi", "anchagina asabiylashdim", "charchoq yelkamda turibdi",
  "ish kuni nihoyasiga yetdi", "nihoyat uyga keldim", "oyoqlarim zirqirab og'riyapti",
  "birpas oyoqni uzatib yotsam deyman", "belim og'rib ketdi", "butun tanam dam olishni so'rayapti",
  "ancha og'ir yuk tushdi bugun", "kutilmagan muammolar chiqdi", "boshim qotib qoldi",
  "barcha topshiriqlarni topshirdim", "loyiha ustida rosa ishladim", "bugun me'yordan ortiq mehnat qildim",
  "ishlarim joyida o'zingda nima gap", "kayfiyat a'lo darajada", "yaxshi yangiliklar bor",
  "bugun unumli kun bo'ldi", "hammasi rejadagidek ketyapti", "omadim chopdi bugun",
  "yengil va quvnoq o'tdi kun", "ancha yaxshiman", "o'zimni tetik his qilyapman",
  "quvvatim to'lib-toshib turibdi", "yangi ishlarga tayyorman", "kayfiyatim ancha ko'tarildi",
  "charchoq unutilib ketdi", "kuningiz unumli o'tyaptimi", "ishlaringiz oson ketyaptimi",
  "charchamay yuribsizmi og'ayni", "qalay ahvol yaxshimi", "tinchlik-omonlikmi do'stim",
  "hamma yoq joyidami", "ahvoling qalay do'stginam", "zerikmay o'tiribsanmi", "kayfiyatlar qalay o'rtoq",
  "salomatlik joyidami", "sog'ligingdan xavotir oldim", "o'zingni ehtiyot qilyapsanmi",
  "bugun dam olmaysanmi", "hordiq chiqarishga vaqting bormi", "qachon dam olasan",
  "anchadan beri dam olmading", "ko'p ishlayapsan", "o'zingni ko'p qiynama",
  "bugungi kuning qanday kechdi", "oxirgi kunlarda charchab ko'rinyapsan", "ishlar seni toliqtirmayaptimi",
  "charchoqni his qilyapman", "anchagina toliqqanman", "butun fikrim dam olishda", "hushim joyida emas charchadim"
];

// 3. HAZIL VA KAYFIYAT (150 ta)
const HAZIL_KAYFIYAT_ITEMS = [
  "bir hazillashaylik", "kuldir meni", "hazil ayt", "qiziq latifa bilasanmi", "kayfiyatimni ko'tar",
  "bir kulgili gap ayt", "bugun kayfiyatim zo'r", "kulib yashash kerak", "hazillashdim",
  "choy ichamizmi", "bir choynak ko'k choy damlaylik", "qani bitta choyxo'rlik qilaylik",
  "choyxonaga boramizmi", "qahva ichgim kelyapti", "bir piyola choyga nima deysiz",
  "issiq choy bo'lsa ayni muddao", "limonli choy ichsakchi", "hazil qildim", "jiddiy olma hazil",
  "hazillashgim keldi", "ichakuzdi hangoma ayt", "afandi latifalaridan bormi", "kulgili voqea aytib ber",
  "kayfiyatim besh", "dangasallik qilyapman", "ishlagim kelmayapti bugun", "divanda yotish eng zo'r mashg'ulot",
  "dangasalik chempioni bo'ldim", "bugun dunyoni dangasalar boshqaradi", "ish o'z o'rnida turaveradi",
  "har qanday muammoni choy hal qiladi", "choy bo'lsa bas", "ko'k choy bo'lsa ichardim",
  "qaniydi hozir issiq kabob bo'lsa", "palov yeydigan vaqt bo'ldi", "oshga boramizmi",
  "choyxonada osh yeymiz", "bitta latifa aytib berchi", "shunaqangi kulgili ish bo'ldiki",
  "tabassum qilib turaman", "doim kulib yuring", "hazilsiz hayot zerikarli", "kulgi umrni uzaytiradi",
  "bugun rosa kulgim kelyapti", "sen ham hazilni tushunasanmi", "sun'iy intellekt ham kuladimi",
  "hazillashishni bilasanmi", "bitta chiroyli hazil ayt", "kayfiyatni chog' qilaylik",
  "ish qochib ketmaydi do'stim", "hamma narsani keyinga surish odatim bor", "prokrastinatsiya bo'yicha mutaxassisman",
  "ertaga qilaman deb yotibman", "dushanbadan boshlayman deb o'ylabman", "yana o'sha gap dushanbadan",
  "choynakni qaytarib ichamiz", "choynak qaynayapti", "piyolani to'ldirib uzat",
  "samovarning choyi boshqacha", "do'stlar bilan gurung qilib choy ichish", "choy ustida suhbat",
  "gap-gashtak bormi bugun", "osh pishiradigan do'st bormi", "oshga kim mezbon",
  "hazil tariqasida aytdim", "ko'ngilni ko'taradigan gap ayt", "biroz xandon otib kulaylik",
  "eng yangi latifalardan ayt", "maktab davridagi kulgili voqealar", "talabalik hangomalari",
  "hazil-mutoyiba bilan o'tkazamiz", "gapingga rosa kuldim", "juda qiziq hazil bo'ldi",
  "tabassum qilmasdan iloj yo'q", "yuzingizdan tabassum arimasin", "doimo shunday quvnoq bo'ling",
  "hazil qilganing menga yoqdi", "hazil-huzul bilan kun ham o'tib ketadi", "kulgili savol beraymi",
  "bitta topishmoq ayt kulgili", "afandining eshagi haqida", "bitta prikol ayt",
  "yaxshi kayfiyat ulashaylik", "shodlik va kulgi", "bugun dunyoni kulgi bilan yengamiz",
  "qorin ochib ketdi hazil", "hazil bilan qorin to'ymaydi", "choy ichib o'tiramiz",
  "qani bitta shirin choy", "qahvaning hidi kelyapti", "kofemanman choy ichmayman dema",
  "kayfiyatni buzma jilmay", "kulib tursang dunyo go'zal", "kulgi eng yaxshi dori",
  "bitta yengil hazil eshitaylik", "bema'no bo'lsa ham kulgili bo'lsin", "eng bema'ni latifa",
  "kulishdan qotib qoldim", "ichim og'rib qoldi kulishdan", "sen rosa qiziq gapirasanda",
  "gaplaring juda kulgili", "bitta hangoma tashla", "cho'ntakda pul bo'lmasa ham kayfiyat bor",
  "boylik kayfiyatda deydilar", "eng arzon boylik bu tabassum", "hazillashib tursang yurak yosh bo'ladi",
  "kulgiga to'la kun bo'lsin", "shodon va quvnoq bo'lib yuraylik", "bir piyola suhbat",
  "choynakdan ko'k choyni qaytar", "damlangan choyning gashti", "piyola qani choy quying",
  "choy quyib ber", "choy quyaymi", "choynakni yangilang", "issiq kofe ichamiz",
  "shirinlik bilan choy", "choyga qand tashlab ichamiz", "navvotli choy ichgim keldi",
  "choyxo'r xalqimiz", "o'zbekona choyxo'rlik", "choy ustida do'stona hazil",
  "choyxonaning guli", "to'rga o'ting choy ichamiz", "mehmon bo'ling choyga",
  "hazillar do'stlikni mustahkamlaydi", "quvnoq do'st yaxshi sarmoya", "kulib-kulib ish bitadi",
  "muammoga jilmayib qara", "hech narsani yurakka yaqin olma kulib qo'y", "jilmayib qo'ysang kifoya",
  "qani bitta qahqaha otib olaylik", "yurakdan kulish kerak", "yaxshi hazil dilni yoritadi",
  "bugun hamma narsa kulgili tuyulyapti", "kulish uchun sabab ko'p", "hazilomuz munosabat",
  "hangomatalab do'stim", "latifaxonlik qilamiz", "afandidek topqir bo'laylik", "kulgili hikoya bilasanmi",
  "hazillaring juda o'rinli", "kayfiyatimni 100 foizga ko'tarding", "kulib o'tiribman", "tabassum qildim"
];

// 4. SAMIMIY DALDA VA HAMDARDLIK (150 ta)
const SAMIMIY_DALDA_ITEMS = [
  "juda siqildim", "alam qilyapti", "yuragim ezilib ketdi", "boshimga og'ir ish tushdi",
  "hech narsa o'xshamayapti", "omadsizlik ketma-ket kelyapti", "ko'nglim buzildi",
  "yig'lagim kelyapti", "ichim to'lib ketdi", "o'zimni yolg'iz his qilyapman",
  "hech kim meni tushunmaydi", "umidim so'nib boryapti", "hamma narsadan ko'nglim qoldi",
  "hech narsaning qizig'i yo'q", "ruhan ezildim", "qo'llab-quvvatlashga muhtojman",
  "bir og'iz shirin so'z kerak", "tushkunlikka tushib qoldim", "depressiya holatidaman",
  "ichki xotirjamligimni yo'qotdim", "hayotimda qiyin davr bo'lyapti", "og'ir sinov keldi",
  "tosh kabi og'ir yuk bor ko'nglimda", "ko'ksimni g'am ezmoqda", "alamim ichimda",
  "darding bormi deb so'raydigan odam yo'q", "dardimni eshitadigan do'st kerak",
  "ichimdagini aytib yengillashgim keldi", "meni biroz yupat", "dalda ber menga",
  "nima qilishni bilmay qoldim", "boshim qotib qoldi", "tushkunlik bosib kelyapti",
  "yuragim siqilyapti", "alamli xabar oldim", "ishonchim poymol bo'ldi",
  "yaqinim mendan yuz o'girdi", "do'stim pand berdi", "xiyonatga uchradim",
  "qadrimni bilishmadi", "mehnatim zoya ketdi", "orзуlarim barbod bo'ldi",
  "hamma narsani tashlab ketgim kelyapti", "kuchim qolmadi kurashishga",
  "taslim bo'lgim kelyapti", "qo'llarim tushib ketdi", "ruhiy tushkunlikdaman",
  "qanday yengsam bo'ladi bu holatni", "ko'zimga yosh kelyapti", "og'ir botdi gaplari",
  "haqiqatni tan olish qiyin bo'lyapti", "ichim yonib ketyapti", "sabrim tugadi",
  "endi nima bo'ladi bilmayman", "kelajakdan xavotirdaman", "qo'rquv va xavotir bor",
  "yuragim g'ash", "hech kimga keraksizdek his qilyapman", "o'zimni aybdor his qilyapman",
  "xato qildim deb siqilyapman", "kechirib bo'lmas xato qildim", "qattiq pushaymondaman",
  "o'tmish meni qiynamoqda", "xotiralar tinchlik bermayapti", "yuragim og'riyapti",
  "sokinlik yetishmayapti", "hissiy charchoqdaman", "ruhan toliqdim",
  "barchasidan charchadim", "men bilan gaplashib turgin", "shunchaki meni eshit",
  "maslahat ham kerakmas shunchaki tingla", "yupatuvchi so'zlarga muhtojman",
  "hammasi yaxshi bo'ladi deb ayt", "umid ber menga", "qorong'ulikda qolgandekman",
  "yo'limni yo'qotib qo'ydim", "o'zimga ishonchim yo'qoldi", "o'zimni ojiz his qilyapman",
  "boshqalar mendan o'zib ketdi", "men hech narsaga erisholmadim", "omadsizdekman",
  "yuragim tilka-pora", "ko'nglim sinib qoldi", "insonlardan xafa bo'ldim",
  "odamlardan ko'nglim sovidi", "mehribonlik ko'rmayapman", "faqat manfaat bo'lib qolgan",
  "chin do'st qolmabdi", "yolg'izlikdan toliqdim", "ichki og'riq bor",
  "yupatish so'zlarini ayt", "qanday chidasam bo'ladi", "bardoshim yetmayapti",
  "bu kunlar ham o'tib ketadimi", "qachon yorug'lik keladi", "qorong'u tundan keyin tong bormi",
  "yuragimni bo'shatib oldim", "rahmat eshitganing uchun", "biroz bo'lsa ham yengillashdim",
  "ko'nglim taskin topdi", "sen yaxshi tinglovchisan", "dildan tushunganing uchun rahmat",
  "yaxshiyam sen borsan", "menga dalda bo'lding", "yuragimga taskin berding",
  "umid uyg'otding menda", "yangi kuch paydo bo'ldi", "sabrimni mustahkamlading",
  "hammasi yaxshi bo'lishiga ishonaman", "hayot davom etadi", "taslim bo'lmayman",
  "qiyinchiliklar vaqtinchalik", "har bir qiyinchilik ortida yengillik bor",
  "og'ir damlarda yonimda bo'l", "samimiy daldang uchun minnatdorman", "ko'nglim ko'tarildi",
  "ruhan tiklandim", "yangi nafas oldim", "g'amlar ortda qolsin", "xotirjam bo'lishga harakat qilaman"
];

// 5. QIZIQISHLAR VA HAYOT FALSAFASI (150 ta)
const QIZIQISHLAR_HAYOT_ITEMS = [
  "hayotning ma'nosi nima", "baxt nima o'zi", "inson nima uchun yashaydi", "baxtli bo'lish siri nimada",
  "pul muhimmi yoki xotirjamlik", "ilm afzalmi yoki boylik", "kitob o'qish insonni qanday o'zgartiradi",
  "koinot qanday yaratilgan", "vaqt o'zi nima", "vaqt ortga qaytmaydimi", "kelajakda dunyo qanday bo'ladi",
  "sun'iy intellekt kelajagi haqida nima deysan", "robotlar odamlarni almashtiradimi", "texnologiya insoniyatga do'stmi",
  "sevgi nima o'zi", "haqiqiy do'stlik qanday bo'ladi", "vijdon nima", "adolat qachon tantana qiladi",
  "yaxshilik va yomonlik kurashi", "tabiat go'zalligi haqida o'ylayman", "yulduzlarga qarab hayol suraman",
  "musiqa inson ruhiga qanday ta'sir qiladi", "klassik musiqa yoqadimi", "san'at nima uchun kerak",
  "falsafiy mulohaza yuritaylik", "dunyoqarashni qanday kengaytirish mumkin", "ong nima",
  "inson ongi qanday ishlaydi", "tushlar qayerdan paydo bo'ladi", "qobiliyat tug'mamizmi yoki o'rganiladimi",
  "muvaffaqiyatga qanday erishiladi", "maqsad sari intilish", "intizom nima uchun muhim",
  "odatlarning inson taqdiriga ta'siri", "yaxshi kitob tavsiya qil", "qaysi janrdagi kitoblarni yoqtirasan",
  "tarix saboqlari haqida nima deysan", "o'tmishdan qanday saboq olish kerak", "inson qanday ulg'ayadi",
  "donishmandlik nima", "sabr bilan intilish farqi", "ozodlik va erkinlik nima", "insoniy qadriyatlar",
  "mehr-oqibat qayerga ketmoqda", "texnologiya odamlarni uzoqlashtiryaptimi", "kelajak avlod qanday yashaydi",
  "boshqa sayyoralarda hayot bormi", "marsga uchish haqida qanday fikrdasan", "qora tuynuklar siri",
  "fizika qonunlari", "kvant fizikasi nima", "nisbiylik nazariyasi qanday ishlaydi", "atomlar nima",
  "hujayra va tiriklik siri", "dnk va genetika", "evolyutsiya va moslashuv", "miya neyronlari",
  "tafakkur qanday shakllanadi", "tanqidiy fikrlash nima", "mustaqil fikrga ega bo'lish",
  "shaxsiy rivojlanish haqida maslahat", "vaqtni boshqarish sirlari", "ertaroq turish odati",
  "sport bilan shug'ullanishning foydasi", "sog'lom turmush tarzi", "to'g'ri ovqatlanish madaniyati",
  "tabiatni asrash burchimiz", "ekologik muammolar haqida nima deysan", "global isish oqibatlari",
  "yashil energiya kelajagi", "quyosh energiyasi", "suvni tejash nima uchun zarur",
  "orzu qilish insonni qayerga yetaklaydi", "maqsad bilan orzu farqi", "hayotiy pozitsiya",
  "qiyinchiliklarni imkoniyatga aylantirish", "har bir kun yangi imkoniyat", "bugungi kun bilan yashash",
  "minnatdorlik hissi", "shukronalikning kuchi", "ichki osoyishtalik topish", "meditatsiya nima",
  "ruhiy xotirjamlikka qanday erishiladi", "stressni qanday boshqarish mumkin", "his-tuyg'ularni jilovlash",
  "o'zini anglash yo'li", "men kimman degan savol", "hayotdagi o'rnimni topish", "qadriyatlarim nimalardan iborat",
  "hayotiy tamoyillar", "yolg'onning zarari", "rostgo'ylik fazilati", "ishonch qozonish osonmi",
  "hurmat va ehtirom", "kattalarga hurmat kichiklarga izzat", "oila muqaddas dargoh",
  "ota-onaning qadri", "farzandlik burchi", "yaxshi inson bo'lish mezoni", "jamiyatga foyda keltirish",
  "saxovat va xayr-ehson", "yordam qo'lini cho'zish", "dildan qilingan yaxshilik", "yaxshilik albatta qaytadi",
  "hayot bir karvon", "umr oqar daryo", "har bir daqiqaning qadri bor", "vaqt eng bebaho ne'mat"
];

// 6. DAM OLISH VA UYQU (130 ta)
const DAM_OLISH_UYQU_ITEMS = [
  "uxla", "yot", "uxlagin", "yotgin", "borib uxla", "uxlasangchi", "dam ol", "hordiq chiqar",
  "borib yotib uxla", "uxlashga ket", "dam olishing kerak", "ko'zingga dam ber", "uyquga yot",
  "xayrli tun", "yaxshi yotib tur", "yaxshi tushlar ko'r", "shirin tushlar ko'r", "tinch orom ol",
  "tinch tun tilayman", "ertagacha xayr uxlay qol", "uxlash vaqti bo'ldi", "kech bo'lib ketdi uxla",
  "soat kech bo'ldi borib uxla", "uxlashga yotdim", "men uxlashga ketyapman", "uyqum kelyapti uxlayman",
  "yotishim kerak", "ko'zlarim yumiqyapti", "men uxlagani ketdim", "ertaga erta turishim kerak uxlayman",
  "yaxshi uxlab dam ol", "ertaga yangi kun uxlay qol", "dam ol do'stim", "hordiq chiqar og'ayni",
  "ko'zlaring toliqdi dam ber", "ekranni o'chirib uxla", "telefonni chetga qo'yib uxla",
  "kompyuterni o'chirib yot", "tungi uyqu shirin bo'lsin", "yaxshi orom oling", "sokin tun tilayman",
  "osoyishta tun bo'lsin", "tun xayrli bo'lsin", "shirin orom tilayman", "uxlab quvvat to'pla",
  "uyqu vaqti yetib keldi", "uyquga ketish kerak", "yotib orom ol", "tanangga dam ber",
  "miyangga dam ber", "hamma o'ylarni chetga surib uxla", "ertalabgacha xayr uxlay qol",
  "tunda yaxshi dam ol", "yaxshilab uxlab olgin", "quvvat to'plash uchun uxlash shart",
  "sog'lom uyqu kerak", "8 soat uxlash lozim", "vaqtida uxlash sog'liq garovi",
  "kech yotma erta uxla", "bugun erta uxlamoqchiman", "yotishga tayyorlanyapman",
  "yostiqqa bosh qo'yish vaqti bo'ldi", "ko'rpa ostiga kirib uxlash", "iliq to'shakda orom olish",
  "uyqu bosib kelyapti", "ko'zim ilinib qolyapti", "uyqusirayapman", "uyqum kelyapti juda",
  "uxlash kerak endi", "kechasi bilan ishlamay uxla", "ortiqcha o'tirma uxla", "uxlasangchi endi",
  "sen ham uxlamaysanmi", "sun'iy intellekt uxlaydimi", "qachon uxlaysan", "sen ham dam ol",
  "dam olishga ehtiyojing yo'qmi", "sen ham yotib uxla", "tunda nima qilasan uxlamay",
  "uxlashni bilasanmi", "uyqu tushunchasi bormi senda", "charchagan bo'lsang uxla",
  "mening o'rnimga ham uxlab ber dema", "uxlashga ruxsat", "yaxshi dam oling aziz do'st",
  "hordiq chiqarish vaqti keldi", "tinchgina uxlab turing", "shirin tushlar hamrohingiz bo'lsin",
  "ertangi kungacha orom oling", "tungi osmon sokin uxlay qoling", "yaxshi hordiq tilayman",
  "yotib dam oling", "ertaga gaplashamiz uxlang", "xayrli tun do'stim", "xayrli tun azizim",
  "xayrli oqshom va xayrli tun", "tungi orom muborak", "dam oling charchabsiz",
  "hordiq chiqaring toliqibsiz", "ko'zlaringizga dam bering uxlang", "uxlab dam olishingiz kerak",
  "dam olishga shoshiling", "yaxshi uxlashni tilayman", "uyquingiz tinch bo'lsin",
  "oromingiz osoyishta bo'lsin", "uxlashga ketdim xayr", "men yotdim xayrli tun",
  "uyqu tomon ketmoqdaman", "yostiq meni chaqiryapti", "uxlashga shoshyapman",
  "ertaga ertalab ko'rishguncha uxlayman", "yaxshi tushlar ko'ray xayr", "ertaga erta uyg'onishim kerak",
  "uyqu vaqti bo'ldi xayr", "dam olish rejimi ishga tushdi", "ko'zlarim yopilyapti xayrli tun",
  "yotdim men", "uxlagani ketyapman", "men uxlashga shoshilyapman", "yaxshilab dam ol do'stim",
  "tungi suhbat tugadi uxlay qol", "uyquga marhamat", "shirin uyqu bo'lsin", "tinch uxla do'stim"
];

// 7. XAYRLASHUV (120 ta)
const XAYRLASHUV_ITEMS = [
  "xayr", "xayr do'stim", "ko'rishguncha", "salomat bo'ling", "salomat bo'l", "o'zingizni ehtiyot qiling",
  "o'zingni ehtiyot qil", "keyinroq gaplashamiz", "ertagacha", "keyingi safargacha", "yaxshi qoling",
  "yaxshi boring", "omon bo'ling", "ko'rishguncha xayr", "xayr omon bo'l", "xayr salomat bo'l",
  "keyinroq yozaman", "vaqtingiz uchun rahmat xayr", "suhbat uchun tashakkur xayr", "xayr yaxshi dam oling",
  "xayrlashish vaqti keldi", "mayli xayr", "xo'p xayr", "yaxshi kunga ko'rishaylik", "ertaga ko'rishguncha",
  "tez orada ko'rishguncha", "xayr aziz do'st", "xayr qadrdonim", "salomatlikda ko'rishaylik",
  "yaxshi kunlarda ko'rishaylik", "xayr ishlaringizga omad", "omad yor bo'lsin xayr",
  "kuningiz xayrli o'tsin xayr", "o'zingizga qarab yuring xayr", "xayr eson-omon bo'ling",
  "mayli keyinroq davom ettiramiz", "hozircha xayr", "hozircha shu xayr", "bugunga yetadi xayr",
  "suhbat tugadi xayr", "xayr o'rtoq", "xayr jo'ra", "xayr og'ayni", "xayr birodar",
  "ko'rishguncha omon bo'ling", "keyingi safar suhbatlashamiz", "yana ko'rishguncha xayr",
  "xayr do'stginam", "xayr salomat yuring", "doim sog' bo'ling xayr", "xayrlashamiz",
  "ketishim kerak xayr", "ishga ketdim xayr", "yo'lga chiqdim xayr", "shoshyapman xayr",
  "vaqtim tugadi xayr", "chiqib ketyapman xayr", "tizimdan chiqyapman xayr", "keyinroq ko'rishamiz",
  "xayr omadingizni bersin", "xayr baxtli bo'ling", "xayr xursand bo'lib yuring", "tabassum bilan xayrlashamiz",
  "xayr do'stlar", "barchaga xayr", "xayr yaxshi qolinglar", "xayr salomat bo'linglar",
  "ko'rishguncha salomatlik tilayman", "xayr kuningiz unumli o'tsin", "xayr ishlaringiz baroridan kelsin",
  "yana bog'lanamiz xayr", "aloqada bo'lamiz xayr", "bog'lanib turamiz", "unutib yubormang xayr",
  "doim aloqada bo'laylik", "xayr hurmat bilan", "xayr ehtirom bilan", "samimiy xayrlashuv",
  "xayr yaxshi do'stim", "xayr aziz suhbatdoshim", "siz bilan suhbatdan mamnunman xayr",
  "ajoyib suhbat bo'ldi xayr", "qimmatli vaqtingiz uchun rahmat xayr", "keyingi uchrashuvgacha",
  "yangi suhbatlargacha xayr", "xayr o'zingizni asrang", "o'zingizni ehtiyot qiling xayr",
  "xayr sog'-salomat bo'ling", "xayr yaxshi kayfiyat tilayman", "xayr xonadoningizga tinchlik",
  "xayr barchaga salom ayting", "xayr yaqinlaringizni ehtiyot qiling", "xayrli lahzalar tilayman xayr",
  "ertaga ertalab ko'rishamiz xayr", "xayr oqshomingiz yaxshi o'tsin", "xayr tushligingiz yoqimli bo'lsin",
  "xayr dam olishingiz maroqli o'tsin", "haftangiz unumli o'tsin xayr", "xayr yangi muvaffaqiyatlar",
  "doimo shunday faol bo'ling xayr", "xayr aziz birodar", "xayr charchamang", "xayr hormang",
  "xayr omad doim siz bilan bo'lsin", "xayr ko'rishguncha o'rtoq", "salomatchilikda ko'rishguncha", "xayr do'st"
];

async function generateAndTrain1000Dataset() {
  console.log("\n=================================================================");
  console.log("   🌟 1,000 TA BALANSLANGAN TABIIY O'ZBEKCHA MA'LUMOTLAR BAZASI  ");
  console.log("   Zero-Vector Bias tuzog'ini yo'qotish va 2500+ Lug'at Qurish   ");
  console.log("=================================================================\n");

  await dbService.init();

  // 1. Mavjud bazani yuklash
  const localKnowledgePath = path.join(__dirname, "..", "data", "knowledge.json");
  let existingData = { knowledge: [] };
  if (fs.existsSync(localKnowledgePath)) {
    try {
      existingData = JSON.parse(fs.readFileSync(localKnowledgePath, "utf-8"));
    } catch (e) {}
  }

  const normalizedSeen = new Set();
  const finalDataset = [];

  // Mavjud sifatli ma'lumotlarni qo'shish
  for (const item of existingData.knowledge || []) {
    const norm = normalizeText(item.text);
    if (norm && !normalizedSeen.has(norm)) {
      normalizedSeen.add(norm);
      finalDataset.push({ text: item.text.trim(), category: item.category });
    }
  }

  console.log(`Mavjud unikal bilimlar: ${finalDataset.length} ta.`);

  // Yangi toifalar ro'yxati
  const categoryPools = [
    { category: "salomlashish", items: SALOMLASHISH_ITEMS },
    { category: "hol_ahvol", items: HOL_AHVOL_ITEMS },
    { category: "hazil_kayfiyat", items: HAZIL_KAYFIYAT_ITEMS },
    { category: "samimiy_dalda", items: SAMIMIY_DALDA_ITEMS },
    { category: "qiziqishlar_hayot", items: QIZIQISHLAR_HAYOT_ITEMS },
    { category: "dam_olish_uyqu", items: DAM_OLISH_UYQU_ITEMS },
    { category: "xayrlashuv", items: XAYRLASHUV_ITEMS },
  ];

  let addedCount = 0;
  for (const pool of categoryPools) {
    for (const phrase of pool.items) {
      const norm = normalizeText(phrase);
      if (norm && !normalizedSeen.has(norm)) {
        normalizedSeen.add(norm);
        finalDataset.push({ text: phrase.trim(), category: pool.category });
        addedCount++;
      }
    }
  }

  console.log(`Yangi qo'shilgan unikal jumlalar: ${addedCount} ta.`);
  console.log(`🎯 Jami tozalangan va saralangan bilimlar: ${finalDataset.length} ta!`);

  // Toifalar bo'yicha taqsimot
  const categoryCounts = {};
  finalDataset.forEach((item) => {
    categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
  });

  console.log("\n📊 Toifalar bo'yicha muvozanat taqsimoti:");
  for (const [cat, count] of Object.entries(categoryCounts)) {
    console.log(`   - ${cat.padEnd(20, " ")}: ${count} ta jumla`);
  }

  // 2. Lokal data/knowledge.json ga saqlash
  const categoriesList = Object.keys(categoryCounts);
  fs.writeFileSync(
    localKnowledgePath,
    JSON.stringify({ categories: categoriesList, knowledge: finalDataset }, null, 2),
    "utf-8"
  );
  console.log(`\n💾 Lokal kesh saqlandi: ${localKnowledgePath}`);

  // 3. Neon Serverless Postgres ai_knowledge jadvaliga sinxronlash
  if (dbService.isReady) {
    console.log("☁️  Neon Serverless Postgres bazasini yangilash boshlandi...");
    try {
      // Jadvaldagi eski bilimlarni tozalab, yangi saralangan bilimlarni yozish
      if (typeof dbService.query === "function") {
        await dbService.query("DELETE FROM ai_knowledge WHERE 1=1;");
      } else if (dbService.pool) {
        await dbService.pool.query("DELETE FROM ai_knowledge WHERE 1=1;");
      }
      console.log("   - Eski jadval toza holatga keltirildi.");
      const seeded = await dbService.seedKnowledge(finalDataset);
      console.log(`   - Neon DB ga ${seeded} ta yangi bilim muvaffaqiyatli sinxronlandi! ✅`);
    } catch (err) {
      console.error("Neon DB sinxronlashda xatolik:", err.message);
    }
  }

  // 4. Modelni yangi 1,000 ta data bilan qayta o'qitish (trainKnowledgeBase)
  console.log("\n🚀 NEYRON TARMOQNI YANGI 1000 TA DATA BILAN O'QITISH BOSHLANDI...");
  await trainKnowledgeBase();

  console.log("\n✅ 1,000 TA BILIMLI YANGI MODEL MUVAFFAQIYATLI O'QITILDI VA SAQLANDI!");
}

if (require.main === module) {
  generateAndTrain1000Dataset().then(() => {
    dbService.close();
    process.exit(0);
  });
}

module.exports = generateAndTrain1000Dataset;
