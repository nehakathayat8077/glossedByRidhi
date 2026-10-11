import { useEffect, useState } from 'react';

export function useCatalogData(fetchData, fallbackData, catalogName) {
  const [items, setItems] = useState(fallbackData);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let current = true;

    const refresh = () => fetchData()
      .then((records) => {
        if (current) setItems(records);
      })
      .catch((error) => {
        console.error(`Unable to load ${catalogName} from Supabase.`, error);
        if (current) setItems(fallbackData);
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    const handleCatalogChange = () => {
      if (current) {
        setLoading(true);
        refresh();
      }
    };

    window.addEventListener('admin:catalog-changed', handleCatalogChange);
    refresh();

    return () => {
      current = false;
      window.removeEventListener('admin:catalog-changed', handleCatalogChange);
    };
  }, [fetchData, fallbackData, catalogName]);

  return { items, loading };
}
