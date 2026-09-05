/**
 * 生产构建里每份数据只从磁盘读一次；dev 与测试每次重读。
 *
 * 进程内一直缓存的话，改了 editorial/ 或 .website-input/ 下的文件，dev server 会一直显示
 * 启动时读到的那一份，页面和构建产物对不上——只能重启才能看到改动。
 */
export function buildCache<T>(load: () => T): () => T {
  let cached: T | undefined;

  return () => {
    if (!import.meta.env.PROD) return load();
    cached ??= load();
    return cached;
  };
}
