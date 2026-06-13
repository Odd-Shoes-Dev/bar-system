// Core database types for Bar Management System

export interface Bar {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  logo_url?: string;
  slogan?: string;
  subdomain?: string;
  custom_domain?: string;
  theme_primary_color: string;
  theme_secondary_color: string;
  is_active: boolean;
  subscription_plan: 'trial' | 'basic' | 'pro' | 'enterprise';
  subscription_expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  bar_id: string;
  name: string;
  phone: string;
  email?: string;
  total_visits: number;
  total_spent: number;
  last_visit?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Keep Client as alias for backward compat with existing API responses
export type Client = Customer;

export interface MenuItem {
  id: string;
  bar_id: string;
  name: string;
  description?: string;
  price: number;
  duration_minutes: number;
  category?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Keep Service as alias for backward compat with existing API responses
export type Service = MenuItem;

export interface MenuCategory {
  id: string;
  bar_id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  item_count?: number;
  service_count?: number; // DB column alias
}

// Keep ServiceCategory as alias for backward compat
export type ServiceCategory = MenuCategory;

export interface Order {
  id: string;
  bar_id: string;
  client_id: string;
  user_id?: string;
  receipt_number: string;
  total_amount: number;
  payment_method: 'mtn' | 'airtel' | 'cash';
  payment_status: 'pending' | 'completed' | 'failed';
  transaction_id?: string;
  points_earned: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  branch_id?: string;
  branch_name?: string;
  // Relations
  client?: Customer;
  staff?: Staff;
  items?: OrderItem[];
  services?: OrderItem[]; // DB alias
  visit_services?: OrderItem[]; // DB alias
}

// Keep Visit as alias for backward compat with existing API responses
export type Visit = Order;

export interface OrderItem {
  id: string;
  visit_id: string;
  service_id: string;
  quantity: number;
  price: number;
  created_at: string;
  service?: MenuItem;
}

// Keep VisitService as alias
export type VisitService = OrderItem;

export interface Staff {
  id: string;
  bar_id: string;
  name: string;
  phone: string;
  role: 'owner' | 'manager' | 'bartender' | 'cashier' | 'viewer';
  email?: string;
  is_active: boolean;
  daily_sales_target?: number;
  daily_sales?: number;
  commission_rate?: number;
  created_at: string;
  updated_at: string;
}

// ─── Dashboard ────────────────────────────────────────────────
export interface DashboardStats {
  todaySales: number;
  totalCustomers: number;
  todayOrders: number;
  topItem: {
    name: string;
    count: number;
  } | null;
  averageSpend: number;
  // Keep old keys for backward compat with existing dashboard API
  totalClients?: number;
  todayVisits?: number;
  topService?: { name: string; count: number } | null;
}

// ─── POS types ─────────────────────────────────────────────────
export interface CartItem {
  service: MenuItem; // DB field name kept as `service`
  quantity: number;
}

export interface CheckoutData {
  client: Customer;
  items: CartItem[];
  total: number;
  paymentMethod: 'mtn' | 'airtel' | 'cash';
  phoneNumber?: string;
}
