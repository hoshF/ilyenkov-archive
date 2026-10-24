/**
 * 由端点生成的图片地址：文章插图、伊里因科夫照片与研究者照片。构建产物里它们是真实文件；
 * 开发服务器却对端点也套用 trailingSlash: 'always'，不带斜杠的图片地址会 404。
 * public/ 下的静态图片不在此列，开发服务器本来就能直接返回。
 */
const generatedImagePath = /^\/(?:archive\/[a-z0-9-]+\/media\/[^/]+|ilyenkov\/portrait|research\/researchers\/[a-z0-9-]+\/portrait)\.(?:avif|gif|jpe?g|png|webp)$/i;

export function isGeneratedImagePath(path) {
  return generatedImagePath.test(path);
}
