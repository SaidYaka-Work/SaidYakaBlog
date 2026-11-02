export type PostHtmlChunk = { type: 'html'; html: string };
export type PostEmbedChunk = { type: 'embed'; id: string };
export type PostChunk = PostHtmlChunk | PostEmbedChunk;

const EMBED_COMMENT = /<!--\s*post-embed:([a-z0-9-]+)\s*-->/gi;

/** Split rendered post HTML on `<!--post-embed:name-->` markers so React widgets can sit inline. */
export function splitPostEmbeds(html: string): PostChunk[] {
  const chunks: PostChunk[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const pattern = new RegExp(EMBED_COMMENT.source, EMBED_COMMENT.flags);

  while ((match = pattern.exec(html))) {
    const index = match.index;
    if (index > lastIndex) {
      chunks.push({ type: 'html', html: html.slice(lastIndex, index) });
    }
    chunks.push({ type: 'embed', id: match[1] });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < html.length || chunks.length === 0) {
    chunks.push({ type: 'html', html: html.slice(lastIndex) });
  }

  return chunks;
}
