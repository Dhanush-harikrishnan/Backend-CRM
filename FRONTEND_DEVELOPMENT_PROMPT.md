# 🎨 Frontend Development Prompt - Inventory & Billing System

## Project Overview

Build a **production-ready React/Next.js frontend** for an Inventory & Billing System for small businesses in India. The backend REST API is already complete and documented. Your task is to create an intuitive, responsive, and secure frontend that integrates seamlessly with the existing API.

---

## 🎯 Project Context

**Business Use Case:** Point-of-Sale (POS) and Inventory Management for small retail shops in India
- Handles real money transactions
- Manages physical inventory
- Supports GST billing
- Multiple payment modes (Cash, UPI, Card, Credit)
- Walk-in customers (Guest) and registered customers

---

## 📚 Backend API Reference

The backend API is fully functional with comprehensive documentation:

### Available Documentation:
- **API Documentation:** `README.md` - All endpoints, request/response formats
- **API Examples:** `API_EXAMPLES.md` - Copy-paste ready cURL examples
- **Authentication:** JWT-based with role-based access (ADMIN/STAFF)
- **Base URL:** `http://localhost:5000/api` (development)

### Key API Endpoints:
```
Authentication:
- POST /api/auth/login
- POST /api/auth/register
- GET /api/auth/profile

Customers:
- GET/POST/PUT/DELETE /api/customers

Products:
- GET/POST/PUT/DELETE /api/products
- GET /api/products/low-stock
- PATCH /api/products/:id/stock

Invoices:
- POST /api/invoices (creates invoice, deducts stock atomically)
- GET /api/invoices
- GET /api/invoices/:id
- GET /api/invoices/summary

Payments (Stripe Integration):
- GET /api/payments/config (get publishable key)
- POST /api/payments/create-intent (create payment intent)
- GET /api/payments/intent/:id (retrieve payment intent)
- POST /api/payments/confirm/:id (confirm payment)
- POST /api/payments/refund (create refund - Admin only)
- POST /api/payments/webhook (Stripe webhook handler)
```

**Important:** Review `API_EXAMPLES.md` and `STRIPE_INTEGRATION.md` for complete request/response formats.

---

## 🛠️ Tech Stack Requirements

### Core Framework (Choose One):
**Option A - Next.js 14+ (Recommended)**
- App Router with Server Components
- TypeScript (strict mode)
- API integration with Server Actions or client components
- Tailwind CSS for styling

**Option B - React + Vite**
- React 18+
- TypeScript (strict mode)
- React Router for navigation
- Tailwind CSS for styling

### Essential Libraries:

#### State Management:
- **Zustand** or **React Context** for global state (auth, cart)
- **React Query (TanStack Query)** for server state management (API calls)

#### Form Handling:
- **React Hook Form** for forms
- **Zod** for validation (same schemas as backend)

#### UI Components:
- **shadcn/ui** or **Radix UI** (accessible, customizable)
- **Tailwind CSS** for styling
- **Lucide React** for icons

#### API Integration:
- **Axios** for HTTP requests
- Custom API client with interceptors for JWT token

#### Data Display:
- **TanStack Table** for data tables (products, invoices, customers)
- **Recharts** or **Chart.js** for dashboard analytics

#### PDF Generation:
- **jsPDF** or **react-pdf** for invoice printing

#### Payment Processing:
- **@stripe/stripe-js** for Stripe integration
- **@stripe/react-stripe-js** for React components

#### Utilities:
- **date-fns** for date formatting
- **clsx** for conditional classes

---

## 🎨 Design Requirements

### Overall Style:
- **Modern, Clean, Professional**
- **Mobile-responsive** (works on tablets for POS)
- **Fast and Intuitive** (staff should operate quickly)
- **Indian Context:** Support for Indian currency (₹), GST, mobile numbers

### Color Scheme (Suggested):
- Primary: Blue/Indigo (trust, professionalism)
- Success: Green (for completed sales)
- Warning: Orange/Yellow (low stock alerts)
- Danger: Red (errors, insufficient stock)
- Neutral: Gray scale for backgrounds

### Typography:
- Clean, readable fonts (Inter, Poppins, or system fonts)
- Proper font hierarchy

---

## 📱 Core Features to Implement

### 1. Authentication System

