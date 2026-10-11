import { useEffect, useState } from 'react';

export function useCatalogData(fetchData, fallbackData, catalogName) {
  const [items, setItems] = useState(fallbackData);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let current = true;

    fetchData()
      .then((records) => {
        if (current) setItems(records.length ? records : fallbackData);
      })
      .catch((error) => {
        console.error(`Unable to load ${catalogName} from Supabase.`, error);
        if (current) setItems(fallbackData);
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, [fetchData, fallbackData, catalogName]);

  return { items, loading };
}
