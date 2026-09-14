import { useId, useState } from 'react';
import type { Room } from '../types';
import { resolveMediaUrl } from '../lib/media';
import { Button, Field, TextArea } from './ui';
import { CloseIcon, PlusIcon } from './icons';

export function emptyRoom(): Room {
  return { slug: '', img: '', thumb: '', area: '', name: { es: '', en: '' }, tag: { es: '', en: '' }, blurb: { es: '', en: '' }, features: [] };
}

// Foto -> Cloudinary: una sola subida, la miniatura se deriva de la URL (ver lib/cloudinary.ts)
// así que acá solo hace falta UN botón por room, no dos slots separados como se había pensado
// al planear esto — Cloudinary ya resuelve el recorte, no tiene sentido pedirle dos archivos
// al dueño para el mismo ambiente.
function RoomPhotoField({ room, uploading, onUpload }: { room: Room; uploading: boolean; onUpload: (file: File) => void }) {
  const inputId = useId();
  return (
    <div className="flex items-center gap-3">
      {room.thumb ? (
        <img src={resolveMediaUrl(room.thumb)} alt="" className="h-16 w-24 shrink-0 rounded-lg border border-line object-cover" />
      ) : (
        <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-line text-[10px] text-muted">Sin foto</div>
      )}
      <label
        htmlFor={inputId}
        className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-line px-3.5 py-2 text-xs font-bold text-ink transition hover:border-gold hover:text-gold-dark"
      >
        {uploading ? 'Subiendo...' : room.img ? 'Cambiar foto' : 'Subir foto'}
      </label>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={uploading}
        onChange={(e) => { const file = e.target.files?.[0]; if (file) onUpload(file); e.target.value = ''; }}
      />
    </div>
  );
}