#### Login Page (`/login`)
- Email and password fields
- Remember me checkbox
- Error handling (invalid credentials)
- Redirect to dashboard on success
- Store JWT token securely (httpOnly cookie or localStorage with XSS protection)

#### Protected Routes
- Redirect to login if not authenticated
- Check token validity
- Handle token expiration (refresh or re-login)

#### Role-Based Access
- ADMIN: Full access
- STAFF: Limited access (no delete, no sales summary)

---

### 2. Dashboard (`/dashboard`)

#### Key Metrics Cards:
- Today's Sales (₹ amount)
- Total Invoices (count)
- Low Stock Products (count with alert badge)
- Top Selling Products

#### Charts:
- Sales trend (last 7 days)
- Payment mode distribution (Pie chart)
- Category-wise sales

#### Quick Actions:
- Button: "Create New Invoice"
- Button: "Add Product"
- Button: "Register Customer"

#### Recent Activity:
- List of last 10 invoices

---

### 3. Invoice Management

#### 3.1 Create Invoice Page (`/invoices/new`) ⭐ CRITICAL

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  New Invoice                                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Customer Selection:                               │
│  [Dropdown: Guest / Search Customers]             │
│  [ + Add New Customer ]                           │
│                                                     │
│  ─────────────────────────────────────────────     │
│                                                     │
│  Add Products:                                     │
│  [Search Product by Name/SKU]                     │
│                                                     │
│  Cart:                                             │
│  ┌───────────────────────────────────────────┐   │
│  │ Product      Qty  Price  Tax   Total      │   │
│  ├───────────────────────────────────────────┤   │
│  │ Rice (1KG)    2   ₹120   5%   ₹252      │   │
│  │ Tata Salt     5   ₹20    5%   ₹105      │   │
│  └───────────────────────────────────────────┘   │
│                                                     │
│  ─────────────────────────────────────────────     │
│                                                     │
│  Subtotal:              ₹340.00                   │
│  Tax:                   ₹17.00                    │
│  Discount: [Input]      ₹10.00                    │
│  ─────────────────────────────────────────────     │
│  Total:                 ₹347.00                   │
│                                                     │
│  Payment Mode: [CASH / UPI / CARD / CREDIT ▼]    │
│  Payment Status: [PAID ▼]                         │
│  [ Pay with Card (Stripe) ]                       │
│  Notes: [Optional text]                           │
│                                                     │
│  [ Cancel ]            [ Create Invoice ]         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Features:**
- Auto-complete product search
- Real-time stock availability check
- Automatic tax calculation
- Default customer: Guest (ID: 1)
- Quick customer registration inline
- Show warning if product stock is low
- **Critical:** Show error if insufficient stock before submission
- Clear cart after successful invoice creation
- **Stripe Integration:** Optional card payment button for CARD payment mode
- Show payment processing modal with Stripe Elements
- Option to print invoice immediately

**API Integration:**
```typescript
// Create invoice
POST /api/invoices
{
  "customerId": 1,
  "items": [
    {"productId": 1, "quantity": 2}
  ],
  "discount": 10,
  "paymentMode": "CASH",
  "paymentStatus": "PAID",
  "notes": "Optional"
}
```

**Error Handling:**
- Insufficient stock → Show modal with clear error message
- Invalid customer → Highlight field
- Empty cart → Disable submit button

#### 3.2 Invoice List Page (`/invoices`)

**Features:**
- Data table with columns: Invoice#, Date, Customer, Amount, Payment Mode, Status
- Filters: Date range, Customer, Payment Mode
- Pagination (20 per page)
- Search by invoice number
- Actions: View, Print
- Sort by date (newest first)

#### 3.3 Invoice Detail Page (`/invoices/:id`)

**Display:**
- Invoice header (number, date)
- Customer details
- Items table (product, qty, price, tax, total)
- Payment information
- Print button (generates PDF)

