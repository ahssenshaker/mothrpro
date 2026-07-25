export type Lang = 'ar' | 'en'

const T = {
  appName:         { ar: 'مؤثر برو',                   en: 'Moather Pro' },
  login:           { ar: 'تسجيل الدخول',                en: 'Sign In' },
  register:        { ar: 'إنشاء حساب',                  en: 'Create Account' },
  email:           { ar: 'البريد الإلكتروني',            en: 'Email' },
  password:        { ar: 'كلمة المرور',                  en: 'Password' },
  noAccount:       { ar: 'ليس لديك حساب؟',              en: "Don't have an account?" },
  hasAccount:      { ar: 'لديك حساب بالفعل؟',           en: 'Already have an account?' },
  signupBtn:       { ar: 'إنشاء حساب',                  en: 'Create Account' },
  loginBtn:        { ar: 'تسجيل الدخول',                en: 'Sign In' },
  logout:          { ar: 'تسجيل الخروج',                en: 'Sign Out' },
  home:            { ar: 'المؤثرون',                     en: 'Influencers' },
  profile:         { ar: 'حسابي',                        en: 'My Account' },
  search:          { ar: 'ابحث عن مؤثر...',              en: 'Search influencers...' },
  filter:          { ar: 'تصفية',                        en: 'Filter' },
  noResults:       { ar: 'لا توجد نتائج',               en: 'No results' },
  loadMore:        { ar: 'تحميل المزيد',                 en: 'Load More' },
  free:            { ar: 'مجاني',                        en: 'Free' },
  pro:             { ar: 'برو',                          en: 'Pro' },
  trial:           { ar: 'تجريبي',                       en: 'Trial' },
  admin:           { ar: 'مدير',                         en: 'Admin' },
  upgrade:         { ar: 'ترقية للبرو',                  en: 'Upgrade to Pro' },
  upgradeDesc:     { ar: 'احصل على بيانات كاملة لجميع المؤثرين', en: 'Unlock full data for all influencers' },
  saPerMonth:      { ar: '39 ر.س / شهر',                en: '39 SAR / month' },
  followers:       { ar: 'متابع',                        en: 'followers' },
  engagement:      { ar: 'معدل التفاعل',                 en: 'Engagement Rate' },
  pricing:         { ar: 'الأسعار',                      en: 'Pricing' },
  story:           { ar: 'ستوري',                        en: 'Story' },
  post:            { ar: 'بوست',                         en: 'Post' },
  reel:            { ar: 'ريل',                          en: 'Reel' },
  video:           { ar: 'فيديو',                        en: 'Video' },
  verified:        { ar: 'موثّق',                        en: 'Verified' },
  categories:      { ar: 'التخصصات',                    en: 'Categories' },
  regions:         { ar: 'المناطق',                      en: 'Regions' },
  tags:            { ar: 'الوسوم',                       en: 'Tags' },
  avgLikes:        { ar: 'متوسط الإعجابات',               en: 'Avg Likes' },
  avgComments:     { ar: 'متوسط التعليقات',               en: 'Avg Comments' },
  postsPerWeek:    { ar: 'بوستات/أسبوع',                 en: 'Posts/Week' },
  audience:        { ar: 'الجمهور',                      en: 'Audience' },
  male:            { ar: 'ذكور',                         en: 'Male' },
  female:          { ar: 'إناث',                         en: 'Female' },
  plan:            { ar: 'الاشتراك',                     en: 'Subscription' },
  memberSince:     { ar: 'عضو منذ',                      en: 'Member since' },
  expiresOn:       { ar: 'تنتهي في',                     en: 'Expires on' },
  all:             { ar: 'الكل',                         en: 'All' },
  tier:            { ar: 'الفئة',                        en: 'Tier' },
  platform:        { ar: 'المنصة',                       en: 'Platform' },
  sort:            { ar: 'الترتيب',                      en: 'Sort' },
  sortRank:        { ar: 'حسب الترتيب',                  en: 'By Rank' },
  sortFollowers:   { ar: 'حسب المتابعين',                en: 'By Followers' },
  sortEngagement:  { ar: 'حسب التفاعل',                  en: 'By Engagement' },
  reset:           { ar: 'إعادة تعيين',                  en: 'Reset' },
  apply:           { ar: 'تطبيق',                        en: 'Apply' },
  close:           { ar: 'إغلاق',                        en: 'Close' },
  bio:             { ar: 'نبذة',                         en: 'About' },
  proRequired:     { ar: 'يتطلب اشتراك برو',             en: 'Requires Pro subscription' },
  loading:         { ar: 'جاري التحميل...',               en: 'Loading...' },
  error:           { ar: 'حدث خطأ',                      en: 'An error occurred' },
  retry:           { ar: 'إعادة المحاولة',                en: 'Retry' },
  viewProfile:     { ar: 'عرض الملف الشخصي',             en: 'View Profile' },
  gender:          { ar: 'الجنس',                        en: 'Gender' },
  maleOption:      { ar: 'ذكر',                          en: 'Male' },
  femaleOption:    { ar: 'أنثى',                         en: 'Female' },
  profileUrl:      { ar: 'الملف الشخصي',                 en: 'Profile URL' },
  subscriptionDetails: { ar: 'تفاصيل الاشتراك',         en: 'Subscription Details' },
  trialEnds:       { ar: 'ينتهي التجريبي',               en: 'Trial ends' },
  nano:            { ar: 'نانو',                         en: 'Nano' },
  micro:           { ar: 'ميكرو',                        en: 'Micro' },
  macro:           { ar: 'ماكرو',                        en: 'Macro' },
  mega:            { ar: 'ميجا',                         en: 'Mega' },
  alpha:           { ar: 'ألفا',                         en: 'Alpha' },
} as const

let _lang: Lang = 'ar'

export function setLang(lang: Lang) {
  _lang = lang
}

export function getLang(): Lang {
  return _lang
}

export function t(key: keyof typeof T): string {
  return T[key][_lang]
}

export function tf(obj: Record<string, any>, field: string): string {
  if (_lang === 'en' && obj[`${field}_en`]) return obj[`${field}_en`]
  return obj[field] || ''
}

export function tfList(obj: Record<string, any>, field: string): string[] {
  if (_lang === 'en' && obj[`${field}_en`]?.length) return obj[`${field}_en`]
  return obj[field] || []
}
