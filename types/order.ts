// types/order.ts
export interface Place {
    d: number;
    w: number;
    h: number;
    weight: number;
  }
  
  export interface OrderHistoryItem {
    status: string;
    timestamp: string;
    user: string;
    action?: 'created' | 'status_changed' | 'added_to_consolidation' | 'removed_from_consolidation';
    consolidationId?: string;
    consolidationNumber?: string;
  }
  
  export interface Order {
    id: string;
    orderNumber?: string;
    carrier: string;
    status: string;
    createdAt: string;
    createdBy: string;
    quantity?: number;
    totalWeight?: number;
    totalVolume?: number;
    payment_sum?: number;
    delivery_cost?: number;
    profit?: number;
    time_start?: any;
    time_end?: any;
    places_data?: Place[];
    history?: OrderHistoryItem[];
    consolidationId?: string;
    consolidationNumber?: string;
  }