**Invoice PDF Format:**
```
┌────────────────────────────────────┐
│ [Shop Logo]       INVOICE          │
│                   INV-20260117-001 │
│ Shop Name                          │
│ Address                            │
│ GSTIN: XXXXX                       │
│                                    │
│ Bill To:                           │
│ Customer Name                      │
│ Mobile: 9876543210                │
│                                    │
│ Date: 17-Jan-2026    Time: 4:00 PM│
│                                    │
│ ─────────────────────────────────  │
│ Item        Qty  Price   Total     │
│ ─────────────────────────────────  │
│ Rice        2    ₹120    ₹240     │
│ Salt        5    ₹20     ₹100     │
│                                    │
│ ─────────────────────────────────  │
│ Subtotal:            ₹340.00      │
│ GST (5%):            ₹17.00       │
│ Discount:            ₹10.00       │
│ ─────────────────────────────────  │
│ Total:               ₹347.00      │
│                                    │
│ Payment: CASH                      │
│ Status: PAID                       │
│                                    │
│ Thank you for your business!       │
│                                    │
│ [Barcode: INV-20260117-001]       │
└────────────────────────────────────┘
```

---3.4 Stripe Card Payment (Optional Enhancement)

**When to Show:**
- Payment Mode = "CARD"
- Payment Status = "PENDING" or when user clicks "Pay with Card"

**Implementation:**

#### Step 1: Fetch Stripe Config
```typescript
// On app initialization
const { data: config } = await fetch('/api/payments/config');
const stripe = await loadStripe(config.publishableKey);
```

#### Step 2: Create Payment Intent
```typescript
// After invoice creation
const response = await fetch('/api/payments/create-intent', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ invoiceId: invoice.id })
});

const { clientSecret } = await response.json();
```

#### Step 3: Show Payment Modal
```tsx
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

function PaymentModal({ invoiceId, amount, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  const handlePayment = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Create payment intent
      const { data } = await api.post('/payments/create-intent', { invoiceId });
      
      // Confirm payment with card details
      const { error, paymentIntent } = await stripe.confirmCardPayment(
        data.clientSecret,
        {
          payment_method: {
            card: elements.getElement(CardElement),
          }
        }
      );

      if (error) {
        toast.error(error.message);
      } else if (paymentIntent.status === 'succeeded') {
        toast.success('Payment successful!');
        onSuccess(paymentIntent);
      }
    } catch (error) {
      toast.error('Payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handlePayment}>
      <div className="space-y-4">
        <div className="text-2xl font-bold">₹{amount}</div>
        <CardElement 
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': { color: '#aab7c4' },
              },
            },
          }}
        />
        <Button type="submit" disabled={!stripe || loading}>
          {loading ? 'Processing...' : `Pay ₹${amount}`}
        </Button>
      </div>
    </form>
  );
}
```

#### Payment Flow Diagram:
```
1. User creates invoice → Invoice saved with status PENDING
2. User clicks "Pay with Card" → Opens payment modal
3. Enter card details → Stripe validates
4. Submit payment → Creates PaymentIntent on backend
5. Backend processes → Returns clientSecret
6. Frontend confirms payment → Stripe charges card
7. Webhook updates invoice → Status changes to PAID
8. Show success message → Redirect to invoice detail
```

