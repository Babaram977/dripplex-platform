export interface RoleSeed {
  name: string;
  description: string;
}

export const ROLE_SEEDS: RoleSeed[] = [
  {
    name: 'customer',
    description: 'Marketplace consumer with access to customer-web',
  },
  {
    name: 'merchant',
    description: 'Store owner or operator with access to merchant-portal',
  },
  {
    name: 'rider',
    description: 'Parcel and food delivery courier with access to rider-portal',
  },
  {
    name: 'driver',
    description: 'Ride-hailing driver with access to driver-portal',
  },
  {
    name: 'operations_staff',
    description: 'Internal operations console user',
  },
  {
    name: 'administrator',
    description: 'Platform administrator',
  },
  {
    name: 'super_administrator',
    description: 'Full platform control including role and settings management',
  },
];
