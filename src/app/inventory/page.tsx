'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { SalonHeader } from '@/components/SalonBranding';
import { useUser } from '@/contexts/UserContext';
import { useBar } from '@/contexts/BarContext';
import { formatCurrency } from '@/lib/utils';

const UNITS = ['pcs', 'ml', 'litres', 'kg', 'g', 'box', 'bottle', 'crate', 'can', 'glass'];
const REASONS = [
  { value: 'purchase',   label: 'Purchase / Restock' },
  { value: 'use',        label: 'Used / Consumed' },
  { value: 'damage',     label: 'Damaged / Expired' },
  { value: 'return',     label: 'Returned to Supplier' },
  { value: 'adjustment', label: 'Stock Adjustment' },
];

type TabKey = 'items' | 'groups' | 'movements';

interface Group   { id: string; name: string; color: string; description: string | null; is_active: boolean; sort_order: number }
interface Item    { id: string; name: string; unit: string; current_qty: number; reorder_level: number; cost_per_unit: number; supplier: string | null; group: Group | null; description: string | null; branch_name?: string | null }
interface Movement { id: string; qty_change: number; qty_after: number; reason: string; notes: string | null; created_at: string; item: { name: string; unit: string } | null; staff: { name: string } | null; branch_name?: string | null }

const BLANK_GROUP = { name: '', description: '', color: '#6366f1', sort_order: 0 };
const BLANK_ITEM  = { name: '', description: '', unit: 'pcs', group_id: '', current_qty: '', reorder_level: '', cost_per_unit: '', supplier: '' };