**Test Cards (Stripe Test Mode):**
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0027 6000 3184`
- Use any future date for expiry and any 3-digit CVC

**Error Handling:**
- Card declined → Show user-friendly error
- Insufficient funds → Suggest alternative payment
- Network error → Allow retry
- Payment timeout → Save invoice, allow payment later

**Backend Reference:**
See `STRIPE_INTEGRATION.md` for complete Stripe setup guide, webhook configuration, and security best practices.

---

### 

### 4. Product Management

#### 4.1 Product List Page (`/products`)

**Features:**
- Data table: SKU, Name, Category, Price, Stock, Status
- Filters: Category, Active/Inactive, Low Stock
- Search by name/SKU
- Badge: "Low Stock" if stock <= minStockAlert
- Actions: Edit, View, Deactivate
- Add Product button (Admin only)

#### 4.2 Add/Edit Product Page (`/products/new`, `/products/:id/edit`)

**Form Fields:**
- Product Name*
- SKU*
- Description
- Price*
- Stock Quantity*
- Min Stock Alert* (default: 5)
- Category (dropdown or input)
- Unit (PCS, KG, LITER, etc.)
- Tax Rate* (default: 18%, for GST)
- Active/Inactive toggle

**Validation:**
- All required fields
- Price > 0
- Stock >= 0
- Tax rate between 0-100

#### 4.3 Product Detail Page (`/products/:id`)

**Display:**
- Product information
- Current stock level (with visual indicator)
- Recent inventory logs (last 10)
- Quick stock update form

**Stock Update Form:**
- Quantity (positive to add, negative to reduce)
- Type: [Restock / Adjustment]
- Notes (optional)
- Submit button

---

### 5. Customer Management

#### 5.1 Customer List Page (`/customers`)

**Features:**
- Data table: Name, Mobile, Email, Total Purchases
- Search by name/mobile/email
- Exclude Guest customer from list
- Add Customer button
- Actions: View, Edit, Delete (if no invoices)

#### 5.2 Add/Edit Customer Page (`/customers/new`, `/customers/:id/edit`)

**Form Fields:**
- Name*
- Mobile (Indian format: 10 digits)
- Email
- Address
- GST Number (optional, format validation)

**Validation:**
- Mobile: 10 digits starting with 6-9
- Email: valid email format
- GST: 15 character alphanumeric (if provided)

#### 5.3 Customer Detail Page (`/customers/:id`)

**Display:**
- Customer information
- Purchase history (list of invoices)
- Total spent
- Edit/Delete buttons

---

### 6. Reports & Analytics (`/reports`)

**Sections:**

#### Sales Summary (Admin Only):
- Date range selector
- Total sales amount
- Total invoices count
- Average invoice value
- Payment mode breakdown (pie chart)

#### Top Products:
- Best selling products (by quantity)
- Best selling products (by revenue)

#### Low Stock Alert:
- List of products below minimum stock
- Action: Quick restock

#### Export Options:
- Export to CSV (invoices, products)
- Date range selection

---

### 7. Settings Page (`/settings`)

**Sections:**

#### User Profile:
- Name
- Email
- Change Password

#### Shop Details:
- Shop name
- Address
- GST Number
- Logo upload

#### Preferences:
- Default tax rate
- Low stock threshold
- Invoice prefix

---

## 🔒 Security Implementation

### 1. Authentication
```typescript
// Store JWT token securely
// Option A: localStorage (simple but vulnerable to XSS)
localStorage.setItem('token', token);

// Option B: httpOnly cookie (more secure, requires backend support)
// Store in cookie via backend Set-Cookie header

// Axios interceptor to add token to requests
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### 2. Protected Routes
```typescript
// Route guard component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" />;
  }
  
  return children;
};
```

### 3. Input Validation
- Use Zod schemas (same as backend)
- Validate on client side before API call
- Display validation errors clearly

### 4. Error Handling
```typescript
// API client with error handling
try {
  const response = await api.post('/invoices', data);
  toast.success('Invoice created successfully');
  navigate(`/invoices/${response.data.data.id}`);
} catch (error) {
  if (error.response?.status === 400) {
    toast.error(error.response.data.message);
  } else if (error.response?.status === 401) {
    toast.error('Session expired. Please login again.');
    logout();
  } else {

// api/payment.service.ts
export const paymentService = {
  getConfig: async () => {
    const response = await apiClient.get('/payments/config');
    return response.data.data;
  },
  
  createPaymentIntent: async (invoiceId: number) => {
    const response = await apiClient.post('/payments/create-intent', { invoiceId });
    return response.data.data;
  },
  
  getPaymentIntent: async (id: string) => {
    const response = await apiClient.get(`/payments/intent/${id}`);
    return response.data.data;
  },
  
  createRefund: async (paymentIntentId: string, amount?: number) => {
    const response = await apiClient.post('/payments/refund', { 
      paymentIntentId, 
      amount 
    });
    return response.data.data;
  },
};
    toast.error('An error occurred. Please try again.');
  }
}
```

---

## 📱 Responsive Design Requirements

### Desktop (1920x1080):
- Multi-column layouts
- Full data tables
- Sidebar navigation

### Tablet (768x1024):
- Adaptive layouts
- Touch-friendly buttons
- Collapsible sidebar

### Mobile (375x667):
- Single column
- Bottom navigation
- Swipeable cards
- Simplified invoice creation

---

## 🎯 User Experience Requirements

### Performance:
- Initial load < 2 seconds
- Smooth page transitions
- Optimistic UI updates
- Loading states for all async operations

### Accessibility:
- Keyboard navigation
- Screen reader support
- Focus indicators
- ColoIntegrate Stripe payment (optional)
- [ ] Payment modal with card input
- [ ] Handle payment success/failure
- [ ] r contrast (WCAG AA)

### Feedback:
- Toast notifications for success/error
- Loading spinners
- Confirmation dialogs for destructive actions
- Clear error messages

