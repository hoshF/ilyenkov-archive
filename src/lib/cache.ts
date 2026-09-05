/** 生产构建里每份数据只从磁盘读一次；dev 与测试每次重读，改动立即生效。 */
export function buildCache<T>(load: () => T): () => T {
  let cached: T | undefined;

  return () => {
    if (!import.meta.env.PROD) return load();
    cached ??= load();
    return cached;
  };
}
