import { readFileSync } from 'node:fs';

const imageContentTypes: Record<string, string> = {
  avif: 'image/avif',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/** 静态端点输出一张生成输入中的图片；类型取自公开文件名的扩展名。 */
export function imageResponse(file: string, filename: string): Response {
  const extension = filename.split('.').at(-1)?.toLowerCase() ?? '';
  return new Response(readFileSync(file), {
    headers: {
      'Content-Type': imageContentTypes[extension] ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
