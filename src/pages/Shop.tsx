import React, { useEffect, useState } from 'react';
import { Search, ShoppingCart, X, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';

interface Product {
  id: string;
  name: string;
  category: string;
  use?: 'fresh' | 'juice' | 'pickle' | null;
  description: string;
  price: number;
  unit: string;
  stock: number;
  image_url: string;
  sort_order: number;
  active: boolean;
}

export const Shop: React.FC = () => {
  useEffect(() => {
    document.title = 'Shop | Chittoor Farms';
    return () => { document.title = 'Chittoor Farms — Fresh from Farm to Home'; };
  }, []);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [openTooltip, setOpenTooltip] = useState<string | null>(null);

  const { addToCart, cartItems, updateQuantity } = useCart();
  const { showToast } = useToast();

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      console.error('Error fetching products:', err);
      showToast('Could not load products. Please check connection.', 'error');
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('categories')
        .eq('id', 'main')
        .single();

      if (error) throw error;
      if (data && Array.isArray(data.categories)) {
        setCategories(data.categories);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchProducts(), fetchCategories()]);
      setLoading(false);
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // fetch once on mount — showToast is stable but not a fetch dependency

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredProducts = products.filter((product) => {
    const matchesCategory = filter === 'all' || product.category === filter;
    const searchable = [
      product.name,
      product.category,
      product.use,
      product.description,
      product.unit,
    ].filter(Boolean).join(' ').toLowerCase();
    return matchesCategory && (!normalizedSearch || searchable.includes(normalizedSearch));
  });

  return (
    <div className="container">
      <div className="shop-header">
        <div>
          <h1>Fresh Farm Harvest</h1>
          <p>Hand-picked from our orchards and fields, naturally grown and delivered fresh.</p>
        </div>

        {/* Dynamic Category Filters */}
        <div className="filter-group" style={{ flexWrap: 'wrap' }}>
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Products
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`filter-btn ${filter === cat ? 'active' : ''}`}
              onClick={() => setFilter(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="shop-search-toolbar">
        <div className="shop-search-box">
          <Search size={19} />
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search products, categories, or uses..."
            aria-label="Search shop products"
          />
          {searchTerm && <button type="button" onClick={() => setSearchTerm('')} aria-label="Clear product search"><X size={16} /></button>}
        </div>
        <span className="shop-result-count">{filteredProducts.length} product{filteredProducts.length === 1 ? '' : 's'}</span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          🔄 Loading fresh harvest...
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="shop-search-empty">
          <Search size={30} />
          <h3>No matching products found</h3>
          <p>Try another product name, category, use, or clear the current filters.</p>
          <button type="button" className="btn btn-outline" onClick={() => { setSearchTerm(''); setFilter('all'); }}>Clear Filters</button>
        </div>
      ) : (
        <div className="shop-product-grid">
          {filteredProducts.map((product) => {
            const cartItem = cartItems.find((item) => item.id === product.id);
            const isInCart = !!cartItem;

            return (
              <div key={product.id} className="product-card">
                {/* Image + overlays */}
                <div className="product-img-wrapper">
                  <img
                    src={
                      product.image_url ||
                      'https://images.unsplash.com/photo-1553135933-0d13db7f0ece?auto=format&fit=crop&q=80&w=600'
                    }
                    alt={product.name}
                    className="product-img"
                    loading="lazy"
                  />
                  {/* Category badge — top left */}
                  <span
                    className="product-badge badge badge-fresh"
                    style={{ textTransform: 'capitalize', background: 'var(--secondary-light)', color: 'var(--secondary)' }}
                  >
                    {product.category}
                  </span>
                  {/* Info icon — top right */}
                  {product.description && (
                    <button
                      type="button"
                      className="product-img-info-btn"
                      onMouseEnter={() => setOpenTooltip(product.id)}
                      onMouseLeave={() => setOpenTooltip(null)}
                      onClick={() => setOpenTooltip(openTooltip === product.id ? null : product.id)}
                      aria-label="About this product"
                      aria-expanded={openTooltip === product.id}
                    >
                      <Info size={14} />
                    </button>
                  )}
                  {/* Availability — bottom right */}
                  <div className={`product-img-stock ${product.stock === 0 ? 'out' : product.stock < 10 ? 'low' : 'ok'}`}>
                    {product.stock === 0 ? 'Out of stock' : product.stock < 10 ? `⚠ ${product.stock}kg left` : '✓ Available'}
                  </div>
                  {/* Description overlay — appears on the image itself */}
                  {openTooltip === product.id && product.description && (
                    <div className="product-desc-overlay" role="tooltip">
                      {product.description}
                    </div>
                  )}
                </div>

                {/* Card body: name only */}
                <div className="product-card-body">
                  <h3 className="product-title">{product.name}</h3>
                </div>

                {/* Footer: price + action */}
                <div className="product-card-footer">
                  <div className="product-price">
                    ₹{product.price} <span>/ {product.unit}</span>
                  </div>
                  {product.stock === 0 ? (
                    <button className="btn btn-outline add-cart-btn" disabled style={{ cursor: 'not-allowed' }}>
                      Out of stock
                    </button>
                  ) : isInCart ? (
                    <div className="product-incart-row">
                      <span className="product-incart-label">In Cart</span>
                      <div className="cart-item-qty" style={{ margin: 0 }}>
                        <button
                          className="qty-btn"
                          onClick={() => updateQuantity(product.id, cartItem.quantity - 1, product.stock)}
                        >
                          -
                        </button>
                        <span className="qty-val">{cartItem.quantity}</span>
                        <button
                          className="qty-btn"
                          disabled={cartItem.quantity >= product.stock}
                          onClick={() => updateQuantity(product.id, cartItem.quantity + 1, product.stock)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="btn btn-primary add-cart-btn"
                      onClick={() =>
                        addToCart(
                          {
                            id: product.id,
                            name: product.name,
                            price: product.price,
                            unit: product.unit,
                            image_url: product.image_url,
                            stock: product.stock,
                          },
                          1
                        )
                      }
                    >
                      <ShoppingCart size={16} />
                      <span>Add to cart</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
