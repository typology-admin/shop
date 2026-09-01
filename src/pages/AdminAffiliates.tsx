import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminBar } from '../components/AdminBar.tsx';
import { useAffiliateProducts, useAffiliatePrograms } from '../hooks/useAffiliates.ts';
import { useAuth } from '../hooks/useAuth.ts';
import {
  deleteAffiliateProduct,
  earningsPerClick,
  emptyProduct,
  insertAffiliateProduct,
  PRODUCT_FIELDS,
  rankPrograms,
  starLabel,
  statusMark,
  updateAffiliateProduct,
  updateAffiliateProgram,
  type AffiliateProduct,
  type AffiliateProgram,
} from '../lib/affiliates.ts';

const PIPELINE = [
  { label: 'AWIN', note: 'network' },
  { label: 'Merchants', note: 'Nordic Nest · Connox · design-bestseller' },
  { label: 'Ingestion', note: 'feeds + taxonomy' },
  { label: 'Product DB', note: 'catalog' },
  { label: 'Knolling set', note: 'board' },
  { label: 'Deep link', note: 'click → merchant' },
];

type Draft = Omit<AffiliateProduct, 'id'>;

function programName(programs: AffiliateProgram[], id: string | null) {
  return programs.find((row) => row.id === id)?.name ?? '—';
}

