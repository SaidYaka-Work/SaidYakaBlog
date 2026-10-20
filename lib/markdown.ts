import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkHtml from 'remark-html';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/gi, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function addHeadingIds(html: string): string {
  const used = new Map<string, number>();
  return html.replace(/<h([2-4])([^>]*)>([\s\S]*?)<\/h\1>/g, (match, level, attrs, inner) => {
    if (/\sid=/.test(attrs)) return match;
    const text = String(inner).replace(/<[^>]+>/g, '').trim();
    let id = slugify(text) || `heading-${level}`;
    const count = used.get(id) ?? 0;
    used.set(id, count + 1);
    if (count > 0) id = `${id}-${count + 1}`;
    return `<h${level}${attrs} id="${id}">${inner}</h${level}>`;
  });
}

function ensureImageAlts(html: string): string {
  return html.replace(/<img\b([^>]*)>/g, (match, attrs) => {
    if (/\balt=/.test(attrs)) return match;
    return `<img${attrs} alt="">`;
  });
}

export async function markdownToHtml(markdown: string) {
  const result = await remark()
    .use(remarkGfm)
    .use(remarkHtml, { sanitize: false })
    .process(markdown);

  return ensureImageAlts(addHeadingIds(result.toString()));
}
