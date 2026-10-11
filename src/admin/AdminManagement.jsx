import { useCallback, useEffect, useMemo, useState } from 'react';
import { ImagePlus, Pencil, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { cats, designs as designFallbacks, products as productFallbacks } from '../data/data';
import { supabase } from '../lib/supabaseClient';
import { notifyCatalogChanged } from '../lib/catalogLoaders';
import { useAdminNotice } from './AdminLayout';

const configurations = {
  designs: {
    table: 'designs',
    title: 'Nail designs',
    singular: 'design',
    folder: 'designs',
    nameColumn: 'title',
    fields: [
      { name: 'title', label: 'Design name', required: true },
      { name: 'category', label: 'Category', type: 'select', options: cats.filter((category) => category !== 'All'), required: true },
      { name: 'image_url', label: 'Image URL', type: 'url' },
      { name: 'is_active', label: 'Visible on website', type: 'checkbox', defaultValue: true },
    ],
    fallbackRecords: designFallbacks,
  },
  services: {
    table: 'services',
    title: 'Services',
    singular: 'service',
    folder: 'services',
    nameColumn: 'name',
    fields: [
      { name: 'name', label: 'Service name', required: true },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'price', label: 'Price (₹)', type: 'number', min: 0, required: true },
      { name: 'duration_minutes', label: 'Duration (minutes)', type: 'number', min: 1 },
      { name: 'image_url', label: 'Image URL', type: 'url' },
      { name: 'is_active', label: 'Visible on website', type: 'checkbox', defaultValue: true },
    ],
    fallbackRecords: [],
  },
  products: {
    table: 'products',
    title: 'Products & inventory',
    singular: 'product',
    folder: 'products',
    nameColumn: 'name',
    fields: [
      { name: 'name', label: 'Product name', required: true },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'price', label: 'Price (₹)', type: 'number', min: 0, required: true },
      { name: 'discount_percent', label: 'Discount (%)', type: 'number', min: 0, max: 100 },
      { name: 'stock', label: 'Stock quantity', type: 'number', min: 0 },
      { name: 'image_url', label: 'Image URL', type: 'url' },
      { name: 'is_active', label: 'Available on website', type: 'checkbox', defaultValue: true },
    ],
    fallbackRecords: productFallbacks,
  },
};

const initialForm = (config) => Object.fromEntries(
  config.fields.map((field) => [field.name, field.defaultValue ?? (field.type === 'checkbox' ? false : '')]),
);

function fieldValue(config, record, name) {
  if (config.table === 'designs') {
    const fallback = config.fallbackRecords.find((item) => item.name === record.title);
    if (name === 'image_url') return record.image_url ?? fallback?.image_url ?? '';
  }
  return record[name] ?? '';
}

function validate(config, values) {
  for (const field of config.fields) {
    const value = values[field.name];
    if (field.required && (value === '' || value == null)) return `${field.label} is required.`;
    if (field.type === 'number' && value !== '' && value != null) {
      const numericValue = Number(value);
      if (!Number.isFinite(numericValue) || (field.min != null && numericValue < field.min)) {
        return `${field.label} must be ${field.min == null ? 'a valid number' : `at least ${field.min}`}.`;
      }
      if (field.max != null && numericValue > field.max) {
        return `${field.label} must be no more than ${field.max}.`;
      }
      if (['stock', 'duration_minutes'].includes(field.name) && !Number.isInteger(numericValue)) {
        return `${field.label} must be a whole number.`;
      }
    }
  }
  return '';
}