export default function InventoryPage() {
  const { user } = useUser();
  const { bar: salon } = useBar();
  const brandColor = salon?.theme_primary_color || '#6366f1';
  const canEdit   = ['owner', 'admin', 'manager'].includes(user?.role || '');
  const canAdmin  = ['owner', 'admin'].includes(user?.role || '');

  const [tab, setTab]             = useState<TabKey>('items');
  const [groups, setGroups]       = useState<Group[]>([]);
  const [items, setItems]         = useState<Item[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [invSummary, setInvSummary] = useState({ totalValue: 0, lowStockCount: 0, totalItems: 0 });
  const [filterGroup, setFilterGroup] = useState('');
  const [loading, setLoading]     = useState(true);

  // Group modal
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup]     = useState<Group | null>(null);
  const [groupForm, setGroupForm]           = useState(BLANK_GROUP);
  const [savingGroup, setSavingGroup]       = useState(false);

  // Item modal
  const [showItemModal, setShowItemModal]   = useState(false);
  const [editingItem, setEditingItem]       = useState<Item | null>(null);
  const [itemForm, setItemForm]             = useState(BLANK_ITEM);
  const [savingItem, setSavingItem]         = useState(false);

  const [openMenuId, setOpenMenuId]          = useState<string | null>(null);
  const [menuPos, setMenuPos]                = useState<{ top: number; right: number } | null>(null);

  // Adjust qty modal
  const [adjustItem, setAdjustItem]         = useState<Item | null>(null);
  const [adjQty, setAdjQty]                 = useState('');
  const [adjDir, setAdjDir]                 = useState<'add' | 'remove'>('add');
  const [adjReason, setAdjReason]           = useState('purchase');
  const [adjNotes, setAdjNotes]             = useState('');
  const [adjusting, setAdjusting]           = useState(false);

  const loadGroups = useCallback(async () => {
    const res  = await fetch('/api/inventory/groups');
    const data = await res.json();
    if (res.ok) setGroups(data);
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    const qs  = filterGroup ? `?group_id=${filterGroup}` : '';
    const res = await fetch(`/api/inventory/items${qs}`);
    const data = await res.json();
    if (res.ok) { setItems(data.items); setInvSummary(data.summary); }
    setLoading(false);
  }, [filterGroup]);

  const loadMovements = useCallback(async () => {
    setLoading(true);
    const res  = await fetch('/api/inventory/movements?limit=100');
    const data = await res.json();
    if (res.ok) setMovements(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);
  useEffect(() => { if (tab === 'items') loadItems(); }, [tab, loadItems]);
  useEffect(() => { if (tab === 'movements') loadMovements(); }, [tab, loadMovements]);

  // ── Group handlers ─────────────────────────────────────────────
  const openAddGroup = () => { setEditingGroup(null); setGroupForm(BLANK_GROUP); setShowGroupModal(true); };
  const openEditGroup = (g: Group) => { setEditingGroup(g); setGroupForm({ name: g.name, description: g.description || '', color: g.color, sort_order: g.sort_order }); setShowGroupModal(true); };

  const saveGroup = async () => {
    if (!groupForm.name.trim()) return toast.error('Name is required');
    setSavingGroup(true);
    try {
      const url    = editingGroup ? `/api/inventory/groups/${editingGroup.id}` : '/api/inventory/groups';
      const method = editingGroup ? 'PUT' : 'POST';
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...groupForm, is_active: true }) });
      const data   = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(editingGroup ? 'Group updated' : 'Group created');
      setShowGroupModal(false);
      loadGroups();
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingGroup(false); }
  };

  const deleteGroup = async (id: string) => {
    if (!confirm('Delete this group? Items in it will become ungrouped.')) return;
    await fetch(`/api/inventory/groups/${id}`, { method: 'DELETE' });
    toast.success('Group deleted');
    loadGroups();
  };

  // ── Item handlers ──────────────────────────────────────────────
  const openAddItem = () => { setEditingItem(null); setItemForm(BLANK_ITEM); setShowItemModal(true); };
  const openEditItem = (i: Item) => {
    setEditingItem(i);
    setItemForm({ name: i.name, description: i.description || '', unit: i.unit, group_id: i.group?.id || '', current_qty: String(i.current_qty), reorder_level: String(i.reorder_level), cost_per_unit: String(i.cost_per_unit), supplier: i.supplier || '' });
    setShowItemModal(true);
  };

  const saveItem = async () => {
    if (!itemForm.name.trim()) return toast.error('Name is required');
    setSavingItem(true);
    try {
      const url    = editingItem ? `/api/inventory/items/${editingItem.id}` : '/api/inventory/items';
      const method = editingItem ? 'PUT' : 'POST';
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(itemForm) });
      const data   = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(editingItem ? 'Item updated' : 'Item added');
      setShowItemModal(false);
      loadItems();
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingItem(false); }
  };

  const deleteItem = async (id: string) => {
    if (!confirm('Remove this item from inventory?')) return;
    await fetch(`/api/inventory/items/${id}`, { method: 'DELETE' });
    toast.success('Item removed');
    loadItems();
  };

  // ── Adjust qty ─────────────────────────────────────────────────
  const openAdjust = (i: Item) => {
    setAdjustItem(i);
    setAdjQty('');
    setAdjDir('add');
    setAdjReason('purchase');
    setAdjNotes('');
  };

  const submitAdjust = async () => {
    if (!adjQty || Number(adjQty) <= 0) return toast.error('Enter a valid quantity');
    setAdjusting(true);
    try {
      const qty_change = adjDir === 'add' ? Number(adjQty) : -Number(adjQty);
      const res = await fetch('/api/inventory/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: adjustItem!.id, qty_change, reason: adjReason, notes: adjNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Stock ${adjDir === 'add' ? 'added' : 'reduced'} — new qty: ${data.new_qty} ${adjustItem!.unit}`);
      setAdjustItem(null);
      loadItems();
    } catch (e: any) { toast.error(e.message); }
    finally { setAdjusting(false); }
  };

  const lowStock = (i: Item) => Number(i.reorder_level) > 0 && Number(i.current_qty) <= Number(i.reorder_level);

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="Inventory">
        <div className="flex items-center gap-3">
          {canEdit && tab === 'items'  && <button onClick={openAddItem}  className="btn-primary text-sm">+ Add Item</button>}
          {canAdmin && tab === 'groups' && <button onClick={openAddGroup} className="btn-primary text-sm">+ Add Group</button>}
          <Link href="/dashboard" className="btn-secondary text-sm">Dashboard</Link>
        </div>
      </SalonHeader>

      <div className="container mx-auto p-6 space-y-6">

        {/* Summary Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="card border-l-4 border-indigo-500">
            <p className="text-sm text-gray-500">Total Items</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{invSummary.totalItems}</p>
          </div>
          <div className="card border-l-4 border-purple-500">
            <p className="text-sm text-gray-500">Inventory Value</p>
            <p className="text-lg sm:text-xl font-bold text-gray-900 mt-1">{formatCurrency(invSummary.totalValue)}</p>
          </div>
          <div className={`card border-l-4 ${invSummary.lowStockCount > 0 ? 'border-red-500' : 'border-green-500'}`}>
            <p className="text-sm text-gray-500">Low Stock Alerts</p>
            <p className={`text-xl sm:text-2xl font-bold mt-1 ${invSummary.lowStockCount > 0 ? 'text-red-600' : 'text-green-600'}`}>{invSummary.lowStockCount}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="inline-flex bg-gray-100 rounded-xl p-1 gap-1">
          {(['items', 'groups', 'movements'] as TabKey[]).map(t => {
            const active = tab === t;
            const labels: Record<TabKey, string> = { items: 'Stock Items', groups: 'Stock Groups', movements: 'Movement Log' };
            return (
              <button key={t} onClick={() => setTab(t)}
                style={active ? { backgroundColor: brandColor, color: '#fff' } : {}}
                className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-all ${active ? 'shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-white'}`}>
                {labels[t]}
              </button>
            );
          })}
        </div>

        {/* ── ITEMS TAB ── */}
        {tab === 'items' && (
          <div className="space-y-4">
            {/* Group filter */}
            <div className="flex flex-wrap gap-2 items-center">
              <button onClick={() => setFilterGroup('')}
                style={!filterGroup ? { backgroundColor: brandColor, color: '#fff' } : {}}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${!filterGroup ? '' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                All
              </button>
              {groups.filter(g => g.is_active).map(g => (
                <button key={g.id} onClick={() => setFilterGroup(g.id)}
                  style={filterGroup === g.id ? { backgroundColor: g.color, color: '#fff' } : { borderColor: g.color, color: g.color }}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all border ${filterGroup === g.id ? '' : 'bg-white hover:opacity-80'}`}>
                  {g.name}
                </button>
              ))}
            </div>

            <div className="card p-0 overflow-hidden">
              {loading ? (
                <div className="p-8 text-center text-gray-400">Loading…</div>
              ) : items.length === 0 ? (
                <div className="p-8 text-center text-gray-400">No items yet.
                  {canEdit && <button onClick={openAddItem} className="block mx-auto mt-3 btn-primary text-sm">Add First Item</button>}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Group</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                      <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                      <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase">Reorder</th>
                      <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase">Cost / unit</th>
                      <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
                      {canEdit && <th className="py-3 px-4" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map(i => (
                      <tr key={i.id} className={`hover:bg-gray-50 ${lowStock(i) ? 'bg-red-50' : ''}`}>
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900">{i.name}</div>
                          {i.supplier && <div className="text-xs text-gray-400">{i.supplier}</div>}
                        </td>
                        <td className="py-3 px-4">
                          {i.group ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: i.group.color }}>{i.group.name}</span>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="py-3 px-4">
                          {i.branch_name ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-primary/10 text-brand-primary whitespace-nowrap">
                              <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                              {i.branch_name}
                            </span>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`font-semibold ${lowStock(i) ? 'text-red-600' : 'text-gray-900'}`}>
                            {i.current_qty} {i.unit}
                          </span>
                          {lowStock(i) && <div className="text-[10px] text-red-500 font-medium">LOW STOCK</div>}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-500">{i.reorder_level > 0 ? `${i.reorder_level} ${i.unit}` : '—'}</td>
                        <td className="py-3 px-4 text-right text-gray-600">{i.cost_per_unit > 0 ? formatCurrency(i.cost_per_unit) : '—'}</td>
                        <td className="py-3 px-4 text-right font-medium text-gray-900">{formatCurrency(i.current_qty * i.cost_per_unit)}</td>
                        {canEdit && (
                          <td className="py-3 px-4">
                            <div className="flex justify-end">
                              <button
                                onClick={e => {
                                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                  setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                                  setOpenMenuId(openMenuId === i.id ? null : i.id);
                                }}
                                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                              >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                  <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── GROUPS TAB ── */}
        {tab === 'groups' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.length === 0 ? (
              <div className="col-span-3 card text-center text-gray-400 py-12">
                No groups yet.
                {canAdmin && <button onClick={openAddGroup} className="block mx-auto mt-3 btn-primary text-sm">Create First Group</button>}
              </div>
            ) : groups.map(g => (
              <div key={g.id} className="card flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg shrink-0" style={{ backgroundColor: g.color }}>
                    {g.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{g.name}</p>
                    {g.description && <p className="text-xs text-gray-500 mt-0.5">{g.description}</p>}
                    <span className={`text-xs px-1.5 py-0.5 rounded mt-1 inline-block ${g.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {g.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                {canAdmin && (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => openEditGroup(g)} className="text-xs text-blue-600 hover:text-blue-800">Edit</button>
                    <button onClick={() => deleteGroup(g.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── MOVEMENTS TAB ── */}
        {tab === 'movements' && (
          <div className="card p-0 overflow-hidden">
            {movements.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No stock movements recorded yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Date & Time</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                    <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase">Change</th>
                    <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase">After</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">By</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {movements.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-500 whitespace-nowrap">{new Date(m.created_at).toLocaleString('en-UG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="py-3 px-4 font-medium text-gray-900">{m.item?.name || '—'}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          m.reason === 'purchase' ? 'bg-green-50 text-green-700' :
                          m.reason === 'use'      ? 'bg-blue-50  text-blue-700'  :
                          m.reason === 'damage'   ? 'bg-red-50   text-red-700'   :
                          'bg-gray-100 text-gray-600'}`}>
                          {REASONS.find(r => r.value === m.reason)?.label || m.reason}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-500 max-w-xs truncate">{m.notes || '—'}</td>
                      <td className={`py-3 px-4 text-right font-semibold ${m.qty_change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {m.qty_change > 0 ? '+' : ''}{m.qty_change} {m.item?.unit}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-700">{m.qty_after} {m.item?.unit}</td>
                      <td className="py-3 px-4 text-gray-500">{m.staff?.name || '—'}</td>
                      <td className="py-3 px-4">
                        {m.branch_name ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-primary/10 text-brand-primary whitespace-nowrap">
                            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            {m.branch_name}
                          </span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ── Group Modal ── */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold">{editingGroup ? 'Edit Group' : 'New Stock Group'}</h2>
              <button onClick={() => setShowGroupModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input value={groupForm.name} onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))} className="input w-full" placeholder="e.g. Spirits, Beers, Wines, Soft Drinks" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
                <input value={groupForm.description} onChange={e => setGroupForm(f => ({ ...f, description: e.target.value }))} className="input w-full" placeholder="Brief description" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={groupForm.color} onChange={e => setGroupForm(f => ({ ...f, color: e.target.value }))} className="w-10 h-10 rounded cursor-pointer border border-gray-200" />
                  <input value={groupForm.color} onChange={e => setGroupForm(f => ({ ...f, color: e.target.value }))} className="input flex-1 font-mono" maxLength={7} />
                  <div className="w-10 h-10 rounded-lg" style={{ backgroundColor: groupForm.color }} />
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setShowGroupModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={saveGroup} disabled={savingGroup} className="btn-primary flex-1">{savingGroup ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Item Modal ── */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold">{editingItem ? 'Edit Item' : 'New Stock Item'}</h2>
              <button onClick={() => setShowItemModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                  <input value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} className="input w-full" placeholder="e.g. Tusker 500ml, Jameson 750ml" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Group</label>
                  <select value={itemForm.group_id} onChange={e => setItemForm(f => ({ ...f, group_id: e.target.value }))} className="input w-full">
                    <option value="">No group</option>
                    {groups.filter(g => g.is_active).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select value={itemForm.unit} onChange={e => setItemForm(f => ({ ...f, unit: e.target.value }))} className="input w-full">
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{editingItem ? 'Reorder Level' : 'Opening Qty'}</label>
                  <input type="number" min={0} value={editingItem ? itemForm.reorder_level : itemForm.current_qty} onChange={e => setItemForm(f => ({ ...f, [editingItem ? 'reorder_level' : 'current_qty']: e.target.value }))} className="input w-full" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{editingItem ? 'Cost / unit (UGX)' : 'Reorder Level'}</label>
                  <input type="number" min={0} value={editingItem ? itemForm.cost_per_unit : itemForm.reorder_level} onChange={e => setItemForm(f => ({ ...f, [editingItem ? 'cost_per_unit' : 'reorder_level']: e.target.value }))} className="input w-full" placeholder="0" />
                </div>
                {editingItem && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cost / unit (UGX)</label>
                    <input type="number" min={0} value={itemForm.cost_per_unit} onChange={e => setItemForm(f => ({ ...f, cost_per_unit: e.target.value }))} className="input w-full" placeholder="0" />
                  </div>
                )}
                <div className={editingItem ? '' : 'col-span-2'}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input value={itemForm.supplier} onChange={e => setItemForm(f => ({ ...f, supplier: e.target.value }))} className="input w-full" placeholder="Supplier name" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-100 sticky bottom-0 bg-white">
              <button onClick={() => setShowItemModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={saveItem} disabled={savingItem} className="btn-primary flex-1">{savingItem ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Adjust Qty Modal ── */}
      {adjustItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold">Adjust Stock</h2>
                <p className="text-sm text-gray-500 mt-0.5">{adjustItem.name} — Current: <strong>{adjustItem.current_qty} {adjustItem.unit}</strong></p>
              </div>
              <button onClick={() => setAdjustItem(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setAdjDir('add')} style={adjDir === 'add' ? { backgroundColor: '#16a34a', color: '#fff' } : {}}
                  className={`py-2 rounded-lg text-sm font-medium border transition-all ${adjDir === 'add' ? '' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  + Add Stock
                </button>
                <button onClick={() => setAdjDir('remove')} style={adjDir === 'remove' ? { backgroundColor: '#dc2626', color: '#fff' } : {}}
                  className={`py-2 rounded-lg text-sm font-medium border transition-all ${adjDir === 'remove' ? '' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  − Remove Stock
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity ({adjustItem.unit})</label>
                <input type="number" min={1} value={adjQty} onChange={e => setAdjQty(e.target.value)} className="input w-full" placeholder="0" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <select value={adjReason} onChange={e => setAdjReason(e.target.value)} className="input w-full">
                  {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
                <input value={adjNotes} onChange={e => setAdjNotes(e.target.value)} className="input w-full" placeholder="Any extra details…" />
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setAdjustItem(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={submitAdjust} disabled={adjusting} className="btn-primary flex-1">{adjusting ? 'Saving…' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Fixed-position row action dropdown (escapes overflow-hidden) ── */}
      {openMenuId && menuPos && (() => {
        const item = items.find(i => i.id === openMenuId);
        if (!item) return null;
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
            <div
              className="fixed z-50 w-44 bg-white border border-gray-200 rounded-xl shadow-xl py-1"
              style={{ top: menuPos.top, right: menuPos.right }}
            >
              <button
                onClick={() => { openAdjust(item); setOpenMenuId(null); }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                Adjust Stock
              </button>
              <button
                onClick={() => { openEditItem(item); setOpenMenuId(null); }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Item
              </button>
              {canAdmin && (
                <>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={() => { deleteItem(item.id); setOpenMenuId(null); }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </>
              )}
            </div>
          </>
        );
      })()}
    </div>
  );
}
