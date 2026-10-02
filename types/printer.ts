export type PaperWidth = '58mm' | '80mm';

export interface ReceiptItem {
  itemName: string;
  name?: string;
  quantity: number;
  price?: number;
  unitPrice?: number;
  totalPrice?: number;
  cookingInstruction?: string;
  remarks?: string;
}

export interface ReceiptData {
  restaurantName: string;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  contactNumber?: string;
  contactPhone?: string;
  fssaiNumber?: string;
  gstNumber?: string;
  orderId: number | string;
  orderNumber?: string;
  orderType?: string;
  tableName?: string;
  tableNumber?: string | number;
  sectionName?: string;
  customerName?: string;
  customerPhone?: string;
  dateTime?: string;
  date?: string;
  items: ReceiptItem[];
  subTotal?: number;
  subtotal?: number;
  taxAmount?: number;
  gstAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  cgstPercentage?: number;
  sgstPercentage?: number;
  discountAmount?: number;
  grandTotal: number;
  totalAmount?: number;
  paymentMode?: string;
  tenderedAmount?: number;
  changeAmount?: number;
  pickupToken?: string;
  footerMessage?: string;
}
