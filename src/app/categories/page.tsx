'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { SalonHeader } from '@/components/SalonBranding';
import { useUser } from '@/contexts/UserContext';
import { useBar } from '@/contexts/BarContext';
import { useModalEsc } from '@/contexts/EscContext';

interface ServiceCategory {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  sort_order: number;
  is_active: boolean;
  service_count: number;
  created_at: string;
}

const PRESET_COLORS = [
  '#E31C23', '#3B82F6', '#10B981', '#8B5CF6',
  '#F59E0B', '#EF4444', '#06B6D4', '#6B7280',
  '#EC4899', '#14B8A6', '#F97316', '#84CC16',
];

export default function CategoriesPage() {
  const router = useRouter();
  const { user } = useUser();
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ServiceCategory | null>(null);
  useModalEsc(showModal, () => setShowModal(false));
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const canManage = user?.role === 'owner' || user?.role === 'manager';

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/categories?showAll=true');
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      } else if (response.status === 401) {
        router.push('/login');
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };


  const toggleStatus = async (cat: ServiceCategory) => {
    try {
      const response = await fetch(`/api/categories/${cat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !cat.is_active }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update');
      }

      toast.success(`Category ${cat.is_active ? 'deactivated' : 'activated'}`);
      loadCategories();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (cat: ServiceCategory) => {
    if (!window.confirm(`Delete "${cat.name}"? This cannot be undone.`)) return;

    setDeletingId(cat.id);
    try {
      const response = await fetch(`/api/categories/${cat.id}`, { method: 'DELETE' });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete');
      }

      toast.success('Category deleted');
      loadCategories();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredCategories = categories.filter((cat) => {
    const matchesSearch = cat.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && cat.is_active) ||
      (filterStatus === 'inactive' && !cat.is_active);
    return matchesSearch && matchesStatus;
  });

  const totalServices = categories.reduce((sum, c) => sum + (c.service_count || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="Category Management">
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
            <h1 className="text-2xl font-bold text-gray-900">Service Categories</h1>
            <p className="text-gray-600 mt-1">Organise your services into categories</p>
          </div>
          {canManage && (
            <button
              onClick={() => {
                setEditingCategory(null);
                setShowModal(true);
              }}
              className="btn-primary"
            >
              + Add Category
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="card">
            <p className="text-sm text-gray-600">Total Categories</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{categories.length}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Active</p>
            <p className="text-3xl font-bold text-green-600 mt-1">
              {categories.filter((c) => c.is_active).length}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Inactive</p>
            <p className="text-3xl font-bold text-gray-400 mt-1">
              {categories.filter((c) => !c.is_active).length}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Total Services</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{totalServices}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="card mb-6">
          <div className="grid md:grid-cols-4 gap-4">
            <div className="md:col-span-3">
              <input
                type="text"
                placeholder="Search categories..."
                className="input-lg w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div>
              <select
                className="input-lg w-full"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Category List */}
        {loading ? (
          <div className="card text-center py-12 text-gray-400">Loading categories...</div>
        ) : filteredCategories.length === 0 ? (
          <div className="card text-center py-12 text-gray-400">
            <p>No categories found</p>
            {canManage && (
              <button
                onClick={() => setShowModal(true)}
                className="text-brand-primary hover:underline mt-2"
              >
                Add your first category
              </button>
            )}
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Category
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 hidden md:table-cell">
                    Description
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                    Services
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                    Status
                  </th>
                  {canManage && (
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map((cat) => (
                  <tr key={cat.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <span
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="font-medium text-gray-900">{cat.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-500 hidden md:table-cell">
                      {cat.description || '—'}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {cat.service_count}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          cat.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {cat.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {canManage && (
                      <td className="py-4 px-4 text-right">
                        <div className="relative">
                          <button
                            onClick={() => setOpenMenuId(openMenuId === cat.id ? null : cat.id)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="More actions"
                          >
                            <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                              <circle cx="12" cy="5" r="2" />
                              <circle cx="12" cy="12" r="2" />
                              <circle cx="12" cy="19" r="2" />
                            </svg>
                          </button>

                          {/* Dropdown Menu */}
                          {openMenuId === cat.id && (
                            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                              <button
                                onClick={() => {
                                  setEditingCategory(cat);
                                  setShowModal(true);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100 first:rounded-t-lg"
                              >
                                ✏️ Edit
                              </button>
                              <button
                                onClick={() => {
                                  toggleStatus(cat);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100"
                              >
                                {cat.is_active ? '⊘ Deactivate' : '✓ Activate'}
                              </button>
                              <button
                                onClick={() => {
                                  handleDelete(cat);
                                  setOpenMenuId(null);
                                }}
                                disabled={deletingId === cat.id || cat.service_count > 0}
                                title={
                                  cat.service_count > 0
                                    ? 'Move or deactivate services before deleting'
                                    : 'Delete category'
                                }
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 last:rounded-b-lg disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                {deletingId === cat.id ? '⏳ Deleting...' : '🗑️ Delete'}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Back to Services link */}
        <div className="mt-6">
          <Link href="/menu" className="text-sm text-gray-500 hover:text-gray-700 hover:underline">
            ← Back to Menu
          </Link>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && canManage && (
        <CategoryModal
          category={editingCategory}
          onClose={() => {
            setShowModal(false);
            setEditingCategory(null);
          }}
          onSuccess={() => {
            setShowModal(false);
            setEditingCategory(null);
            loadCategories();
          }}
        />
      )}
    </div>
  );
}

// Category Add / Edit Modal
function CategoryModal({
  category,
  onClose,
  onSuccess,
}: {
  category: ServiceCategory | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { bar: salon } = useBar();
  const brandColor = salon?.theme_primary_color || '#6366f1';
  const isEdit = !!category;

  const [name, setName] = useState(category?.name || '');
  const [description, setDescription] = useState(category?.description || '');
  const [color, setColor] = useState(category?.color || brandColor);
  const [submitting, setSubmitting] = useState(false);

  // When creating a new category and salon loads, set default color to brand color
  useEffect(() => {
    if (!isEdit && salon?.theme_primary_color) {
      setColor(salon.theme_primary_color);
    }
  }, [salon?.theme_primary_color, isEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Category name is required');
      return;
    }

    setSubmitting(true);
    try {
      const url = isEdit ? `/api/categories/${category.id}` : '/api/categories';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          color,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to save category');
      }

      toast.success(isEdit ? 'Category updated' : 'Category created');
      onSuccess();
    } catch (error: any) {
      toast.error(error.message);
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 z-50"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold">
            {isEdit ? 'Edit Category' : 'Add New Category'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Haircut"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Brief description of this category..."
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Colour
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? '#1F2937' : 'transparent',
                  }}
                />
              ))}
            </div>
            <div className="flex items-center gap-3 mt-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border border-gray-300"
              />
              <span className="text-sm text-gray-600">Custom colour: {color}</span>
              <span
                className="px-3 py-1 rounded-full text-white text-xs font-medium"
                style={{ backgroundColor: color }}
              >
                Preview
              </span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: brandColor }}
            >
              {submitting ? 'Saving...' : isEdit ? 'Update Category' : 'Create Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
