export type OrderNotifyEvent = "order_created" | "payment_confirmed";

export type OrderNotifyItem = {
  product_name: string;
  variant_name?: string | null;
  quantity: number;
  unit_price: number;
};

export type OrderNotifyPayload = {
  event: OrderNotifyEvent;
  orderId: string;
  orderNumber: string;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  grandTotal: number;
  shippingCharge?: number;
  subtotal?: number;
  customer: {
    full_name?: string | null;
    mobile_number?: string | null;
    email?: string | null;
    address_line?: string | null;
    city?: string | null;
    state?: string | null;
    pin_code?: string | null;
  };
  items: OrderNotifyItem[];
};

export type StoreNotifyContact = {
  brand_name?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp_number?: string | null;
};
