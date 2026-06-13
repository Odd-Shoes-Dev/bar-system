'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { SalonHeader } from '@/components/SalonBranding';
import { useUser } from '@/contexts/UserContext';
import { useBar } from '@/contexts/BarContext';
import { useModalEsc } from '@/contexts/EscContext';

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  description?: string;
  is_active: boolean;
  created_at: string;
}

interface CategoryOption {
  id: string;
  name: string;
  color: string;
}

export default function MenuPage() {
  const router = useRouter();
  const { user } = useUser();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  useModalEsc(showModal, () => setShowModal(false));
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);

  useEffect(() => {
    loadItems();
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      if (response.ok) {
        const data = await response.json();
        setCategoryOptions(data);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadItems = async () => {
    try {
      const response = await fetch('/api/menu?showAll=true');
      if (response.ok) {
        const data = await response.json();
        setItems(data);
      } else if (response.status === 401) {
        router.push('/login');
      }
    } catch (error) {
      console.error('Error loading menu items:', error);
      toast.error('Failed to load menu items');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const toggleItemStatus = async (itemId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/menu/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus }),
      });

      if (!response.ok) throw new Error('Failed to update item');

      toast.success(`Item ${currentStatus ? 'deactivated' : 'activated'}`);
      loadItems();
    } catch (error) {
      toast.error('Failed to update item status');
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const groupedItems = filteredItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  const canManage = user?.role === 'owner' || user?.role === 'manager';

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="Menu Management">
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="text-sm font-medium text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-600 capitalize">{user?.role}</p>
          </div>
          <Link href="/dashboard" className="btn-secondary">
            Dashboard
          </Link>
        </div>
      </SalonHeader>

      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Menu & Pricing</h1>
            <p className="text-gray-600 mt-1">Manage your drinks and food menu</p>
          </div>
          {canManage && (
            <div className="flex gap-2">
              <Link href="/categories" className="btn-secondary">
                Manage Categories
              </Link>
              <button
                onClick={() => { setEditingItem(null); setShowModal(true); }}
                className="btn-primary"
              >
                + Add Item
              </button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="card mb-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <input
                type="text"
                placeholder="Search menu..."
                className="input-lg w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="input-lg"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              {categoryOptions.map((cat) => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="card">
            <p className="text-sm text-gray-600">Total Items</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{items.length}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Active Items</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {items.filter((s) => s.is_active).length}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Categories</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {Object.keys(groupedItems).length}
            </p>
          </div>
          <div className="card min-w-0">
            <p className="text-sm text-gray-600">Avg. Price</p>
            <p className="text-xl font-bold text-gray-900 mt-1 truncate">
              {items.length > 0
                ? formatCurrency(items.reduce((sum, s) => sum + Number(s.price), 0) / items.length)
                : 'UGX 0'}
            </p>
          </div>
        </div>

        {/* Items by Category */}
        {loading ? (
          <div className="card text-center py-12 text-gray-400">Loading menu...</div>
        ) : filteredItems.length === 0 ? (
          <div className="card text-center py-12 text-gray-400">
            <p>No items found</p>
            {canManage && (
              <button
                onClick={() => setShowModal(true)}
                className="text-brand-primary hover:underline mt-2"
              >
                Add your first item
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedItems).map(([category, categoryItems]) => (
              <div key={category} className="card">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 uppercase">
                  {category}
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Item</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Price</th>
                        <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                        {canManage && (
                          <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {categoryItems.map((item) => (
                        <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-4 px-4">
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900">{item.name}</p>
                              {item.description && (
                                <p className="text-sm text-gray-500 mt-1 line-clamp-2 max-w-xs">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right font-semibold text-gray-900 whitespace-nowrap">
                            {formatCurrency(item.price)}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              item.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {item.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          {canManage && (
                            <td className="py-4 px-4 text-right">
                              <div className="flex items-center justify-end gap-3">
                                <button
                                  onClick={() => { setEditingItem(item); setShowModal(true); }}
                                  className="text-brand-primary hover:text-brand-primary/80 font-medium text-sm cursor-pointer"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => toggleItemStatus(item.id, item.is_active)}
                                  className="text-gray-600 hover:text-gray-900 font-medium text-sm cursor-pointer"
                                >
                                  {item.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && canManage && (
        <ItemModal
          item={editingItem}
          categoryOptions={categoryOptions}
          onClose={() => { setShowModal(false); setEditingItem(null); }}
          onSuccess={() => { setShowModal(false); setEditingItem(null); loadItems(); }}
        />
      )}
    </div>
  );
}

function ItemModal({
  item,
  categoryOptions,
  onClose,
  onSuccess,
}: {
  item: MenuItem | null;
  categoryOptions: CategoryOption[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { bar: salon } = useBar();
  const [name, setName] = useState(item?.name || '');
  const [category, setCategory] = useState(item?.category || '');
  const [price, setPrice] = useState(item?.price || 0);
  const [description, setDescription] = useState(item?.description || '');
  const [submitting, setSubmitting] = useState(false);

  const brandColor = salon?.theme_primary_color || '#E31C23';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const url = item ? `/api/menu/${item.id}` : '/api/menu';
      const method = item ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, category, price, description: description || undefined }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save item');
      }

      toast.success(item ? 'Item updated' : 'Item added to menu');
      onSuccess();
    } catch (error: any) {
      toast.error(error.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{item ? 'Edit Item' : 'Add New Item'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Item Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Tusker Lager"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select category</option>
                {categoryOptions.map((cat) => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
                {categoryOptions.length === 0 && <option value="Other">Other</option>}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Price (UGX) *</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                required
                min="0"
                step="500"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="5000"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Optional notes..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: brandColor }}
            >
              {submitting ? 'Saving...' : item ? 'Update Item' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
