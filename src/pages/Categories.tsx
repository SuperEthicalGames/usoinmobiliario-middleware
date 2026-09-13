import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api, describeApiError } from '../api';
import type { Categories as CategoriesMap, Category } from '../types';
import { useAuth } from '../AuthContext';
import { AsyncSection, Card, PageHeader } from '../components/ui';
import { CategoryEditor } from '../components/CategoryEditor';
import { resolveMediaUrl } from '../lib/media';

// "Modelos" = las categorías (estudio/dos) — el texto y las fotos de cada ambiente son
// compartidos por TODAS las unidades de ese tipo (así ya funciona el sitio: "el recorrido
// 360° mostrado es representativo del modelo"), por eso viven en su propia pantalla separada
// de Apartamentos (que sigue siendo por-unidad: estado, tarifas, visibilidad).
export function Categories() {
  const { isSuperAdmin } = useAuth();
  const [data, setData] = useState<CategoriesMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ typeKey: string; category: Category } | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api.getCategories()
      .then(setData)
      .catch((err) => setError(describeApiError(err)))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  if (!isSuperAdmin) return <Navigate to="/" replace />;

  function handleSaved(typeKey: string, updated: Category) {
    setData((prev) => (prev ? { ...prev, [typeKey]: updated } : prev));
  }

  const entries = data ? Object.entries(data) : null;

  return (
    <div>
      <PageHeader
        title="Modelos"
        subtitle="Texto y fotos de cada ambiente, compartidos por todas las unidades de ese modelo — la ficha de apartamento individual sigue viviendo en Apartamentos."
      />
      <AsyncSection loading={loading} error={error} data={entries} empty="No hay modelos configurados." onRetry={load}>
        {(rows) => (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {rows.map(([typeKey, cat]) => (
              <Card key={typeKey} className="p-5" hoverable>
                <button type="button" onClick={() => setEditing({ typeKey, category: cat })} className="flex w-full cursor-pointer gap-4 text-left">
                  {cat.rooms?.[0]?.thumb && (
                    <img src={resolveMediaUrl(cat.rooms[0].thumb)} alt="" className="h-20 w-28 shrink-0 rounded-xl object-cover" />
                  )}
                  <div className="min-w-0">
                    <div className="font-display text-lg font-semibold text-ink">{cat.catLabel.es}</div>
                    <div className="mt-0.5 text-sm text-muted">{cat.name.es}</div>
                    <div className="mt-2 text-xs font-bold uppercase tracking-wide text-muted">
                      {cat.rooms?.length ?? 0} ambiente{cat.rooms?.length === 1 ? '' : 's'}
                    </div>
                  </div>
                </button>
              </Card>
            ))}
          </div>
        )}
      </AsyncSection>

      {editing && (
        <CategoryEditor
          typeKey={editing.typeKey}
          category={editing.category}
          onClose={() => setEditing(null)}
          onSaved={(updated) => { handleSaved(editing.typeKey, updated); setEditing(null); }}
        />
      )}
    </div>
  );
}
