export interface Guest {
  id: string;
  name: string;
  tableId: string;
  addedBy?: string;
  createdAt: any;
  updatedAt: any;
}

export interface Table {
  id: string;
  name: string;
  location: 'inside' | 'outdoor';
  capacity: number;
  shape: 'Circle';
  x: number; // 0-100 relative x
  y: number; // 0-100 relative y
}

export interface Admin {
  id: string;
  email: string;
}