### Offline Support (Optional):
- Service worker for offline access
- Queue failed requests
- Sync when online

---

## 🔧 API Integration Guide

### 1. Setup API Client

```typescript
// api/client.ts
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - Handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### 2. API Service Functions

```typescript
// api/invoice.service.ts
import { apiClient } from './client';

export const invoiceService = {
  create: async (data: CreateInvoiceInput) => {
    const response = await apiClient.post('/invoices', data);
    return response.data.data;
  },
  
  getAll: async (params?: InvoiceFilters) => {
    const response = await apiClient.get('/invoices', { params });
    return response.data;
  },
  
  getById: async (id: number) => {
    const response = await apiClient.get(`/invoices/${id}`);
    return response.data.data;
  },
  
  getSummary: async (params?: { startDate?: string; endDate?: string }) => {
    const response = await apiClient.get('/invoices/summary', { params });
    return response.data.data;
  },
};
```

### 3. React Query Hooks

```typescript
// hooks/useInvoices.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoiceService } from '@/api/invoice.service';
import { toast } from 'sonner';

export const useInvoices = (filters?: InvoiceFilters) => {
  return useQuery({
    queryKey: ['invoices', filters],
    queryFn: () => invoiceService.getAll(filters),
  });
};

export const useCreateInvoice = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: invoiceService.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['products'] }); // Refresh product stock
      toast.success(`Invoice ${data.invoiceNumber} created successfully`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create invoice');
    },
  });
};
```

---

## 📋 Implementation Checklist

### Phase 1: Setup & Authentication (Week 1)
- [ ] Initialize Next.js/React project with TypeScript
- [ ] Setup Tailwind CSS
- [ ] Install required dependencies
- [ ] Setup API client with Axios
- [ ] Implement login page
- [ ] Implement auth context/store
- [ ] Setup protected routes
- [ ] Test authentication flow

### Phase 2: Dashboard & Navigation (Week 1-2)
- [ ] Create layout with sidebar/navbar
- [ ] Implement dashboard with metrics
- [ ] Setup routing structure
- [ ] Create basic page skeletons
- [ ] Implement responsive navigation

### Phase 3: Invoice Management (Week 2-3) ⭐ CRITICAL
- [ ] Create invoice form with product search
- [ ] Implement cart functionality
- [ ] Add tax and discount calculations
- [ ] Handle insufficient stock errors
- [ ] Invoice list with filters
- [ ] Invoice detail page
- [ ] PDF generation for invoices
- [ ] Test transaction flow thoroughly

### Phase 4: Product Management (Week 3)
- [ ] Product list with filters
- [ ] Add/Edit product forms
- [ ] Product detail page
- [ ] Stock update functionality
- [ ] Low stock alerts

### Phase 5: Customer Management (Week 3-4)
- [ ] Customer list with search
- [ ] Add/Edit customer forms
- [ ] Customer detail with purchase history
- [ ] Handle guest customer properly

### Phase 6: Reports & Analytics (Week 4)
- [ ] Sales summary with charts
- [ ] Top products
- [ ] Low stock report
- [ ] Export functionality

### Phase 7: Polish & Testing (Week 4-5)
- [ ] Mobile responsive testing
- [ ] Error handling review
- [ ] Loading states
- [ ] Accessibility audit
- [ ] Performance optimization
- [ ] User testing

---

## 🎨 UI Component Examples

### Invoice Card Component
```typescript
interface InvoiceCardProps {
  invoice: Invoice;
  onView: (id: number) => void;
  onPrint: (id: number) => void;
}