export function AdminAffiliates() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { programs, setPrograms, error: programError } = useAffiliatePrograms();
  const { products, setProducts, error: productError } = useAffiliateProducts();
  const [draft, setDraft] = useState<Draft>(emptyProduct);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ranked = useMemo(() => rankPrograms(programs), [programs]);
  const hasTracked = ranked.some((row) => row.commissionEur > 0 || row.clicks > 0);
  const leader = ranked[0] ?? null;
  const awinLive = programs.filter((row) => row.network === 'awin' && row.featured);

  async function saveStats(program: AffiliateProgram, patch: Partial<AffiliateProgram>) {
    const updated = await updateAffiliateProgram(program, patch);
    setPrograms((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
  }

  function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function onSaveProduct(event: FormEvent) {
    event.preventDefault();
    if (!draft.title.trim()) return;
    setBusy(true);
    setFormError(null);
    try {
      if (editingId) {
        const updated = await updateAffiliateProduct({ ...draft, id: editingId });
        setProducts((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
        setEditingId(null);
      } else {
        const created = await insertAffiliateProduct(draft);
        setProducts((prev) => [created, ...prev]);
      }
      setDraft(emptyProduct());
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save the product.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-page">
      <AdminBar
        variant="affiliates"
        email={auth.email}
        isLocal={auth.isLocal}
        onSignOut={() => {
          void auth.signOut().then(() => navigate('/admin/login'));
        }}
      />
      <main className="affiliate-admin">
        <h1>Affiliates</h1>
        <p className="network-admin-lede">
          AWIN sits under the knolling board: merchant programs ingest products, the catalog scores
          them, and a click on the board should resolve to an AWIN deep link. Paste report numbers
          until a publisher token is connected.
        </p>
        {programError ? <p className="form-error">{programError}</p> : null}
        {productError ? <p className="form-error">{productError}</p> : null}
        {formError ? <p className="form-error">{formError}</p> : null}

        <ol className="affiliate-pipeline" aria-label="Ingestion path">
          {PIPELINE.map((step) => (
            <li key={step.label}>
              <strong>{step.label}</strong>
              <span>{step.note}</span>
            </li>
          ))}
        </ol>

        {leader ? (
          <section className="affiliate-leader" aria-live="polite">
            <p className="affiliate-kicker">{hasTracked ? 'Performing best' : 'Highest ranked'}</p>
            <h2>{leader.name}</h2>
            <p>
              {leader.commissionLabel} · {starLabel(leader.rating)} · {statusMark(leader.status)}
              {hasTracked
                ? ` · €${leader.commissionEur.toFixed(2)} · ${leader.clicks} clicks`
                : ' · no tracked sales yet — ranked by rate and rating'}
            </p>
          </section>
        ) : null}

        <p className="hint">
          AWIN core: {awinLive.map((row) => row.name).join(', ')}. Amazon, Etsy and eBay stay on
          their own APIs.
        </p>

        <div className="affiliate-table-wrap">
          <table className="affiliate-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Program</th>
                <th>Commission</th>
                <th>Fit</th>
                <th>Status</th>
                <th>Clicks</th>
                <th>Conv.</th>
                <th>€</th>
                <th>EPC</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((program, index) => (
                <tr key={program.id} className={index === 0 ? 'is-leader' : undefined}>
                  <td>{index + 1}</td>
                  <td>
                    {program.name}
                    {program.featured ? <span className="affiliate-tag">AWIN</span> : null}
                  </td>
                  <td>{program.commissionLabel}</td>
                  <td>{starLabel(program.rating)}</td>
                  <td>{statusMark(program.status)}</td>
                  <td>
                    <input
                      className="affiliate-stat"
                      inputMode="numeric"
                      value={program.clicks || ''}
                      onChange={(event) => {
                        const clicks = Number(event.target.value) || 0;
                        setPrograms((prev) =>
                          prev.map((row) => (row.id === program.id ? { ...row, clicks } : row)),
                        );
                      }}
                      onBlur={() => void saveStats(program, { clicks: program.clicks })}
                    />
                  </td>
                  <td>
                    <input
                      className="affiliate-stat"
                      inputMode="numeric"
                      value={program.conversions || ''}
                      onChange={(event) => {
                        const conversions = Number(event.target.value) || 0;
                        setPrograms((prev) =>
                          prev.map((row) => (row.id === program.id ? { ...row, conversions } : row)),
                        );
                      }}
                      onBlur={() => void saveStats(program, { conversions: program.conversions })}
                    />
                  </td>
                  <td>
                    <input
                      className="affiliate-stat"
                      inputMode="decimal"
                      value={program.commissionEur || ''}
                      onChange={(event) => {
                        const commissionEur = Number(event.target.value) || 0;
                        setPrograms((prev) =>
                          prev.map((row) => (row.id === program.id ? { ...row, commissionEur } : row)),
                        );
                      }}
                      onBlur={() => void saveStats(program, { commissionEur: program.commissionEur })}
                    />
                  </td>
                  <td>{earningsPerClick(program) ? earningsPerClick(program).toFixed(2) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form className="network-admin-form affiliate-product-form" onSubmit={(event) => void onSaveProduct(event)}>
          <h2>{editingId ? 'Edit product' : 'Catalog a product'}</h2>
          <p className="hint" style={{ marginTop: 0 }}>
            This is the intelligence layer for the board: object, scores, and the AWIN link. Place
            the cutout PNG on Shop after the record exists.
          </p>
          <label className="field">
            <span>Title</span>
            <input
              value={draft.title}
              onChange={(event) => setField('title', event.target.value)}
              placeholder="AJ table lamp"
              required
            />
          </label>
          <label className="field">
            <span>Program</span>
            <select
              value={draft.programId ?? ''}
              onChange={(event) => setField('programId', event.target.value || null)}
            >
              <option value="">Choose retailer</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
          </label>
          <div className="affiliate-field-grid">
            {PRODUCT_FIELDS.map(([key, label]) => (
              <label className="field" key={key}>
                <span>{label}</span>
                <input
                  value={draft[key]}
                  onChange={(event) => setField(key, event.target.value)}
                />
              </label>
            ))}
            <label className="field">
              <span>Price</span>
              <input
                inputMode="decimal"
                value={draft.price ?? ''}
                onChange={(event) =>
                  setField('price', event.target.value === '' ? null : Number(event.target.value))
                }
              />
            </label>
            <label className="field">
              <span>Design score</span>
              <input
                inputMode="decimal"
                value={draft.designScore ?? ''}
                onChange={(event) =>
                  setField('designScore', event.target.value === '' ? null : Number(event.target.value))
                }
              />
            </label>
            <label className="field">
              <span>Typology score</span>
              <input
                inputMode="decimal"
                value={draft.typologyScore ?? ''}
                onChange={(event) =>
                  setField(
                    'typologyScore',
                    event.target.value === '' ? null : Number(event.target.value),
                  )
                }
              />
            </label>
            <label className="field">
              <span>Affiliate value</span>
              <input
                inputMode="decimal"
                value={draft.affiliateValue ?? ''}
                onChange={(event) =>
                  setField(
                    'affiliateValue',
                    event.target.value === '' ? null : Number(event.target.value),
                  )
                }
              />
            </label>
          </div>
          <label className="field">
            <span>AWIN / affiliate URL</span>
            <input
              type="url"
              value={draft.affiliateUrl}
              onChange={(event) => setField('affiliateUrl', event.target.value)}
              placeholder="https://"
            />
          </label>
          <div className="btn-row">
            <button className="btn" type="submit" disabled={busy || !draft.title.trim()}>
              {editingId ? 'Save product' : 'Add to catalog'}
            </button>
            {editingId ? (
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setDraft(emptyProduct());
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        {products.map((product) => (
          <article key={product.id} className="network-admin-row">
            <div>
              <strong>{product.title || 'Untitled'}</strong>
              <p className="hint" style={{ margin: '4px 0 0' }}>
                {programName(programs, product.programId)}
                {product.brand ? ` · ${product.brand}` : ''}
                {product.object ? ` · ${product.object}` : ''}
                {product.price != null ? ` · ${product.price} ${product.currency}` : ''}
                {product.typologyScore != null ? ` · typology ${product.typologyScore}` : ''}
                {product.boardItemId ? ' · on board' : ''}
              </p>
            </div>
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setEditingId(product.id);
                  const { id: _id, ...rest } = product;
                  setDraft(rest);
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  void deleteAffiliateProduct(product).then(() => {
                    setProducts((prev) => prev.filter((row) => row.id !== product.id));
                    if (editingId === product.id) {
                      setEditingId(null);
                      setDraft(emptyProduct());
                    }
                  });
                }}
              >
                Remove
              </button>
            </div>
          </article>
        ))}
      </main>
    </div>
  );
}
