import { ADDRESS_PERMISSIONS } from './address.constants';
import { AddressController } from './address.controller';

import type { AddressService } from './address.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { Request } from 'express';

describe('AddressController', () => {
  const addressService = {
    create: jest.fn(),
    list: jest.fn(),
    get: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    setDefault: jest.fn(),
    getDefault: jest.fn(),
  } as unknown as jest.Mocked<AddressService>;

  const controller = new AddressController(addressService);

  const user: AuthenticatedUser = {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    sid: 'session-1',
    email: 'customer@dripplex.test',
    role: 'customer',
    portal: 'CUSTOMER_WEB',
    roles: ['customer'],
    permissions: [ADDRESS_PERMISSIONS.MANAGE],
  };

  const request = {
    ip: '127.0.0.1',
    headers: { 'user-agent': 'jest' },
  } as unknown as Request;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates an address for the authenticated user', async () => {
    (addressService.create as jest.Mock).mockResolvedValue({ id: 'addr-1' });
    const result = await controller.create(
      user,
      {
        label: 'HOME',
        recipientName: 'Ada',
        phone: '+2348012345678',
        addressLine1: '12 Allen',
        city: 'Ikeja',
        state: 'Lagos',
        country: 'Nigeria',
        latitude: 6.6,
        longitude: 3.3,
      },
      request,
    );
    expect(result.success).toBe(true);
    expect(addressService.create).toHaveBeenCalledWith(
      user.id,
      expect.any(Object),
      expect.objectContaining({ userId: user.id }),
    );
  });

  it('lists addresses', async () => {
    (addressService.list as jest.Mock).mockResolvedValue({ items: [], total: 0 });
    const result = await controller.list(user);
    expect(result.data.total).toBe(0);
  });

  it('gets default address', async () => {
    (addressService.getDefault as jest.Mock).mockResolvedValue({ address: null });
    const result = await controller.getDefault(user);
    expect(result.data.address).toBeNull();
  });

  it('deletes an address', async () => {
    (addressService.delete as jest.Mock).mockResolvedValue(undefined);
    await controller.delete(user, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', request);
    expect(addressService.delete).toHaveBeenCalled();
  });
});