const InvoiceCard = ({ invoice, onView, onPrint }: InvoiceCardProps) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{invoice.invoiceNumber}</CardTitle>
            <CardDescription>
              {format(new Date(invoice.createdAt), 'dd MMM yyyy, hh:mm a')}
            </CardDescription>
          </div>
          <Badge variant={invoice.paymentStatus === 'PAID' ? 'success' : 'warning'}>
            {invoice.paymentStatus}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Customer:</span>
            <span className="font-medium">{invoice.customer.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Amount:</span>
            <span className="text-lg font-bold">₹{invoice.totalAmount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Payment:</span>
            <span>{invoice.paymentMode}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline" size="sm" onClick={() => onView(invoice.id)}>
          <Eye className="w-4 h-4 mr-2" />
          View
        </Button>
        <Button variant="outline" size="sm" onClick={() => onPrint(invoice.id)}>
          <Printer className="w-4 h-4 mr-2" />
          Print
        </Button>
      </CardFooter>
    </Card>
  );
};
```

### Low Stock Alert Component
```typescript
const LowStockAlert = () => {
  const { data: products } = useLowStockProducts();
  
  if (!products || products.length === 0) return null;
  
  return (
    <Alert variant="warning">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Low Stock Alert</AlertTitle>
      <AlertDescription>
        {products.length} product(s) are running low on stock.
        <Link to="/products?filter=low-stock" className="underline ml-2">
          View Details
        </Link>
      </AlertDescription>
    </Alert>
  );
};
```

---

## 🧪 Testing Requirements

### Unit Tests:
- Utility functions (calculations, formatting)
- Validation schemas
- API service functions

### Component Tests:
- Form validation
- User interactions
- Conditional rendering

### Integration Tests:
- Full invoice creation flow
- Authentication flow
- Product stock update

### E2E Tests (Optional):
- Critical user journeys
- Invoice creation with payment
- Stock deduction verification
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_live_key

# .env.development
VITE_API_BASE_URL=http://localhost:5000/api
VITE_APP_NAME=Inventory & Billing
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_test_key

---

## 📦 Deliverables

1. **Source Code:**
   - Clean, well-organized codebase
   - TypeScript with proper types
   - Component documentation

2. **Documentation:**
   - README with setup instructions
   - Component storybook (optional)
   - Deployment guide

3. **Environment Setup:**
   - `.env.example` file
   - API base URL configuration
   - Build scripts

---

## 🚀 Deployment

### Build Configuration:
```bash
# .env.production
VITE_API_BASE_URL=https://your-api-domain.com/api
VITE_APP_NAME=Inventory & Billing
```

### Hosting Options:
- **Vercel** (recommended for Next.js)
- **Netlify** (good for React)
- **AWS S3 + CloudFront**

---
**Stripe card payments** (already integrated in backend - see STRIPE_INTEGRATION.md)
- Barcode scanner integration for products
- Bulk product import (CSV)
- Multi-language support (Hindi, English)
- Dark mode
- Keyboard shortcuts for POS
- Email/SMS invoice to customers
- Customer loyalty points
- Inventory forecasting
- UPI payment QR code generation
- Payment links for remote customers
### Important Notes:
1. **Guest Customer (ID: 1)** is pre-seeded for walk-in sales
2. **Stock validation** happens on backend - frontend should handle errors gracefully
3. **JWT tokens** expire after 7 days (configurable)
4. **Rate limiting** is enabled - handle 429 errors
5. All amounts in **Indian Rupees (₹)**
6. **GST support** - tax rates per product

---

## 🎯 Success Criteria

✅ Users can login and stay authenticated
✅ Create invoices with automatic stock deduction
✅ Handle insufficient stock errors gracefully
✅ Manage products (add, edit, update stock)
✅ Manage customers
✅ View sales reports
✅ Print invoices as PDF
✅ Mobile responsive
✅ Fast and intuitive UX
✅ Production-ready code quality
npm install @stripe/stripe-js @stripe/react-stripe-js

---

## 💡 Additional Features (Optional)

- Barcode scanner integration for products
- Bulk product import (CSV)
- Multi-language support (Hindi, English)
- Stripe Integration: See `STRIPE_INTEGRATION.md` for payment setup guide
- Dark mode
- Keyboard shortcuts for POS
- Email/SMS invoice to customers
- Customer loyalty points
- Inventory forecasting

---

## 📞 Backend API Contact

- Base URL: `http://localhost:5000/api`
- Health Check: `http://localhost:5000/health`
- Documentation: See `API_EXAMPLES.md` in backend folder

---

## ⚡ Quick Start Commands

```bash
# Create Next.js project
npx create-next-app@latest inventory-frontend --typescript --tailwind --app

# Install dependencies
npm install axios @tanstack/react-query zustand react-hook-form zod
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu
npm install lucide-react date-fns clsx tailwind-merge
npm install jspdf recharts sonner

# Run development server
npm run dev
```

---

**Now build an amazing frontend that makes inventory management a breeze for small business owners!** 🚀

Good luck! 🎉
