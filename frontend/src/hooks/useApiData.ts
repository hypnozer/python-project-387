import { useCallback, useEffect, useState } from "react";

export function useApiData<T>(loader: () => Promise<T>, dependencies: React.DependencyList = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loader());
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error("Неизвестная ошибка"));
    } finally {
      setLoading(false);
    }
    // The caller controls when its loader identity should invalidate the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}
