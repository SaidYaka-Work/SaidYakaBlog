import { Locale } from './config';

export type TranslationKey =
  | 'site.title'
  | 'site.description'
  | 'nav.home'
  | 'nav.posts'
  | 'nav.tags'
  | 'nav.about'
  | 'home.greeting'
  | 'home.subtitle'
  | 'posts.title'
  | 'posts.subtitle'
  | 'posts.readMore'
  | 'posts.minRead'
  | 'posts.relatedPosts'
  | 'tags.title'
  | 'tags.subtitle'
  | 'tags.postsCount'
  | 'about.title'
  | 'about.metaTitle'
  | 'about.metaDescription'
  | 'about.subtitle'
  | 'about.intro'
  | 'about.paragraph1'
  | 'about.paragraph2'
  | 'about.paragraph3'
  | 'about.connectTitle'
  | 'about.github'
  | 'about.linkedin'
  | 'about.twitter'
  | 'sidebar.readThese';

export const translations: Record<Locale, Record<TranslationKey, string>> = {
  en: {
    'site.title': 'Said Yaka',
    'site.description': 'Exploring technology, development, and innovation',
    'nav.home': 'Home',
    'nav.posts': 'Posts',
    'nav.tags': 'Tags',
    'nav.about': 'About',
    'home.greeting': 'Hi, I\'m',
    'home.subtitle': 'Welcome to my blog',
    'posts.title': 'Blog Posts',
    'posts.subtitle': 'Exploring technology, development, and innovation',
    'posts.readMore': 'Read more',
    'posts.minRead': 'min read',
    'posts.relatedPosts': 'Read more about',
    'tags.title': 'Topics',
    'tags.subtitle': 'Explore articles by topic',
    'tags.postsCount': 'posts',
    'about.title': 'About Me',
    'about.metaTitle': 'About | Said Yaka',
    'about.metaDescription': 'Software engineer at Evertune.ai building AI-driven systems that scale.',
    'about.subtitle': 'AI Engineer & Software Developer',
    'about.intro': 'Hi, I\'m <span class="font-bold bg-gradient-primary bg-clip-text text-transparent">Said Yaka</span> — a software engineer at <a href="https://evertune.ai" target="_blank" rel="noopener noreferrer" class="text-primary-600 hover:text-accent-600 font-semibold transition-colors underline decoration-primary-300 hover:decoration-accent-400 decoration-2 underline-offset-2">Evertune.ai</a>, where I design and build AI-driven systems that scale.',
    'about.paragraph1': 'I write about AI engineering, retrieval-augmented generation (RAG), evaluation frameworks, and the practical side of getting LLMs production-ready.',
    'about.paragraph2': 'Before diving deep into AI infra, I worked across web and data stacks, and I love turning complex ideas into clean, resilient code.',
    'about.paragraph3': 'This site is where I share my notes, experiments, and lessons learned from shipping real AI features.',
    'about.connectTitle': 'Let\'s Connect',
    'about.github': 'GitHub',
    'about.linkedin': 'LinkedIn',
    'about.twitter': 'Twitter',
    'sidebar.readThese': 'Read these',
  },
  de: {
    'site.title': 'Said Yaka',
    'site.description': 'Erforschung von Technologie, Entwicklung und Innovation',
    'nav.home': 'Startseite',
    'nav.posts': 'Beiträge',
    'nav.tags': 'Themen',
    'nav.about': 'Über mich',
    'home.greeting': 'Hallo, ich bin',
    'home.subtitle': 'Willkommen auf meinem Blog',
    'posts.title': 'Blog-Beiträge',
    'posts.subtitle': 'Erforschung von Technologie, Entwicklung und Innovation',
    'posts.readMore': 'Weiterlesen',
    'posts.minRead': 'Min. Lesezeit',
    'posts.relatedPosts': 'Mehr lesen über',
    'tags.title': 'Themen',
    'tags.subtitle': 'Artikel nach Thema erkunden',
    'tags.postsCount': 'Beiträge',
    'about.title': 'Über mich',
    'about.metaTitle': 'Über mich | Said Yaka',
    'about.metaDescription': 'Software-Ingenieur bei Evertune.ai, der skalierbare KI-gesteuerte Systeme entwickelt.',
    'about.subtitle': 'KI-Ingenieur & Software-Entwickler',
    'about.intro': 'Hallo, ich bin <span class="font-bold bg-gradient-primary bg-clip-text text-transparent">Said Yaka</span> — ein Software-Ingenieur bei <a href="https://evertune.ai" target="_blank" rel="noopener noreferrer" class="text-primary-600 hover:text-accent-600 font-semibold transition-colors underline decoration-primary-300 hover:decoration-accent-400 decoration-2 underline-offset-2">Evertune.ai</a>, wo ich skalierbare KI-gesteuerte Systeme entwerfe und entwickle.',
    'about.paragraph1': 'Ich schreibe über KI-Engineering, Retrieval-Augmented Generation (RAG), Evaluierungsframeworks und die praktische Seite der Produktionsreife von LLMs.',
    'about.paragraph2': 'Bevor ich mich tief in die KI-Infrastruktur gestürzt habe, habe ich an Web- und Datenstacks gearbeitet, und ich liebe es, komplexe Ideen in sauberen, widerstandsfähigen Code zu verwandeln.',
    'about.paragraph3': 'Diese Website ist der Ort, an dem ich meine Notizen, Experimente und Lektionen teile, die ich beim Ausliefern echter KI-Funktionen gelernt habe.',
    'about.connectTitle': 'Kontakt',
    'about.github': 'GitHub',
    'about.linkedin': 'LinkedIn',
    'about.twitter': 'Twitter',
    'sidebar.readThese': 'Diese lesen',
  },
  fr: {
    'site.title': 'Said Yaka',
    'site.description': 'Explorer la technologie, le développement et l\'innovation',
    'nav.home': 'Accueil',
    'nav.posts': 'Articles',
    'nav.tags': 'Sujets',
    'nav.about': 'À propos',
    'home.greeting': 'Salut, je suis',
    'home.subtitle': 'Bienvenue sur mon blog',
    'posts.title': 'Articles de blog',
    'posts.subtitle': 'Explorer la technologie, le développement et l\'innovation',
    'posts.readMore': 'Lire la suite',
    'posts.minRead': 'min de lecture',
    'posts.relatedPosts': 'En savoir plus sur',
    'tags.title': 'Sujets',
    'tags.subtitle': 'Explorer les articles par sujet',
    'tags.postsCount': 'articles',
    'about.title': 'À propos de moi',
    'about.metaTitle': 'À propos | Said Yaka',
    'about.metaDescription': 'Ingénieur logiciel chez Evertune.ai construisant des systèmes pilotés par l\'IA qui évoluent.',
    'about.subtitle': 'Ingénieur IA & Développeur Logiciel',
    'about.intro': 'Salut, je suis <span class="font-bold bg-gradient-primary bg-clip-text text-transparent">Said Yaka</span> — un ingénieur logiciel chez <a href="https://evertune.ai" target="_blank" rel="noopener noreferrer" class="text-primary-600 hover:text-accent-600 font-semibold transition-colors underline decoration-primary-300 hover:decoration-accent-400 decoration-2 underline-offset-2">Evertune.ai</a>, où je conçois et construis des systèmes pilotés par l\'IA qui évoluent.',
    'about.paragraph1': 'J\'écris sur l\'ingénierie IA, la génération augmentée par récupération (RAG), les cadres d\'évaluation et l\'aspect pratique de la mise en production des LLM.',
    'about.paragraph2': 'Avant de plonger profondément dans l\'infrastructure IA, j\'ai travaillé sur des piles web et de données, et j\'adore transformer des idées complexes en code propre et résilient.',
    'about.paragraph3': 'Ce site est l\'endroit où je partage mes notes, expériences et leçons apprises en livrant de vraies fonctionnalités IA.',
    'about.connectTitle': 'Restons en contact',
    'about.github': 'GitHub',
    'about.linkedin': 'LinkedIn',
    'about.twitter': 'Twitter',
    'sidebar.readThese': 'Lisez ceux-ci',
  },
  tr: {
    'site.title': 'Said Yaka',
    'site.description': 'Teknoloji, geliştirme ve yeniliği keşfetmek',
    'nav.home': 'Ana Sayfa',
    'nav.posts': 'Yazılar',
    'nav.tags': 'Konular',
    'nav.about': 'Hakkımda',
    'home.greeting': 'Merhaba, ben',
    'home.subtitle': 'Bloguma hoş geldiniz',
    'posts.title': 'Blog Yazıları',
    'posts.subtitle': 'Teknoloji, geliştirme ve yeniliği keşfetmek',
    'posts.readMore': 'Devamını oku',
    'posts.minRead': 'dk okuma',
    'posts.relatedPosts': 'Hakkında daha fazla oku',
    'tags.title': 'Konular',
    'tags.subtitle': 'Makaleleri konuya göre keşfedin',
    'tags.postsCount': 'yazı',
    'about.title': 'Hakkımda',
    'about.metaTitle': 'Hakkımda | Said Yaka',
    'about.metaDescription': 'Ölçeklenebilir yapay zeka destekli sistemler geliştiren Evertune.ai\'de yazılım mühendisi.',
    'about.subtitle': 'Yapay Zeka Mühendisi & Yazılım Geliştirici',
    'about.intro': 'Merhaba, ben <span class="font-bold bg-gradient-primary bg-clip-text text-transparent">Said Yaka</span> — <a href="https://evertune.ai" target="_blank" rel="noopener noreferrer" class="text-primary-600 hover:text-accent-600 font-semibold transition-colors underline decoration-primary-300 hover:decoration-accent-400 decoration-2 underline-offset-2">Evertune.ai</a>\'de ölçeklenebilir yapay zeka destekli sistemler tasarlayan ve geliştiren bir yazılım mühendisiyim.',
    'about.paragraph1': 'Yapay zeka mühendisliği, retrieval-augmented generation (RAG), değerlendirme çerçeveleri ve LLM\'leri üretime hazır hale getirmenin pratik yönleri hakkında yazıyorum.',
    'about.paragraph2': 'Yapay zeka altyapısına derinlemesine dalmadan önce, web ve veri yığınları üzerinde çalıştım ve karmaşık fikirleri temiz, dayanıklı koda dönüştürmeyi seviyorum.',
    'about.paragraph3': 'Bu site, gerçek yapay zeka özelliklerini teslim ederken öğrendiğim notlarımı, deneylerimi ve derslerimi paylaştığım yerdir.',
    'about.connectTitle': 'İletişime Geçelim',
    'about.github': 'GitHub',
    'about.linkedin': 'LinkedIn',
    'about.twitter': 'Twitter',
    'sidebar.readThese': 'Bunları okuyun',
  },
  ja: {
    'site.title': 'Said Yaka',
    'site.description': 'テクノロジー、開発、イノベーションを探求する',
    'nav.home': 'ホーム',
    'nav.posts': '投稿',
    'nav.tags': 'タグ',
    'nav.about': 'について',
    'home.greeting': 'こんにちは、私は',
    'home.subtitle': '私のブログへようこそ',
    'posts.title': 'ブログ投稿',
    'posts.subtitle': 'テクノロジー、開発、イノベーションを探求する',
    'posts.readMore': '続きを読む',
    'posts.minRead': '分で読める',
    'posts.relatedPosts': 'さらに読む',
    'tags.title': 'トピック',
    'tags.subtitle': 'トピック別に記事を探索',
    'tags.postsCount': '投稿',
    'about.title': '私について',
    'about.metaTitle': 'について | Said Yaka',
    'about.metaDescription': 'スケーラブルなAI駆動システムを構築するEvertune.aiのソフトウェアエンジニア。',
    'about.subtitle': 'AIエンジニア & ソフトウェア開発者',
    'about.intro': 'こんにちは、私は<span class="font-bold bg-gradient-primary bg-clip-text text-transparent">Said Yaka</span>です — <a href="https://evertune.ai" target="_blank" rel="noopener noreferrer" class="text-primary-600 hover:text-accent-600 font-semibold transition-colors underline decoration-primary-300 hover:decoration-accent-400 decoration-2 underline-offset-2">Evertune.ai</a>でスケーラブルなAI駆動システムを設計・構築するソフトウェアエンジニアです。',
    'about.paragraph1': 'AIエンジニアリング、検索拡張生成（RAG）、評価フレームワーク、LLMを本番環境に準備する実践的な側面について書いています。',
    'about.paragraph2': 'AIインフラに深く飛び込む前に、Webとデータスタックで働いており、複雑なアイデアをクリーンで堅牢なコードに変換することを愛しています。',
    'about.paragraph3': 'このサイトは、実際のAI機能を出荷する際に学んだノート、実験、教訓を共有する場所です。',
    'about.connectTitle': 'お問い合わせ',
    'about.github': 'GitHub',
    'about.linkedin': 'LinkedIn',
    'about.twitter': 'Twitter',
    'sidebar.readThese': 'これらを読む',
  },
};

export function getTranslation(locale: Locale, key: TranslationKey): string {
  return translations[locale][key] || translations.en[key];
}