function RoomEditor({
  room, index, uploading, onChange, onUpload, onRemove, onMove, canMoveUp, canMoveDown,
}: {
  room: Room; index: number; uploading: boolean;
  onChange: (patch: Partial<Room>) => void;
  onUpload: (file: File) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  canMoveUp: boolean; canMoveDown: boolean;
}) {
  function setBilingual(field: 'name' | 'tag' | 'blurb', lang: 'es' | 'en', value: string) {
    onChange({ [field]: { ...room[field], [lang]: value } });
  }
  function setFeature(i: number, lang: 'es' | 'en', value: string) {
    const features = [...room.features];
    features[i] = { ...features[i], [lang]: value };
    onChange({ features });
  }
  function addFeature() { onChange({ features: [...room.features, { es: '', en: '' }] }); }
  function removeFeature(i: number) { onChange({ features: room.features.filter((_, fi) => fi !== i) }); }

  // Solo decide abierto/cerrado UNA VEZ al montar (useState con inicializador, no un `open`
  // atado directo a room.slug) — room es un objeto nuevo en cada tecla que se escribe (mismo
  // patrón inmutable del resto del editor), así que un `open={!room.slug}` recalculado en cada
  // render competía con el toggle nativo del navegador y terminaba abriendo/cerrando rooms al
  // azar mientras se escribía en OTRO room. Bug real encontrado probando esto en vivo.
  const [wasOpen] = useState(() => !room.slug);

  return (
    <details className="group rounded-xl border border-line" open={wasOpen}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
        {room.thumb
          ? <img src={resolveMediaUrl(room.thumb)} alt="" className="h-10 w-14 shrink-0 rounded-md object-cover" />
          : <div className="h-10 w-14 shrink-0 rounded-md border border-dashed border-line" />}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{room.name.es || 'Ambiente sin nombre'}</span>
        <span className="shrink-0 text-xs text-muted">{room.tag.es}</span>
      </summary>
      <div className="space-y-3 border-t border-line p-4">
        <RoomPhotoField room={room} uploading={uploading} onUpload={onUpload} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombre (ES)" value={room.name.es} onChange={(e) => setBilingual('name', 'es', e.target.value)} />
          <Field label="Name (EN)" value={room.name.en} onChange={(e) => setBilingual('name', 'en', e.target.value)} />
          <Field label="Etiqueta (ES)" value={room.tag.es} onChange={(e) => setBilingual('tag', 'es', e.target.value)} placeholder="Zona social" />
          <Field label="Tag (EN)" value={room.tag.en} onChange={(e) => setBilingual('tag', 'en', e.target.value)} placeholder="Social zone" />
        </div>
        <Field label="Área (texto libre)" value={room.area} onChange={(e) => onChange({ area: e.target.value })} placeholder="14 m² aprox." />
        <div className="grid grid-cols-2 gap-3">
          <TextArea label="Descripción (ES)" rows={2} value={room.blurb.es} onChange={(e) => setBilingual('blurb', 'es', e.target.value)} />
          <TextArea label="Description (EN)" rows={2} value={room.blurb.en} onChange={(e) => setBilingual('blurb', 'en', e.target.value)} />
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-ink/80">Características</span>
          <div className="space-y-2">
            {room.features.map((feat, fi) => (
              <div key={fi} className="flex gap-2">
                <input value={feat.es} onChange={(e) => setFeature(fi, 'es', e.target.value)} placeholder="ES" className="w-full rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm outline-none focus:border-gold focus:ring-4 focus:ring-gold/15" />
                <input value={feat.en} onChange={(e) => setFeature(fi, 'en', e.target.value)} placeholder="EN" className="w-full rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm outline-none focus:border-gold focus:ring-4 focus:ring-gold/15" />
                <button type="button" onClick={() => removeFeature(fi)} aria-label="Quitar característica" className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-paper-2 hover:text-red">
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addFeature} className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-gold-dark hover:underline">
            <PlusIcon className="h-3.5 w-3.5" /> Agregar característica
          </button>
        </div>
        <div className="flex items-center justify-between border-t border-line pt-3">
          <div className="flex gap-1">
            <Button type="button" variant="ghost" onClick={() => onMove(-1)} disabled={!canMoveUp} className="px-2.5! py-1.5!">↑</Button>
            <Button type="button" variant="ghost" onClick={() => onMove(1)} disabled={!canMoveDown} className="px-2.5! py-1.5!">↓</Button>
          </div>
          <Button type="button" variant="danger" onClick={onRemove} className="px-3! py-1.5! text-xs">Quitar ambiente #{index + 1}</Button>
        </div>
      </div>
    </details>
  );
}

// Lista completa de ambientes de UN apartamento (decisión 2026-09-13: fotos/descripciones son
// por unidad, no por categoría compartida — dos apartamentos "estudio" son distribuciones
// reales distintas). Componente controlado: el padre es dueño del array `rooms`, esto solo
// ofrece los callbacks de edición.
export function RoomsEditor({
  rooms, uploadingIndex, onRoomsChange, onUpload,
}: {
  rooms: Room[];
  uploadingIndex: number | null;
  onRoomsChange: (rooms: Room[]) => void;
  onUpload: (index: number, file: File) => void;
}) {
  function updateRoom(index: number, patch: Partial<Room>) {
    const next = [...rooms];
    next[index] = { ...next[index], ...patch };
    onRoomsChange(next);
  }
  function addRoom() { onRoomsChange([...rooms, emptyRoom()]); }
  function removeRoom(index: number) { onRoomsChange(rooms.filter((_, i) => i !== index)); }
  function moveRoom(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= rooms.length) return;
    const next = [...rooms];
    [next[index], next[target]] = [next[target], next[index]];
    onRoomsChange(next);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted">Ambientes / fotos ({rooms.length})</h3>
        <Button type="button" variant="ghost" onClick={addRoom} className="px-3! py-1.5! text-xs">
          <PlusIcon className="h-3.5 w-3.5" /> Agregar ambiente
        </Button>
      </div>
      <div className="space-y-2">
        {rooms.map((room, i) => (
          <RoomEditor
            key={i}
            room={room}
            index={i}
            uploading={uploadingIndex === i}
            onChange={(patch) => updateRoom(i, patch)}
            onUpload={(file) => onUpload(i, file)}
            onRemove={() => removeRoom(i)}
            onMove={(dir) => moveRoom(i, dir)}
            canMoveUp={i > 0}
            canMoveDown={i < rooms.length - 1}
          />
        ))}
        {rooms.length === 0 && <p className="text-sm text-muted">Todavía no hay fotos de este apartamento — agrega el primer ambiente arriba.</p>}
      </div>
    </div>
  );
}
