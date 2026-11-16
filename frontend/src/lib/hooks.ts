"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { Category } from "./types";

/** Minimal data hook: fetch on mount / when the path changes, with reload(). */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);

  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      setData(await api<T>(path));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}

let categoryCache: Promise<Category[]> | null = null;

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  useEffect(() => {
    categoryCache ??= api<Category[]>("/api/categories").catch((e) => {
      categoryCache = null;
      throw e;
    });
    categoryCache.then(setCategories).catch(() => setCategories([]));
  }, []);
  return categories;
}
