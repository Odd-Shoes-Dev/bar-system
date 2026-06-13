# 📚 Copy-Paste Reference - Business System Patterns

Use these proven patterns from your business system to speed up salon system development.

---

## 🔐 API Route Authentication Pattern

**Source:** `business-system/src/app/api/dashboard/stats/route.ts`

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get salon_id (in salon system, different from company_id)
    const { data: userData, error: salonError } = await supabase
      .from('staff') // or however you link users to salons
      .select('salon_id')
      .eq('user_id', user.id)
      .single();

    if (salonError || !userData) {
      return NextResponse.json({ error: 'No salon found for user' }, { status: 403 });
    }

    const salonId = userData.salon_id;

    // 3. Query data filtered by salon_id
    const { data, error } = await supabase
      .from('your_table')
      .select('*')
      .eq('salon_id', salonId); // ALWAYS filter by salon_id

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

**Use for:**
- `/api/clients/route.ts`
- `/api/services/route.ts`
- `/api/visits/route.ts`
- `/api/dashboard/stats/route.ts`

---

## 📝 GET with Query Parameters

**Source:** `business-system/src/app/api/inventory/route.ts`

```typescript
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    // Get query parameters
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('services')
      .select('*', { count: 'exact' })
      .eq('salon_id', salonId)
      .order('name');

    // Apply filters
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (category) {
      query = query.eq('category', category);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

**Use for:**
- `/api/clients?search=phone`
- `/api/services?category=grooming`
- `/api/visits?page=1&limit=10`

---

## ➕ POST - Create Resource

**Source:** `business-system/src/app/api/customers/route.ts`

```typescript
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Auth (see pattern above)
    // ...

    // Validate required fields
    if (!body.name || !body.phone) {
      return NextResponse.json(
        { error: 'Name and phone are required' },
        { status: 400 }
      );
    }

    // Create record
    const { data, error } = await supabase
      .from('clients')
      .insert({
        salon_id: salonId, // ALWAYS include salon_id
        name: body.name,
        phone: body.phone,
        email: body.email,
        loyalty_points: 0,
        total_visits: 0,
        total_spent: 0,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

**Use for:**
- `POST /api/clients` - Create client
- `POST /api/visits` - Create visit/transaction
- `POST /api/services` - Create service

---

## 🔄 PUT - Update Resource

**Source:** `business-system/src/app/api/customers/[id]/route.ts`

```typescript
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await context.params;
    const body = await request.json();

    // Auth (see pattern above)
    // ...

    // Update record (with salon_id check for security)
    const { data, error } = await supabase
      .from('clients')
      .update({
        name: body.name,
        phone: body.phone,
        email: body.email,
        notes: body.notes,
      })
      .eq('id', id)
      .eq('salon_id', salonId) // SECURITY: Ensure belongs to this salon
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

**Use for:**
- `PUT /api/clients/[id]` - Update client
- `PUT /api/services/[id]` - Update service

---

## 🗑️ DELETE - Remove Resource

```typescript
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await context.params;

    // Auth (see pattern above)
    // ...

    // Delete record
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id)
      .eq('salon_id', salonId); // SECURITY: Ensure belongs to this salon

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

---

## 📊 Complex Query with Joins

**Source:** `business-system/src/app/api/dashboard/stats/route.ts`

```typescript
// Get visits with related data
const { data: visits } = await supabase
  .from('visits')
  .select(`
    *,
    client:clients(id, name, phone),
    staff:staff(id, name),
    services:visit_services(
      *,
      service:services(name, price)
    )
  `)
  .eq('salon_id', salonId)
  .order('created_at', { ascending: false })
  .limit(10);
```

**Use for:**
- Getting visits with client info
- Getting visits with services
- Dashboard queries

---

## 🔢 Aggregations and Stats

```typescript
// Get today's sales total
const today = new Date().toISOString().split('T')[0];

const { data: todayVisits } = await supabase
  .from('visits')
  .select('total_amount')
  .eq('salon_id', salonId)
  .eq('payment_status', 'completed')
  .gte('created_at', today);

const todaySales = todayVisits?.reduce((sum, visit) => sum + visit.total_amount, 0) || 0;

// Count unique clients
const { count: totalClients } = await supabase
  .from('clients')
  .select('*', { count: 'exact', head: true })
  .eq('salon_id', salonId);

// Top service
const { data: topServices } = await supabase
  .from('visit_services')
  .select(`
    service_id,
    service:services(name),
    count:id.count()
  `)
  .eq('services.salon_id', salonId)
  .order('count', { ascending: false })
  .limit(1);
```

**Use for:**
- `/api/dashboard/stats`

---

## 🎨 React Component Patterns

### Loading State

```typescript
const [loading, setLoading] = useState(true);
const [data, setData] = useState(null);

useEffect(() => {
  loadData();
}, []);

async function loadData() {
  setLoading(true);
  try {
    const res = await fetch('/api/clients');
    const json = await res.json();
    setData(json.data);
  } catch (error) {
    console.error('Failed to load:', error);
  } finally {
    setLoading(false);
  }
}

if (loading) {
  return <div>Loading...</div>;
}
```

### Form Handling with React Hook Form

```typescript
import { useForm } from 'react-hook-form';

const { register, handleSubmit, formState: { errors } } = useForm();

const onSubmit = async (data: any) => {
  const res = await fetch('/api/clients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  if (res.ok) {
    toast.success('Client created!');
  }
};

return (
  <form onSubmit={handleSubmit(onSubmit)}>
    <input {...register('name', { required: true })} />
    {errors.name && <span>Name is required</span>}
    <button type="submit">Submit</button>
  </form>
);
```

### Toast Notifications

```typescript
import toast from 'react-hot-toast';

// Success
toast.success('Payment successful!');

// Error
toast.error('Payment failed!');

// Loading (async)
const promise = processPayment();
toast.promise(promise, {
  loading: 'Processing payment...',
  success: 'Payment successful!',
  error: 'Payment failed!',
});
```

---

## 🎯 Quick File Creation Checklist

When creating a new API route:

```typescript
// src/app/api/[resource]/route.ts

✅ Import createClient from supabase/server
✅ Add authentication check
✅ Get salon_id
✅ Filter all queries by salon_id
✅ Handle errors with try/catch
✅ Return proper HTTP status codes
✅ Use TypeScript types
```

---

## 🚀 Speed Tips

1. **Copy entire API file** from business system, then:
   - Change table names (customers → clients)
   - Change company_id → salon_id
   - Adjust fields to match salon schema

2. **Reuse components** from business system:
   - Button components
   - Input components
   - Card components
   - Modal components

3. **Copy utility functions**:
   - formatCurrency (already adapted for UGX)
   - formatDate
   - formatPhoneNumber

---

Good luck! You have everything you need. Just copy, adapt, and test! 🎉
