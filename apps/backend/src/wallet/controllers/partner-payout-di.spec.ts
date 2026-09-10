import 'reflect-metadata';

import { Test } from '@nestjs/testing';

import { BankAccountsService } from '../bank-accounts.service';
import { WalletPinService } from '../wallet-pin.service';
import { WithdrawalService } from '../withdrawal.service';

import { DriverPayoutController, RiderPayoutController } from './partner-payout.controller';

/**
 * These controllers extend an abstract base that holds the constructor, and
 * that combination broke them in production in a way no existing test could
 * see.
 *
 * Nest resolves dependencies from `design:paramtypes`, which TypeScript emits
 * only for a class that declares its own constructor. Both subclasses simply
 * inherited the base one, so no metadata was emitted, and Nest constructed
 * them with zero arguments. Nothing failed at boot: the module compiled, every
 * route mapped, the app reported healthy. The first request to any of these
 * endpoints then threw `TypeError: Cannot read properties of undefined` and
 * came back as a generic 500, while every other driver endpoint kept working.
 *
 * The existing controller tests could not catch it because they construct the
 * controller by hand with real arguments, which is exactly the step Nest was
 * skipping. So these build the controllers the way the running application
 * does — through the injector — and assert the dependencies actually arrive.
 */
describe('partner payout controllers are constructed with their dependencies', () => {
  const bankAccountsService = { list: jest.fn() };
  const withdrawalService = { listForUser: jest.fn() };
  const walletPinService = { hasPin: jest.fn() };

  async function build(
    controller: typeof DriverPayoutController | typeof RiderPayoutController,
  ): Promise<DriverPayoutController | RiderPayoutController> {
    const moduleRef = await Test.createTestingModule({
      controllers: [controller],
      providers: [
        { provide: BankAccountsService, useValue: bankAccountsService },
        { provide: WithdrawalService, useValue: withdrawalService },
        { provide: WalletPinService, useValue: walletPinService },
      ],
    }).compile();

    const instance: DriverPayoutController | RiderPayoutController = moduleRef.get(controller);
    return instance;
  }

  it.each([
    ['driver', DriverPayoutController],
    ['rider', RiderPayoutController],
  ] as const)('%s controller declares its own constructor metadata', (_persona, controller) => {
    // The root cause, asserted directly: no metadata means Nest injects nothing.
    const paramTypes = Reflect.getMetadata('design:paramtypes', controller) as
      unknown[] | undefined;

    expect(paramTypes).toBeDefined();
    expect(paramTypes).toHaveLength(3);
  });

  it.each([
    ['driver', DriverPayoutController],
    ['rider', RiderPayoutController],
  ] as const)('%s controller receives its services from the injector', async (_p, controller) => {
    const instance = (await build(controller)) as unknown as Record<string, unknown>;

    // Reading them off the instance is the point: undefined here is precisely
    // the production failure, and it is invisible to a hand-constructed test.
    expect(instance['bankAccountsService']).toBe(bankAccountsService);
    expect(instance['withdrawalService']).toBe(withdrawalService);
    expect(instance['walletPinService']).toBe(walletPinService);
  });

  it.each([
    ['driver', DriverPayoutController],
    ['rider', RiderPayoutController],
  ] as const)('%s controller can serve a request end to end', async (_p, controller) => {
    const instance = await build(controller);
    bankAccountsService.list.mockResolvedValue([]);

    // The call that returned 500 in production for every driver.
    const result = await instance.listBankAccounts({ id: 'user-1' } as never);

    expect(result).toEqual({ success: true, data: [] });
    expect(bankAccountsService.list).toHaveBeenCalledWith('user-1');
  });
});
