'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { SalonHeader } from '@/components/SalonBranding';
import { TransactionSummaryModal, TransactionSummaryData } from '@/components/TransactionSummaryModal';
import { useUser } from '@/contexts/UserContext';
import { useBar } from '@/contexts/BarContext';

interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
}

interface Service {
  id: string;
  name: string;
  category: string;
  gender_target: 'male' | 'female' | 'unisex';
  price: number;
  duration_minutes: number;
  points_earned: number;
}

interface CartItem {
  service: Service;
  quantity: number;
  customPrice?: number;
}

interface Addon {
  id: string;
  name: string;
  price: number;
  description: string | null;
  is_active: boolean;
}

interface CartAddon {
  addon: Addon;
  quantity: number;
  customPrice?: number;
}

export default function POSPage() {
  const router = useRouter();
  const { user } = useUser();
  const { bar: salon } = useBar();
  const [searchQuery, setSearchQuery] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; color: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [clientSearching, setClientSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [transactionDate, setTransactionDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showNewServiceModal, setShowNewServiceModal] = useState(false);
  const [completedTransaction, setCompletedTransaction] = useState<TransactionSummaryData | null>(null);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editingPriceValue, setEditingPriceValue] = useState<string>('');
  const [availableAddons, setAvailableAddons] = useState<Addon[]>([]);
  const [cartAddons, setCartAddons] = useState<CartAddon[]>([]);
  const [addonsExpanded, setAddonsExpanded] = useState(false);
  const [quickAddonModal, setQuickAddonModal] = useState(false);
  const [quickAddonForm, setQuickAddonForm] = useState({ name: '', price: '' });
  const [savingQuickAddon, setSavingQuickAddon] = useState(false);
  // Payment breakdown state
  const [checkoutDiscount, setCheckoutDiscount] = useState<string>('');
  const [amountPaid, setAmountPaid] = useState<string>('');

  // Record balance payment modal state
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [balanceSearch, setBalanceSearch] = useState('');
  interface BalanceVisit { id: string; receipt_number: string; total_amount: number; amount_paid: number; checkout_discount: number; balance_due: number; created_at: string; }
  interface BalanceClient { id: string; name: string; phone: string; total_balance: number; outstanding_visits: BalanceVisit[]; }
  const [balanceClients, setBalanceClients] = useState<BalanceClient[]>([]);
  const [balanceSearching, setBalanceSearching] = useState(false);
  const [selectedBalanceClient, setSelectedBalanceClient] = useState<BalanceClient | null>(null);
  const [selectedBalanceVisit, setSelectedBalanceVisit] = useState<BalanceVisit | null>(null);
  const [balancePaymentAmount, setBalancePaymentAmount] = useState<string>('');
  const [balancePaymentMethod, setBalancePaymentMethod] = useState<string>('cash');
  const [processingBalance, setProcessingBalance] = useState(false);
  const balanceSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load services, categories and add-ons on mount
  useEffect(() => {
    const cachedServices = localStorage.getItem('pos_services');
    const cachedCategories = localStorage.getItem('pos_categories');
    if (cachedServices) { setServices(JSON.parse(cachedServices)); setServicesLoading(false); }
    if (cachedCategories) setCategories(JSON.parse(cachedCategories));
    Promise.all([loadServices(), loadCategories(), loadAddons()]);
  }, []);

  // Debounced client search
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (searchQuery.length >= 2) {
      setClientSearching(true);
      searchDebounceRef.current = setTimeout(() => {
        searchClients();
      }, 300);
    } else {
      setClients([]);
      setClientSearching(false);
    }
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  const loadServices = async () => {
    try {
      const response = await fetch('/api/menu');
      if (response.ok) {
        const data = await response.json();
        setServices(data);
        localStorage.setItem('pos_services', JSON.stringify(data));
      }
    } catch (error) {
      console.error('Error loading services:', error);
    } finally {
      setServicesLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
        localStorage.setItem('pos_categories', JSON.stringify(data));
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const searchClients = async () => {
    try {
      const response = await fetch(`/api/clients?search=${encodeURIComponent(searchQuery)}`);
      if (response.ok) {
        const data = await response.json();
        setClients(data);
      }
    } catch (error) {
      console.error('Error searching clients:', error);
    } finally {
      setClientSearching(false);
    }
  };

  const selectClient = (client: Client) => {
    setSelectedClient(client);
    setSearchQuery('');
    setClients([]);
    setClientSearching(false);
  };

  const addToCart = (service: Service) => {
    const existingItem = cart.find(item => item.service.id === service.id);
    
    if (existingItem) {
      setCart(cart.map(item => 
        item.service.id === service.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { service, quantity: 1 }]);
    }
    
    toast.success(`${service.name} added to cart`);
  };

  const removeFromCart = (serviceId: string) => {
    setCart(cart.filter(item => item.service.id !== serviceId));
  };

  const updateQuantity = (serviceId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(serviceId);
    } else {
      setCart(cart.map(item =>
        item.service.id === serviceId
          ? { ...item, quantity }
          : item
      ));
    }
  };

  const updateCustomPrice = (serviceId: string, price: number) => {
    setCart(cart.map(item =>
      item.service.id === serviceId
        ? { ...item, customPrice: price === item.service.price ? undefined : price }
        : item
    ));
  };

  const loadAddons = async () => {
    try {
      const res = await fetch('/api/addons');
      if (res.ok) setAvailableAddons((await res.json()).filter((a: Addon) => a.is_active));
    } catch { /* silently ignore */ }
  };

  // Balance modal: debounced search for clients with unpaid balance
  useEffect(() => {
    if (!showBalanceModal) return;
    if (balanceSearchRef.current) clearTimeout(balanceSearchRef.current);
    balanceSearchRef.current = setTimeout(async () => {
      setBalanceSearching(true);
      try {
        const res = await fetch(`/api/clients/balances?search=${encodeURIComponent(balanceSearch)}`);
        if (res.ok) setBalanceClients(await res.json());
      } catch { /* ignore */ } finally {
        setBalanceSearching(false);
      }
    }, 300);
    return () => { if (balanceSearchRef.current) clearTimeout(balanceSearchRef.current); };
  }, [balanceSearch, showBalanceModal]);

  const openBalanceModal = () => {
    setBalanceSearch('');
    setBalanceClients([]);
    setSelectedBalanceClient(null);
    setSelectedBalanceVisit(null);
    setBalancePaymentAmount('');
    setBalancePaymentMethod('cash');
    setShowBalanceModal(true);
  };

  const processBalancePayment = async () => {
    if (!selectedBalanceVisit || !balancePaymentAmount) return;
    const amt = Number(balancePaymentAmount);
    if (isNaN(amt) || amt <= 0) { toast.error('Enter a valid payment amount'); return; }

    setProcessingBalance(true);
    try {
      const res = await fetch(`/api/visits/${selectedBalanceVisit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_amount: amt, payment_method: balancePaymentMethod }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to record payment');
      }
      const result = await res.json();
      toast.success('Balance payment recorded!');
      setShowBalanceModal(false);

      // Show a receipt for the balance payment
      setCompletedTransaction({
        receiptNumber: result.receipt_number,
        clientName: result.client_name,
        clientPhone: result.client_phone,
        services: [],
        total: result.total_amount,
        checkoutDiscount: result.checkout_discount > 0 ? result.checkout_discount : undefined,
        amountPaid: result.amount_paid,
        balanceDue: result.balance_due,
        pointsEarned: 0,
        paymentMethod: result.payment_method,
        isBalancePayment: true,
        originalReceiptNumber: result.receipt_number,
      });
    } catch (e: any) {
      toast.error(e.message || 'Payment failed');
    } finally {
      setProcessingBalance(false);
    }
  };

  const addAddon = (addon: Addon) => {
    setCartAddons(prev => {
      const existing = prev.find(c => c.addon.id === addon.id);
      if (existing) return prev.filter(c => c.addon.id !== addon.id);
      return [...prev, { addon, quantity: 1 }];
    });
  };

  const updateAddonQty = (addonId: string, qty: number) => {
    if (qty <= 0) { setCartAddons(prev => prev.filter(c => c.addon.id !== addonId)); return; }
    setCartAddons(prev => prev.map(c => c.addon.id === addonId ? { ...c, quantity: qty } : c));
  };

  const updateAddonCustomPrice = (addonId: string, price: number) => {
    setCartAddons(prev => prev.map(c =>
      c.addon.id === addonId
        ? { ...c, customPrice: price === c.addon.price ? undefined : price }
        : c
    ));
  };


  const createQuickAddon = async () => {
    if (!quickAddonForm.name.trim()) { toast.error('Name is required'); return; }
    const price = parseFloat(quickAddonForm.price);
    if (isNaN(price) || price < 0) { toast.error('Enter a valid price'); return; }
    setSavingQuickAddon(true);
    try {
      const res = await fetch('/api/addons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: quickAddonForm.name.trim(), price }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      const newAddon: Addon = { id: data.id, name: data.name, price: data.price, description: data.description, is_active: true };
      setAvailableAddons(prev => [...prev, newAddon]);
      setCartAddons(prev => [...prev, { addon: newAddon, quantity: 1 }]);
      toast.success(`"${data.name}" added to cart`);
      setQuickAddonModal(false);
      setQuickAddonForm({ name: '', price: '' });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingQuickAddon(false);
    }
  };

  const calculateAddonsTotal = () =>
    cartAddons.reduce((sum, item) => sum + (item.customPrice ?? item.addon.price) * item.quantity, 0);

  const calculateTotal = () => {
    return cart.reduce((sum, item) => {
      const price = item.customPrice ?? item.service.price;
      return sum + (price * item.quantity);
    }, 0);
  };

  const calculateTotalDiscount = () => {
    return cart.reduce((sum, item) => {
      if (item.customPrice !== undefined && item.customPrice < item.service.price) {
        return sum + (item.service.price - item.customPrice) * item.quantity;
      }
      return sum;
    }, 0);
  };

  const processPayment = async (paymentMethod: string) => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    setProcessingPayment(true);

    const totalAmount = calculateTotal() + calculateAddonsTotal();
    const totalDiscount = calculateTotalDiscount();

    // Payment breakdown values
    const discountAmt = Math.max(0, Number(checkoutDiscount) || 0);
    const amountDue = Math.max(0, totalAmount - discountAmt);
    const paidAmt = amountPaid !== '' ? Math.max(0, Math.min(Number(amountPaid) || 0, amountDue)) : amountDue;
    const balanceDueAmt = Math.max(0, amountDue - paidAmt);

    const purchasedServices = [
      ...cart.map((item) => ({
        name: item.service.name,
        quantity: item.quantity,
        unitPrice: item.customPrice ?? item.service.price,
        originalPrice: item.customPrice !== undefined && item.customPrice < item.service.price ? item.service.price : undefined,
        discountAmount: item.customPrice !== undefined && item.customPrice < item.service.price
          ? (item.service.price - item.customPrice) * item.quantity
          : undefined,
      })),
      ...cartAddons.map(item => ({
        name: `${item.addon.name} (Add-on)`,
        quantity: item.quantity,
        unitPrice: item.customPrice ?? item.addon.price,
        originalPrice: item.customPrice !== undefined && item.customPrice < item.addon.price ? item.addon.price : undefined,
        discountAmount: item.customPrice !== undefined && item.customPrice < item.addon.price
          ? (item.addon.price - item.customPrice) * item.quantity
          : undefined,
      })),
    ];

    try {
      const response = await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: selectedClient?.id || null,
          services: cart.map(item => ({
            service_id: item.service.id,
            quantity: item.quantity,
            custom_price: item.customPrice,
          })),
          payment_method: paymentMethod,
          send_receipt: false,
          transaction_date: transactionDate !== new Date().toISOString().split('T')[0] ? transactionDate : undefined,
          addons: cartAddons.map(item => ({ addon_id: item.addon.id, quantity: item.quantity, custom_price: item.customPrice })),
          checkout_discount: discountAmt > 0 ? discountAmt : undefined,
          amount_paid: paidAmt,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Payment failed');
      }

      const result = await response.json();

      toast.success(`Payment successful! Receipt: ${result.receipt_number}`);

      setCompletedTransaction({
        receiptNumber: result.receipt_number,
        clientName: selectedClient?.name || 'Walk-in',
        clientPhone: selectedClient?.phone || '',
        services: purchasedServices,
        total: totalAmount,
        totalDiscount: totalDiscount > 0 ? totalDiscount : undefined,
        checkoutDiscount: discountAmt > 0 ? discountAmt : undefined,
        amountPaid: paidAmt < totalAmount ? paidAmt : undefined,
        balanceDue: balanceDueAmt > 0 ? balanceDueAmt : undefined,
        pointsEarned: 0,
        paymentMethod,
        date: result.created_at,
      });

      setCart([]);
      setCartAddons([]);
      setAddonsExpanded(false);
      setCheckoutDiscount('');
      setAmountPaid('');
    } catch (error: any) {
      console.error('Payment error:', error);
      toast.error(error.message || 'Payment failed');
    } finally {
      setProcessingPayment(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const filteredByCategory = services
    .filter((s) => selectedCategory === 'all' || s.category === selectedCategory);

  const groupedServices = filteredByCategory.reduce((acc, service) => {
    if (!acc[service.category]) {
      acc[service.category] = [];
    }
    acc[service.category].push(service);
    return acc;
  }, {} as Record<string, Service[]>);

  return (
    <div className="min-h-screen bg-gray-50 lg:h-screen lg:overflow-hidden lg:flex lg:flex-col">
      <SalonHeader title="POS System">
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

      <div className="container mx-auto p-6 lg:p-0 lg:flex lg:flex-1 lg:overflow-hidden lg:max-w-none">
        <div className="grid gap-6 lg:flex lg:flex-1 lg:gap-0 lg:overflow-hidden lg:w-full">
          {/* Left: Services Selection */}
          <div className="lg:col-span-2 space-y-6 lg:flex-1 lg:overflow-y-auto lg:p-6">
            {/* Client Search */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Select Client</h2>
              <div className="relative">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search by name or phone..."
                    className="w-full pl-10 pr-9 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent min-h-[48px]"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoComplete="off"
                  />
                  {clientSearching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <svg className="w-4 h-4 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 6 12 6z" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                      </svg>
                    </div>
                  )}
                  {searchQuery && !clientSearching && (
                    <button
                      onClick={() => { setSearchQuery(''); setClients([]); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Search Results Dropdown */}
                {(clients.length > 0 || (searchQuery.length >= 2 && !clientSearching)) && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    {clients.length > 0 ? clients.map((client) => (
                      <button
                        key={client.id}
                        onClick={() => selectClient(client)}
                        className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{client.name}</p>
                          <p className="text-sm text-gray-500">{client.phone}</p>
                        </div>
                      </button>
                    )) : (
                      <div className="px-4 py-3 text-sm text-gray-400 italic">No clients found for "{searchQuery}"</div>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowNewClientModal(true)}
                className="mt-3 text-sm text-brand-primary hover:underline"
              >
                + New Client
              </button>

              {selectedClient && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="font-semibold text-gray-900">{selectedClient.name}</p>
                  <p className="text-sm text-gray-600">{selectedClient.phone}</p>
                  <button
                    onClick={() => setSelectedClient(null)}
                    className="mt-2 text-sm text-gray-600 hover:text-gray-900"
                  >
                    Change Client
                  </button>
                </div>
              )}
            </div>

            {/* Services Grid by Category */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Select Items</h2>
                <button
                  onClick={() => setShowNewServiceModal(true)}
                  className="text-sm text-brand-primary hover:underline"
                >
                  + New Item
                </button>
              </div>

              {/* Category Filter Tabs */}
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-5">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      selectedCategory === 'all'
                        ? 'bg-gray-800 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    All
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.name)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        selectedCategory === cat.name
                          ? 'text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      style={
                        selectedCategory === cat.name
                          ? { backgroundColor: cat.color }
                          : {}
                      }
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              )}
              
              {servicesLoading ? (
                <div className="space-y-4 animate-pulse">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="grid md:grid-cols-2 gap-4">
                      <div className="h-20 bg-gray-100 rounded-xl" />
                      <div className="h-20 bg-gray-100 rounded-xl" />
                    </div>
                  ))}
                </div>
              ) : filteredByCategory.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p>No items available</p>
                  <p className="text-sm mt-2">Add items in Menu</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedServices).map(([category, categoryServices]) => (
                    <div key={category}>
                      <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">
                        {category}
                      </h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        {categoryServices.map((service) => (
                          <div key={service.id} className="service-card">
                            <div>
                              <h4 className="font-semibold text-gray-900">{service.name}</h4>
                            </div>
                            <div className="flex items-center justify-between mt-3">
                              <span className="text-lg font-bold text-brand-primary">
                                {formatCurrency(service.price)}
                              </span>
                              <button
                                onClick={() => addToCart(service)}
                                className="btn-primary text-sm"
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Cart & Checkout */}
          <div className="space-y-6 lg:w-96 lg:flex-shrink-0 lg:border-l lg:border-gray-200 lg:bg-white lg:overflow-y-auto lg:p-6">
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Cart</h2>
              
              {cart.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p>No services selected</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => {
                    const displayPrice = item.customPrice ?? item.service.price;
                    const hasDiscount = item.customPrice !== undefined && item.customPrice < item.service.price;
                    return (
                    <div
                      key={item.service.id}
                      className="p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{item.service.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {hasDiscount && (
                              <span className="text-xs text-gray-400 line-through">{formatCurrency(item.service.price)}</span>
                            )}
                            {editingPriceId === item.service.id ? (
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={editingPriceValue}
                                onChange={(e) => setEditingPriceValue(e.target.value.replace(/[^0-9]/g, ''))}
                                onBlur={() => {
                                  const val = parseFloat(editingPriceValue);
                                  if (!isNaN(val) && val >= 0) updateCustomPrice(item.service.id, val);
                                  setEditingPriceId(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const val = parseFloat(editingPriceValue);
                                    if (!isNaN(val) && val >= 0) updateCustomPrice(item.service.id, val);
                                    setEditingPriceId(null);
                                  }
                                  if (e.key === 'Escape') setEditingPriceId(null);
                                }}
                                autoFocus
                                className="w-24 text-sm px-2 py-0.5 border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                              />
                            ) : (
                              <button
                                onClick={() => { setEditingPriceId(item.service.id); setEditingPriceValue(String(displayPrice)); }}
                                className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600 group"
                                title="Click to edit price"
                              >
                                <span>{formatCurrency(displayPrice)} × {item.quantity}</span>
                                <svg className="w-3 h-3 opacity-40 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                            )}
                          </div>
                          {hasDiscount && (
                            <span className="text-xs font-medium text-green-600">-{formatCurrency((item.service.price - item.customPrice!) * item.quantity)} discount • no points</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => updateQuantity(item.service.id, item.quantity - 1)}
                            className="w-7 h-7 flex items-center justify-center bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm"
                          >
                            -
                          </button>
                          <span className="w-6 text-center font-medium text-sm">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.service.id, item.quantity + 1)}
                            className="w-7 h-7 flex items-center justify-center bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm"
                          >
                            +
                          </button>
                          <button
                            onClick={() => removeFromCart(item.service.id)}
                            className="ml-1 text-red-500 hover:text-red-700"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}

              {/* Add-ons & Extras */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <button
                  onClick={() => setAddonsExpanded(p => !p)}
                  className="flex items-center justify-between w-full text-sm font-medium text-gray-700 mb-2"
                >
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Add-ons & Extras
                    {cartAddons.length > 0 && <span className="ml-1 bg-brand-primary text-white text-xs rounded-full px-1.5 py-0.5">{cartAddons.length}</span>}
                  </span>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${addonsExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>

                {addonsExpanded && (
                  <>
                    {availableAddons.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-xs text-gray-400 mb-2">No add-ons set up yet</p>
                        <button
                          onClick={() => setQuickAddonModal(true)}
                          className="text-xs font-medium text-brand-primary border border-brand-primary/30 px-3 py-1.5 rounded-lg hover:bg-brand-primary/5"
                        >
                          + Create add-on
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-1.5 mb-2">
                        {availableAddons.map(addon => {
                          const inCart = cartAddons.find(c => c.addon.id === addon.id);
                          return (
                            <button
                              key={addon.id}
                              onClick={() => addAddon(addon)}
                              className={`text-left px-2.5 py-2 rounded-lg border text-xs transition-colors ${
                                inCart
                                  ? 'border-brand-primary bg-brand-primary/5 text-brand-primary'
                                  : 'border-gray-200 hover:border-brand-primary hover:bg-gray-50 text-gray-700'
                              }`}
                            >
                              <p className="font-medium truncate">{addon.name}</p>
                              <p className="text-gray-400 mt-0.5">{formatCurrency(addon.price)}</p>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {availableAddons.length > 0 && (
                      <button
                        onClick={() => setQuickAddonModal(true)}
                        className="text-xs text-brand-primary font-medium hover:underline w-full text-left mb-2"
                      >
                        + New add-on
                      </button>
                    )}

                    {cartAddons.length > 0 && (
                      <div className="space-y-1.5 mt-1">
                        {cartAddons.map(item => {
                          const addonEditKey = `addon:${item.addon.id}`;
                          const addonDisplayPrice = item.customPrice ?? item.addon.price;
                          return (
                          <div key={item.addon.id} className="flex items-center justify-between bg-brand-primary/5 rounded-lg px-2.5 py-2">
                            <span className="text-xs font-medium text-gray-800">{item.addon.name}</span>
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => updateAddonQty(item.addon.id, item.quantity - 1)} className="w-5 h-5 text-xs border border-gray-300 bg-white rounded flex items-center justify-center hover:bg-gray-50">−</button>
                              <span className="text-xs w-4 text-center font-medium">{item.quantity}</span>
                              <button onClick={() => updateAddonQty(item.addon.id, item.quantity + 1)} className="w-5 h-5 text-xs border border-gray-300 bg-white rounded flex items-center justify-center hover:bg-gray-50">+</button>
                              {editingPriceId === addonEditKey ? (
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={editingPriceValue}
                                  onChange={e => setEditingPriceValue(e.target.value.replace(/[^0-9]/g, ''))}
                                  onBlur={() => {
                                    const val = parseFloat(editingPriceValue);
                                    if (!isNaN(val) && val >= 0) updateAddonCustomPrice(item.addon.id, val);
                                    setEditingPriceId(null);
                                  }}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      const val = parseFloat(editingPriceValue);
                                      if (!isNaN(val) && val >= 0) updateAddonCustomPrice(item.addon.id, val);
                                      setEditingPriceId(null);
                                    }
                                    if (e.key === 'Escape') setEditingPriceId(null);
                                  }}
                                  autoFocus
                                  className="w-20 text-xs px-1.5 py-0.5 border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-right"
                                />
                              ) : (
                                <button
                                  onClick={() => { setEditingPriceId(addonEditKey); setEditingPriceValue(String(addonDisplayPrice)); }}
                                  className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-blue-600 group ml-1"
                                  title="Click to edit price"
                                >
                                  {item.customPrice !== undefined && item.customPrice !== item.addon.price && (
                                    <span className="text-gray-300 line-through mr-0.5">{formatCurrency(item.addon.price)}</span>
                                  )}
                                  <span className="w-16 text-right">{formatCurrency(addonDisplayPrice * item.quantity)}</span>
                                  <svg className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Total */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                {calculateTotalDiscount() > 0 && (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-500 text-sm">Original Price</span>
                      <span className="text-sm text-gray-400 line-through">{formatCurrency(calculateTotal() + calculateTotalDiscount())}</span>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-green-600 font-medium text-sm">Total Discount</span>
                      <span className="font-semibold text-green-600 text-sm">-{formatCurrency(calculateTotalDiscount())}</span>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold">{formatCurrency(calculateTotal())}</span>
                </div>
                {calculateAddonsTotal() > 0 && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-600 text-sm">Add-ons</span>
                    <span className="font-semibold text-sm">{formatCurrency(calculateAddonsTotal())}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xl font-bold">
                  <span>Total</span>
                  <span className="text-brand-primary">{formatCurrency(calculateTotal() + calculateAddonsTotal())}</span>
                </div>
              </div>

              {/* Payment Breakdown */}
              <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment Details</p>

                {/* Checkout Discount */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Discount (optional)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">UGX</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={checkoutDiscount}
                      onChange={e => setCheckoutDiscount(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="0"
                      className="w-full pl-11 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Amount Paid */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Amount Paid</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">UGX</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={amountPaid}
                      onChange={e => setAmountPaid(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder={formatCurrency(Math.max(0, (calculateTotal() + calculateAddonsTotal()) - (Number(checkoutDiscount) || 0))).replace('UGX', '').trim()}
                      className="w-full pl-11 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Leave blank to record as fully paid</p>
                </div>

                {/* Live balance preview */}
                {(() => {
                  const grandTotal = calculateTotal() + calculateAddonsTotal();
                  const disc = Math.max(0, Number(checkoutDiscount) || 0);
                  const due = Math.max(0, grandTotal - disc);
                  const paid = amountPaid !== '' ? Math.max(0, Math.min(Number(amountPaid) || 0, due)) : due;
                  const bal = Math.max(0, due - paid);
                  if (disc === 0 && bal === 0 && amountPaid === '') return null;
                  return (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1.5 text-sm">
                      {disc > 0 && (
                        <>
                          <div className="flex justify-between text-gray-500">
                            <span>Subtotal</span><span>{formatCurrency(grandTotal)}</span>
                          </div>
                          <div className="flex justify-between text-green-600">
                            <span>Discount</span><span>−{formatCurrency(disc)}</span>
                          </div>
                          <div className="flex justify-between font-semibold border-t border-gray-200 pt-1.5">
                            <span>Amount Due</span><span>{formatCurrency(due)}</span>
                          </div>
                        </>
                      )}
                      {amountPaid !== '' && (
                        <div className="flex justify-between text-gray-600">
                          <span>Amount Paid</span><span>{formatCurrency(paid)}</span>
                        </div>
                      )}
                      {bal > 0 ? (
                        <div className="flex justify-between font-bold text-red-600 border-t border-red-200 pt-1.5">
                          <span>Balance Due</span><span>{formatCurrency(bal)}</span>
                        </div>
                      ) : (
                        <div className="flex justify-between font-semibold text-green-600 border-t border-green-200 pt-1.5">
                          <span>Paid in Full</span><span>✓</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Backdate picker — owner/admin only */}
              {(user?.role === 'owner' || user?.role === 'admin') && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Transaction Date</label>
                  <input
                    type="date"
                    value={transactionDate}
                    max={new Date().toISOString().split('T')[0]}
                    min={new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                    onChange={(e) => setTransactionDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {transactionDate !== new Date().toISOString().split('T')[0] && (
                    <p className="text-xs text-amber-600 mt-1">⚠ Backdating to {transactionDate}</p>
                  )}
                </div>
              )}

              {/* Payment Buttons */}
              <div className="mt-6 space-y-3">
                <button
                  onClick={() => processPayment('mtn_mobile_money')}
                  disabled={cart.length === 0 || processingPayment}
                  className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processingPayment ? 'Processing...' : 'Pay with MTN Mobile Money'}
                </button>
                <button
                  onClick={() => processPayment('airtel_money')}
                  disabled={cart.length === 0 || processingPayment}
                  className="btn-secondary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Pay with Airtel Money
                </button>
                <button
                  onClick={() => processPayment('cash')}
                  disabled={cart.length === 0 || processingPayment}
                  className="btn-secondary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cash Payment
                </button>

                {/* Record Balance Payment — secondary action */}
                <div className="pt-3 border-t border-gray-100">
                  <button
                    onClick={openBalanceModal}
                    className="w-full text-sm font-medium text-gray-600 hover:text-brand-primary flex items-center justify-center gap-2 py-2 rounded-lg border border-gray-200 hover:border-brand-primary/40 hover:bg-brand-primary/5 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Record Balance Payment
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Add-on Create Modal */}
      {quickAddonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={e => { if (e.target === e.currentTarget) { setQuickAddonModal(false); setQuickAddonForm({ name: '', price: '' }); } }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900">New Add-on</h3>
              <p className="text-xs text-gray-400 mt-0.5">Will be saved and added to this sale</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input
                value={quickAddonForm.name}
                onChange={e => setQuickAddonForm(p => ({ ...p, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && createQuickAddon()}
                placeholder="e.g. Extra Jelly, Scalp Massage…"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Price (UGX)</label>
              <input
                type="number"
                min="0"
                value={quickAddonForm.price}
                onChange={e => setQuickAddonForm(p => ({ ...p, price: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && createQuickAddon()}
                placeholder="0"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setQuickAddonModal(false); setQuickAddonForm({ name: '', price: '' }); }} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={createQuickAddon} disabled={savingQuickAddon || !quickAddonForm.name.trim()} className="flex-1 btn-primary text-sm disabled:opacity-50">
                {savingQuickAddon ? 'Adding…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Client Modal */}
      {showNewClientModal && (
        <NewClientModal
          onClose={() => setShowNewClientModal(false)}
          onClientCreated={(client) => {
            setSelectedClient(client);
            setShowNewClientModal(false);
            toast.success('Client created successfully');
          }}
        />
      )}

      {/* New Service Modal */}
      {showNewServiceModal && (
        <NewServiceModal
          onClose={() => setShowNewServiceModal(false)}
          onServiceCreated={() => {
            setShowNewServiceModal(false);
            loadServices();
            toast.success('Service created successfully');
          }}
        />
      )}

      {/* Transaction Summary Modal */}
      {completedTransaction && (
        <TransactionSummaryModal
          transaction={completedTransaction}
          onClose={() => setCompletedTransaction(null)}
          formatCurrency={formatCurrency}
        />
      )}

      {/* Record Balance Payment Modal */}
      {showBalanceModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowBalanceModal(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h3 className="font-semibold text-gray-900">Record Balance Payment</h3>
                <p className="text-xs text-gray-400 mt-0.5">Collect payment for a client's outstanding balance</p>
              </div>
              <button onClick={() => setShowBalanceModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="overflow-y-auto p-6 space-y-5 flex-1">
              {/* Client search */}
              {!selectedBalanceClient ? (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Search Client</label>
                  <input
                    type="text"
                    value={balanceSearch}
                    onChange={e => setBalanceSearch(e.target.value)}
                    placeholder="Type client name or phone…"
                    autoFocus
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {balanceSearching && <p className="text-xs text-gray-400 mt-2">Searching…</p>}
                  {!balanceSearching && balanceClients.length === 0 && balanceSearch !== '' && (
                    <p className="text-xs text-gray-400 mt-2">No clients with outstanding balance found</p>
                  )}
                  {!balanceSearching && balanceClients.length === 0 && balanceSearch === '' && (
                    <p className="text-xs text-gray-400 mt-2">Start typing to search, or see all clients with balance below</p>
                  )}
                  <div className="mt-3 space-y-2">
                    {balanceClients.map(client => (
                      <button
                        key={client.id}
                        onClick={() => {
                          setSelectedBalanceClient(client);
                          if (client.outstanding_visits?.length === 1) {
                            setSelectedBalanceVisit(client.outstanding_visits[0]);
                            setBalancePaymentAmount(String(client.outstanding_visits[0].balance_due));
                          }
                        }}
                        className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 hover:border-brand-primary hover:bg-brand-primary/5 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{client.name}</p>
                            <p className="text-xs text-gray-400">{client.phone}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-red-600">{formatCurrency(Number(client.total_balance))}</p>
                            <p className="text-xs text-gray-400">{client.outstanding_visits?.length || 0} unpaid</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {/* Selected client header */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{selectedBalanceClient.name}</p>
                      <p className="text-xs text-gray-400">{selectedBalanceClient.phone}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-600">{formatCurrency(Number(selectedBalanceClient.total_balance))} owed</p>
                      <button onClick={() => { setSelectedBalanceClient(null); setSelectedBalanceVisit(null); setBalancePaymentAmount(''); }} className="text-xs text-brand-primary hover:underline">Change</button>
                    </div>
                  </div>

                  {/* Visit selector (if multiple) */}
                  {(selectedBalanceClient.outstanding_visits?.length || 0) > 1 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-2">Select Visit</label>
                      <div className="space-y-2">
                        {selectedBalanceClient.outstanding_visits.map(v => (
                          <button
                            key={v.id}
                            onClick={() => { setSelectedBalanceVisit(v); setBalancePaymentAmount(String(v.balance_due)); }}
                            className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${selectedBalanceVisit?.id === v.id ? 'border-brand-primary bg-brand-primary/5' : 'border-gray-200 hover:border-brand-primary/50'}`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs font-medium text-gray-900">{v.receipt_number}</p>
                                <p className="text-xs text-gray-400">{new Date(v.created_at).toLocaleDateString('en-UG', { dateStyle: 'medium' })}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-500">Total: {formatCurrency(Number(v.total_amount))}</p>
                                <p className="text-sm font-bold text-red-600">Owed: {formatCurrency(Number(v.balance_due))}</p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Show the single visit summary */}
                  {selectedBalanceVisit && (selectedBalanceClient.outstanding_visits?.length || 0) === 1 && (
                    <div className="p-3 rounded-xl border border-gray-200 bg-gray-50 text-sm">
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-500">Receipt</span>
                        <span className="font-medium">{selectedBalanceVisit.receipt_number}</span>
                      </div>
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-500">Visit Date</span>
                        <span>{new Date(selectedBalanceVisit.created_at).toLocaleDateString('en-UG', { dateStyle: 'medium' })}</span>
                      </div>
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-500">Total</span>
                        <span>{formatCurrency(Number(selectedBalanceVisit.total_amount))}</span>
                      </div>
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-500">Paid so far</span>
                        <span className="text-green-600">{formatCurrency(Number(selectedBalanceVisit.amount_paid))}</span>
                      </div>
                      <div className="flex justify-between font-bold border-t border-gray-200 pt-1 mt-1">
                        <span className="text-red-600">Outstanding</span>
                        <span className="text-red-600">{formatCurrency(Number(selectedBalanceVisit.balance_due))}</span>
                      </div>
                    </div>
                  )}

                  {/* Amount + method */}
                  {selectedBalanceVisit && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Amount Paying Now</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">UGX</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={balancePaymentAmount}
                            onChange={e => setBalancePaymentAmount(e.target.value.replace(/[^0-9]/g, ''))}
                            className="w-full pl-11 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        {balancePaymentAmount !== '' && Number(balancePaymentAmount) > 0 && (
                          <p className={`text-xs mt-1 font-medium ${Math.max(0, Number(selectedBalanceVisit.balance_due) - Number(balancePaymentAmount)) === 0 ? 'text-green-600' : 'text-amber-600'}`}>
                            Remaining after this: {formatCurrency(Math.max(0, Number(selectedBalanceVisit.balance_due) - Number(balancePaymentAmount)))}
                            {Math.max(0, Number(selectedBalanceVisit.balance_due) - Number(balancePaymentAmount)) === 0 ? ' ✓ Fully cleared' : ''}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[['cash', 'Cash'], ['mtn_mobile_money', 'MTN MoMo'], ['airtel_money', 'Airtel']].map(([val, label]) => {
                            const isSelected = balancePaymentMethod === val;
                            const salonColor = salon?.theme_primary_color || '#6366f1';
                            return (
                              <button
                                key={val}
                                onClick={() => setBalancePaymentMethod(val)}
                                className="py-2 px-3 text-xs rounded-lg border font-medium transition-colors"
                                style={
                                  isSelected
                                    ? { borderColor: salonColor, backgroundColor: salonColor + '15', color: salonColor }
                                    : { borderColor: '#e5e7eb', color: '#4b5563' }
                                }
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {selectedBalanceVisit && (
              <div className="px-6 py-4 border-t bg-gray-50 flex gap-3">
                <button onClick={() => setShowBalanceModal(false)} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-white">Cancel</button>
                <button
                  onClick={processBalancePayment}
                  disabled={processingBalance || !balancePaymentAmount || Number(balancePaymentAmount) <= 0}
                  className="flex-1 btn-primary text-sm disabled:opacity-50"
                >
                  {processingBalance ? 'Recording…' : 'Record Payment'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// New Client Modal Component
function NewClientModal({
  onClose,
  onClientCreated,
}: {
  onClose: () => void;
  onClientCreated: (client: Client) => void;
}) {
  const { bar: salon } = useBar();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const brandColor = salon?.theme_primary_color || '#E31C23';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, phone,
          email: email || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create client');
      }

      const client = await response.json();
      onClientCreated(client);
    } catch (error: any) {
      toast.error(error.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 pb-4 border-b">
          <h3 className="text-lg font-semibold">Add New Client</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name *
              </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number *
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="+256 700 000 000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email (Optional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="john@example.com"
            />
          </div>

          </div>

          <div className="flex gap-3 p-6 pt-4 border-t bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 bg-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: brandColor }}
            >
              {submitting ? 'Creating...' : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// New Item Modal Component
function NewServiceModal({
  onClose,
  onServiceCreated,
}: {
  onClose: () => void;
  onServiceCreated: () => void;
}) {
  const { bar: salon } = useBar();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [categoryOptions, setCategoryOptions] = useState<{ id: string; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((data) => {
        setCategoryOptions(data);
        if (data.length > 0) setCategory(data[0].name);
      })
      .catch(() => {});
  }, []);

  const brandColor = salon?.theme_primary_color || '#E31C23';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          price: parseFloat(price),
          category,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create item');
      }

      onServiceCreated();
    } catch (error: any) {
      toast.error(error.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 pb-4 border-b">
          <h3 className="text-lg font-semibold">Add New Item</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Item Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Tusker Lager"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Price (UGX) *
            </label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="25000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {categoryOptions.length > 0 ? (
                categoryOptions.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))
              ) : (
                <option value="Other">Other</option>
              )}
            </select>
          </div>
          </div>

          <div className="flex gap-3 p-6 pt-4 border-t bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 bg-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: brandColor }}
            >
              {submitting ? 'Adding...' : 'Add to Menu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


