import React, { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, X, Image as ImageIcon, Upload, Printer } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';
import { esc, logoRow, footer, wrapHtml, openPrint } from '../../lib/printUtils';

interface Product {
  id: string;
  name: string;
  category: string;
  use: string | null;
  description: string;
  price: number;
  unit: string;
  stock: number;
  daily_stock_cap: number | null;
  image_url: string;
  sort_order: number;
  active: boolean;
}

export const Products: React.FC = () => {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [useCategories, setUseCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Form & Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Mangoes');
  const [use, setUse] = useState<string>('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('1 kg');
  const [stock, setStock] = useState('0');
  const [sortOrder, setSortOrder] = useState('0');
  const [active, setActive] = useState(true);
  const [dailyStockCap, setDailyStockCap] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      console.error('Error fetching products:', err);
      showToast('Failed to load products list.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('categories, use_categories')
        .eq('id', 'main')
        .single();
      if (error) throw error;
      if (data) {
        if (Array.isArray(data.categories)) setCategories(data.categories);
        if (Array.isArray(data.use_categories)) setUseCategories(data.use_categories);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const handleOpenAdd = () => {
    setEditTarget(null);
    setName('');
    setCategory(categories[0] || 'Mangoes');
    setUse(useCategories[0] || '');
    setDescription('');
    setPrice('');
    setUnit('1 kg');
    setStock('0');
    setSortOrder('0');
    setActive(true);
    setDailyStockCap('');
    setImageFile(null);
    setImagePreviewUrl('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setEditTarget(product);
    setName(product.name);
    setCategory(product.category || 'Mangoes');
    setUse(product.use || useCategories[0] || '');
    setDescription(product.description || '');
    setPrice(product.price.toString());
    setUnit(product.unit);
    setStock(product.stock.toString());
    setSortOrder(product.sort_order.toString());
    setActive(product.active);
    setDailyStockCap(product.daily_stock_cap != null ? product.daily_stock_cap.toString() : '');
    setImageFile(null);
    setImagePreviewUrl(product.image_url || '');
    setIsModalOpen(true);
  };

  // Inline Active state toggle
  const handleToggleActive = async (id: string, currentVal: boolean) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ active: !currentVal })
        .eq('id', id);

      if (error) throw error;

      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, active: !currentVal } : p))
      );
      showToast(`Product set to ${!currentVal ? 'Active' : 'Inactive'}.`, 'success');
    } catch (err) {
      console.error('Toggle active error:', err);
      showToast('Failed to update product status.', 'error');
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
    }
  };

  // Upload file helper
  const uploadImage = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `products/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('chittoor-farms')
      .upload(fileName, file, { cacheControl: '3600', upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('chittoor-farms').getPublicUrl(fileName);
    return data.publicUrl;
  };

  // Submit Add/Edit form
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !price || !unit.trim() || !stock) {
      showToast('Please fill all required fields.', 'error');
      return;
    }

    setIsSaving(true);

    try {
      let finalImageUrl = imagePreviewUrl;

      // Upload image if a new one is selected
      if (imageFile) {
        finalImageUrl = await uploadImage(imageFile);
      }

      const productPayload = {
        name: name.trim(),
        category,
        use: category === 'Mangoes' ? use : null,
        description: description.trim() || null,
        price: parseFloat(price),
        unit: unit.trim(),
        stock: parseFloat(stock),
        daily_stock_cap: dailyStockCap.trim() ? parseInt(dailyStockCap) : null,
        sort_order: parseInt(sortOrder) || 0,
        active,
        image_url: finalImageUrl || null,
      };

      if (editTarget) {
        // Edit existing product
        const { error } = await supabase
          .from('products')
          .update(productPayload)
          .eq('id', editTarget.id);

        if (error) throw error;
        showToast('Product updated successfully.', 'success');
      } else {
        // Add new product
        const { error } = await supabase
          .from('products')
          .insert([productPayload]);

        if (error) throw error;
        showToast('Product created successfully.', 'success');
      }

      setIsModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      console.error('Error saving product:', err);
      showToast(err.message || 'Failed to save product details.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete handler
  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', deleteTarget.id);

      if (error) throw error;

      showToast('Product removed successfully.', 'success');
      setDeleteTarget(null);
      fetchProducts();
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Failed to delete product.', 'error');
    }
  };

  const printPriceList = () => {
    const active = products.filter((p) => p.active).sort((a, b) => a.sort_order - b.sort_order);
    const categories = [...new Set(active.map((p) => p.category))];
    const sections = categories.map((cat) => {
      const items = active.filter((p) => p.category === cat);
      const rows = items.map((p) => `
        <tr>
          <td><strong>${esc(p.name)}</strong>${p.description ? `<br><span style="font-size:0.78rem;color:#6b7280">${esc(p.description)}</span>` : ''}</td>
          <td>${esc(p.use ?? '—')}</td>
          <td style="font-weight:700;color:#17633f">₹${esc(p.price)} / ${esc(p.unit)}</td>
          <td>${p.stock > 0 ? `<span style="color:#15803d;font-weight:600">${p.stock} ${esc(p.unit.replace(/^1\s*/, ''))} in stock</span>` : '<span style="color:#dc2626">Out of stock</span>'}</td>
        </tr>`).join('');
      return `<h2>${esc(cat)}</h2>
        <table><thead><tr><th>Product</th><th>Use</th><th>Price</th><th>Availability</th></tr></thead>
        <tbody>${rows}</tbody></table>`;
    }).join('');
    const body = `
      ${logoRow('Product Price List', `Updated ${new Date().toLocaleDateString('en-IN')}`)}
      ${sections}
      <p style="margin-top:14px;font-size:0.78rem;color:#9ca3af">Prices are subject to change. Contact us at chittoorfarms.in for bulk enquiries.</p>
      ${footer()}`;
    openPrint(wrapHtml('Chittoor Farms – Price List', body));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>Manage Shop Products</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-outline" style={{ display: 'flex', gap: '0.25rem' }} onClick={printPriceList} disabled={products.filter((p) => p.active).length === 0} title="Print price list of active products">
            <Printer size={16} />
            <span>Price List</span>
          </button>
          <button className="btn btn-secondary" style={{ display: 'flex', gap: '0.25rem' }} onClick={handleOpenAdd}>
            <Plus size={16} />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          🔄 Loading product catalog...
        </div>
      ) : products.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          No products listed yet. Click "Add Product" to create one.
        </div>
      ) : (
        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Product Name</th>
                <th>Category (Use)</th>
                <th>Price / Unit</th>
                <th>Stock · Daily Cap</th>
                <th style={{ width: '100px' }}>Active</th>
                <th>Sort Order</th>
                <th style={{ width: '120px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  {/* Image Thumbnail */}
                  <td>
                    <img
                      src={product.image_url || 'https://images.unsplash.com/photo-1553135933-0d13db7f0ece?auto=format&fit=crop&q=80&w=150'}
                      alt={product.name}
                      style={{ width: '50px', height: '50px', borderRadius: 'var(--radius-sm)', objectFit: 'cover', background: 'var(--bg-muted)' }}
                    />
                  </td>

                  {/* Name */}
                  <td style={{ fontWeight: 600 }}>{product.name}</td>

                  {/* Category */}
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <span style={{ fontWeight: 600 }}>{product.category}</span>
                      {product.category === 'Mangoes' && product.use && (
                        <span className={`badge badge-${product.use}`} style={{ alignSelf: 'flex-start', fontSize: '0.7rem' }}>
                          {product.use}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Price */}
                  <td style={{ fontWeight: 600 }}>₹{product.price} / {product.unit}</td>

                  {/* Stock · Daily Cap */}
                  <td>
                    <span style={{ fontWeight: 700, color: product.stock === 0 ? 'var(--danger)' : product.stock <= 5 ? 'var(--warning)' : 'var(--success)' }}>
                      {product.stock} {product.unit.split(' ').pop()}
                    </span>
                    {product.daily_stock_cap != null && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        Cap: {product.daily_stock_cap} / day
                      </div>
                    )}
                  </td>

                  {/* Active Toggle switch */}
                  <td>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={product.active}
                        onChange={() => handleToggleActive(product.id, product.active)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </td>

                  {/* Sort Order */}
                  <td style={{ paddingLeft: '2rem' }}>{product.sort_order}</td>

                  {/* Actions */}
                  <td>
                    <div className="admin-table-actions">
                      <button
                        className="btn btn-outline btn-icon"
                        style={{ width: '32px', height: '32px' }}
                        onClick={() => handleOpenEdit(product)}
                        title="Edit Product"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        className="btn btn-outline btn-icon"
                        style={{ width: '32px', height: '32px', color: 'var(--danger)', borderColor: 'var(--border-color)' }}
                        onClick={() => setDeleteTarget(product)}
                        title="Delete Product"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="modal-backdrop open" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editTarget ? 'Edit Mango Variety' : 'Add Mango Variety'}</h3>
              <button className="btn-icon" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveProduct}>
              <div className="modal-body">
                {/* Image Upload Area */}
                <div className="form-group">
                  <label>Product Photo</label>
                  <label htmlFor="productImageFile">
                    <div
                      className="image-upload-preview"
                      style={{
                        backgroundImage: imagePreviewUrl ? `url(${imagePreviewUrl})` : 'none',
                      }}
                    >
                      {!imagePreviewUrl && (
                        <>
                          <ImageIcon size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Click to upload cover photo</span>
                        </>
                      )}
                      {imagePreviewUrl && (
                        <div className="image-upload-overlay">
                          <Upload size={20} style={{ marginRight: '0.25rem' }} />
                          <span>Change Photo</span>
                        </div>
                      )}
                    </div>
                  </label>
                  <input
                    type="file"
                    id="productImageFile"
                    accept="image/*"
                    onChange={handleImageChange}
                    style={{ display: 'none' }}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="prodName">Variety Name *</label>
                  <input
                    type="text"
                    id="prodName"
                    className="form-control"
                    placeholder="e.g. Banganapalli"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="prodCategory">Product Category *</label>
                  <select
                    id="prodCategory"
                    className="form-control"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    required
                  >
                    {categories.length === 0 ? (
                      <option value="Mangoes">Mangoes</option>
                    ) : (
                      categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {category === 'Mangoes' && (
                  <div className="form-group">
                    <label htmlFor="prodUse">Primary Use Category *</label>
                    <select
                      id="prodUse"
                      className="form-control"
                      value={use}
                      onChange={(e) => setUse(e.target.value)}
                      required
                    >
                      {useCategories.length === 0 ? (
                        <option value="">— No options configured in CMS —</option>
                      ) : (
                        useCategories.map((uc) => (
                          <option key={uc} value={uc}>{uc}</option>
                        ))
                      )}
                    </select>
                    {useCategories.length === 0 && (
                      <small style={{ color: 'var(--warning)' }}>
                        Go to CMS → Primary Use Categories to add options.
                      </small>
                    )}
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="prodDesc">Product Description</label>
                  <textarea
                    id="prodDesc"
                    className="form-control"
                    placeholder="Short description shown on the product card..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="prodPrice">Price (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      id="prodPrice"
                      className="form-control"
                      placeholder="e.g. 150"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="prodUnit">Selling Unit *</label>
                    <input
                      type="text"
                      id="prodUnit"
                      className="form-control"
                      placeholder="e.g. 1 kg, 3 kg box"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="prodStock">Available Stock (kg/unit) *</label>
                    <input
                      type="number"
                      step="0.1"
                      id="prodStock"
                      className="form-control"
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="prodSort">Display Sort Order</label>
                    <input
                      type="number"
                      id="prodSort"
                      className="form-control"
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="prodDailyCap">Daily Stock Cap (optional)</label>
                  <input
                    type="number"
                    id="prodDailyCap"
                    className="form-control"
                    placeholder="Max units to sell today (leave blank = unlimited)"
                    value={dailyStockCap}
                    onChange={(e) => setDailyStockCap(e.target.value)}
                    min="0"
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Set a today-only limit to prevent over-orders on limited harvest days</small>
                </div>

                <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <input
                    type="checkbox"
                    id="prodActive"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="prodActive" style={{ cursor: 'pointer' }}>Active (Visible on public shop catalog)</label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)} disabled={isSaving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-secondary" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-backdrop open" onClick={() => setDeleteTarget(null)}>
          <div className="modal-content" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottom: 'none' }}>
              <h3 style={{ color: 'var(--danger)' }}>Delete Product?</h3>
            </div>
            <div className="modal-body" style={{ padding: '0 1.5rem 1.5rem 1.5rem' }}>
              Are you sure you want to permanently delete <strong>{deleteTarget.name}</strong>? This will remove it from the database entirely.
            </div>
            <div className="modal-footer" style={{ borderTop: 'none' }}>
              <button className="btn btn-outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDelete}>
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
