import React, { useEffect, useState } from 'react';
import { Search, ShoppingCart, X } from 'lucide-react';
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
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

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
        <div className="grid-responsive">
          {filteredProducts.map((product) => {
            const cartItem = cartItems.find((item) => item.id === product.id);
            const isInCart = !!cartItem;

            return (
              <div key={product.id} className="product-card">
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
                  <span
                    className="product-badge badge badge-fresh"
                    style={{ textTransform: 'capitalize', background: 'var(--secondary-light)', color: 'var(--secondary)' }}
                  >
                    {product.category}
                  </span>
                </div>

                <div className="product-card-body">
                  <div className="product-title-row">
                    <h3 className="product-title">{product.name}</h3>
                    <div className="product-price">
                      ₹{product.price} <span>/ {product.unit}</span>
                    </div>
                  </div>

                  <p className="product-desc">{product.description}</p>

                  {/* Stock Indicator */}
                  <div className="product-stock-indicator">
                    {product.stock === 0 ? (
                      <span className="product-stock-out">Out of stock</span>
                    ) : product.stock < 10 ? (
                      <span className="product-stock-low">
                        ⚠️ Only {product.stock} {product.unit} left
                      </span>
                    ) : (
                      <span className="product-stock-ok" style={{ color: 'var(--success)', fontSize: '0.8rem' }}>
                        ✓ Available
                      </span>
                    )}
                  </div>
                </div>

                <div className="product-card-footer">
                  {product.stock === 0 ? (
                    <button className="btn btn-outline" style={{ width: '100%', cursor: 'not-allowed' }} disabled>
                      Out of stock
                    </button>
                  ) : isInCart ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'var(--bg-muted)',
                        padding: '0.35rem 0.5rem',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, paddingLeft: '0.5rem' }}>In Cart</span>
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