function RecordForm({ config, record, onClose, onSaved }) {
  const [values, setValues] = useState(() => {
    const defaults = initialForm(config);
    if (!record) return defaults;
    return Object.fromEntries(
      config.fields.map((field) => [field.name, fieldValue(config, record, field.name) ?? defaults[field.name]]),
    );
  });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreview('');
      return undefined;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const setValue = (name, value) => setValues((current) => ({ ...current, [name]: value }));

  const submit = async (event) => {
    event.preventDefault();
    const validationError = validate(config, values);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (file && (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024)) {
      setError('Choose an image file smaller than 5 MB.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {};
      for (const field of config.fields) {
        const value = values[field.name];
        payload[field.name] = field.type === 'number'
          ? value === '' ? null : Number(value)
          : field.type === 'checkbox' ? Boolean(value) : value === '' ? null : value;
      }

      if (file) {
        const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        const objectPath = `${config.folder}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from('images').upload(objectPath, file, {
          contentType: file.type,
          upsert: false,
        });
        if (uploadError) throw uploadError;
        payload.image_url = supabase.storage.from('images').getPublicUrl(objectPath).data.publicUrl;
      }

      const request = record
        ? supabase.from(config.table).update(payload).eq('id', record.id)
        : supabase.from(config.table).insert(payload);
      const { error: saveError } = await request;
      if (saveError) throw saveError;

      await notifyCatalogChanged();
      await onSaved();
    } catch (saveError) {
      setError(saveError.message || 'Could not save this record.');
    } finally {
      setSaving(false);
    }
  };

  const imageUrl = preview || values.image_url;

  return (
    <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <form className="admin-modal admin-record-form" onSubmit={submit}>
        <div className="admin-modal-heading">
          <div><span className="admin-eyebrow">{record ? 'EDIT RECORD' : 'NEW RECORD'}</span><h2>{record ? `Edit ${config.singular}` : `Add ${config.singular}`}</h2></div>
          <button type="button" className="admin-icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>

        <div className="admin-form-grid">
          {config.fields.map((field) => (
            field.type === 'checkbox' ? (
              <label className="admin-checkbox-field" key={field.name}>
                <input type="checkbox" checked={Boolean(values[field.name])} onChange={(event) => setValue(field.name, event.target.checked)} />
                <span>{field.label}</span>
              </label>
            ) : (
              <label className={`admin-field${field.type === 'textarea' ? ' full' : ''}`} key={field.name}>
                {field.label}
                {field.type === 'textarea' ? (
                  <textarea rows="3" value={values[field.name]} onChange={(event) => setValue(field.name, event.target.value)} required={field.required} />
                ) : field.type === 'select' ? (
                  <select value={values[field.name]} onChange={(event) => setValue(field.name, event.target.value)} required={field.required}>
                    <option value="">Choose a category</option>
                    {field.options.map((option) => <option key={option}>{option}</option>)}
                  </select>
                ) : (
                  <input
                    type={field.type || 'text'}
                    value={values[field.name]}
                    onChange={(event) => setValue(field.name, event.target.value)}
                    min={field.min}
                    max={field.max}
                    step={field.type === 'number' && field.name === 'price' ? '0.01' : '1'}
                    required={field.required}
                  />
                )}
              </label>
            )
          ))}
        </div>

        <div className="admin-upload-box">
          {imageUrl ? (
            <img src={imageUrl} alt="Selected product or service preview" />
          ) : <span className="admin-upload-placeholder"><ImagePlus size={24} />Choose an image</span>}
          <label className="admin-upload-button">
            <Upload size={16} /> Upload image
            <input type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          </label>
          <p>Uploads to the public images/{config.folder}/ folder. Maximum 5 MB.</p>
        </div>

        {error && <p className="admin-error" role="alert">{error}</p>}
        <div className="admin-modal-actions">
          <button type="button" className="admin-secondary-button" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={saving}>{saving ? 'Saving…' : record ? 'Save changes' : `Add ${config.singular}`}</button>
        </div>
      </form>
    </div>
  );
}

export default function AdminManagement({ type }) {
  const config = configurations[type];
  const notify = useAdminNotice();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const pageSize = 10;

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: loadError } = await supabase
      .from(config.table)
      .select('*')
      .order(config.nameColumn, { ascending: true });
    if (loadError) {
      setError(loadError.message);
      setRecords([]);
    } else {
      setRecords(data || []);
    }
    setLoading(false);
  }, [config]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const visibleRecords = useMemo(() => {
    const term = query.trim().toLowerCase();
    return records
      .filter((record) => {
        const matchesQuery = !term || [
          record[config.nameColumn],
          record.description,
          record.category,
        ].some((value) => String(value || '').toLowerCase().includes(term));
        const matchesActive = activeFilter === 'all'
          || String(Boolean(record.is_active)) === activeFilter;
        return matchesQuery && matchesActive;
      })
      .sort((a, b) => sort === 'newest'
        ? String(b.created_at || '').localeCompare(String(a.created_at || ''))
        : String(a[config.nameColumn] || '').localeCompare(String(b[config.nameColumn] || '')));
  }, [records, query, activeFilter, sort, config]);

  const pageCount = Math.max(1, Math.ceil(visibleRecords.length / pageSize));
  const currentRecords = visibleRecords.slice(page * pageSize, (page + 1) * pageSize);

  const closeForm = () => { setEditing(null); setAdding(false); };

  const saved = async () => {
    closeForm();
    await loadRecords();
    notify(`${config.singular[0].toUpperCase()}${config.singular.slice(1)} saved successfully.`);
  };

  const toggleActive = async (record) => {
    const { error: updateError } = await supabase
      .from(config.table)
      .update({ is_active: !record.is_active })
      .eq('id', record.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await notifyCatalogChanged();
    await loadRecords();
    notify(`${config.singular} ${record.is_active ? 'deactivated' : 'activated'}.`);
  };

  const removeRecord = async (record) => {
    const label = record[config.nameColumn];
    if (type === 'products') {
      const { count, error: orderError } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true });
      if (orderError) {
        setError(`Could not check for existing orders: ${orderError.message}`);
        return;
      }
      const warning = count
        ? `There ${count === 1 ? 'is' : 'are'} ${count} existing order${count === 1 ? '' : 's'}. Order records retain their item snapshots, but please verify order history before deleting "${label}".`
        : `Delete "${label}"? This cannot be undone.`;
      if (!window.confirm(warning)) return;
    } else if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) {
      return;
    }

    const { error: deleteError } = await supabase.from(config.table).delete().eq('id', record.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    await notifyCatalogChanged();
    await loadRecords();
    notify(`${config.singular} deleted.`);
  };

  return (
    <section className="admin-page">
      <div className="admin-page-intro admin-management-intro">
        <div><span className="admin-eyebrow">YOUR CATALOG</span><h2>Manage {config.title.toLowerCase()}</h2></div>
        <button className="btn admin-add-button" onClick={() => setAdding(true)}><Plus size={17} /> Add {config.singular}</button>
      </div>

      <div className="admin-toolbar">
        <label className="admin-search"><Search size={17} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder={`Search ${config.title.toLowerCase()}`} /></label>
        <select className="admin-filter" value={activeFilter} onChange={(event) => { setActiveFilter(event.target.value); setPage(0); }}>
          <option value="all">All availability</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <select className="admin-filter" value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="name">Name A–Z</option>
          <option value="newest">Recently added</option>
        </select>
      </div>

      {error && <div className="admin-alert" role="alert">{error}</div>}
      <div className="admin-panel admin-table-panel">
        {loading ? <p className="admin-state">Loading {config.title.toLowerCase()}…</p> : currentRecords.length === 0 ? (
          <p className="admin-empty">{records.length ? 'No records match those filters.' : `No ${config.title.toLowerCase()} yet. Add your first one to get started.`}</p>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead><tr>
                <th>{config.singular}</th>
                {type === 'designs' && <th>Category</th>}
                {type !== 'designs' && <th>Price</th>}
                {type === 'products' && <th>Stock</th>}
                {type === 'services' && <th>Duration</th>}
                <th>Status</th><th><span className="sr-only">Actions</span></th>
              </tr></thead>
              <tbody>
                {currentRecords.map((record) => (
                  <tr key={record.id}>
                    <td><strong>{record[config.nameColumn]}</strong>{record.description && <small>{record.description}</small>}</td>
                    {type === 'designs' && <td>{record.category}</td>}
                    {type !== 'designs' && <td>₹{Number(record.price).toLocaleString('en-IN')}</td>}
                    {type === 'products' && <td>{record.stock ?? '—'}</td>}
                    {type === 'services' && <td>{record.duration_minutes ? `${record.duration_minutes} min` : '—'}</td>}
                    <td><span className={`admin-badge ${record.is_active ? 'status-confirmed' : 'status-cancelled'}`}>{record.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td><div className="admin-row-actions">
                      <button className="admin-icon-button" onClick={() => setEditing(record)} aria-label={`Edit ${record[config.nameColumn]}`}><Pencil size={16} /></button>
                      <button className="admin-icon-button" onClick={() => toggleActive(record)} aria-label={`${record.is_active ? 'Deactivate' : 'Activate'} ${record[config.nameColumn]}`}>{record.is_active ? '−' : '+'}</button>
                      <button className="admin-icon-button danger" onClick={() => removeRecord(record)} aria-label={`Delete ${record[config.nameColumn]}`}><Trash2 size={16} /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && visibleRecords.length > pageSize && (
          <div className="admin-pagination">
            <span>{page * pageSize + 1}–{Math.min((page + 1) * pageSize, visibleRecords.length)} of {visibleRecords.length}</span>
            <div><button disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</button><button disabled={page + 1 >= pageCount} onClick={() => setPage((value) => value + 1)}>Next</button></div>
          </div>
        )}
      </div>

      {(adding || editing) && (
        <RecordForm
          key={editing?.id || 'new'}
          config={config}
          record={editing}
          onClose={closeForm}
          onSaved={saved}
        />
      )}
    </section>
  );
}
