import { CreateInspectionCentreDto } from './dto/create-inspection-centre.dto';
import { UpdateInspectionCentreDto } from './dto/update-inspection-centre.dto';
import { InspectionCentresService } from './inspections/inspection-centres.service';

/**
 * DPX-OPS step 8 — what an operator may do to an inspection centre, and what
 * they may not.
 *
 * WRITTEN BEFORE THE UI PORT. Unlike steps 5-7 this capability genuinely
 * WRITES, so "prove it is read-only" is the wrong question. The right one is:
 * what is the exact shape of the write, and what is deliberately absent from
 * it? A console built without knowing that would invent the gaps.
 *
 * THREE PROPERTIES THIS PINS:
 *
 * 1. THERE IS NO DELETE. The service's whole surface is create, update,
 *    listActive, listAll, get. A centre can be deactivated; it can never be
 *    removed. That is not an oversight to be helpfully filled in by a console
 *    — inspections point at centres, and a deleted centre would orphan the
 *    record of where a vehicle was actually inspected. If a delete is ever
 *    added, this test fails and the decision gets made deliberately rather
 *    than inherited.
 *
 * 2. `isActive` IS UPDATE-ONLY. CreateInspectionCentreDto has no such field,
 *    so a centre is born active and switching it off is a separate, deliberate
 *    act rather than something set in passing at creation.
 *
 * 3. `address` IS OPTIONAL, ON PURPOSE. The DTO says so: "a placeholder street
 *    line would read to a driver as a real one", and InspectionCentreDto's
 *    `address: string | null` carries the founder decision of 2026-08-17 to
 *    render the city alone rather than a blank line. A console must not
 *    require an address it would then have to invent.
 *
 * WHAT IS RECORDED HERE RATHER THAN FIXED: deactivating a centre has NO
 * CASCADE. The `isActive` check runs only when an inspection is BOOKED
 * (inspections.service.ts:51). Inspections already scheduled at a centre keep
 * pointing at it after it is switched off — nothing cancels or moves them.
 * That may well be intended (a centre winding down honours its appointments),
 * so it is not changed here. It is a consequence the operator toggling the
 * switch should be told about, and the ported UI says so.
 */
describe('Inspection centre operator surface', () => {
  describe('there is no delete, and that is deliberate', () => {
    it('exposes exactly create, update and the three reads', () => {
      const surface = Object.getOwnPropertyNames(InspectionCentresService.prototype)
        .filter((name) => name !== 'constructor')
        .sort();

      // Named exhaustively rather than checked with a "does not include
      // delete" assertion: an exhaustive list also fails when something NEW
      // and unexamined appears, which is the case that would otherwise reach
      // a console unnoticed.
      //
      // `requireCentre` is `private` in TypeScript, which is a compile-time
      // fiction — it is an ordinary prototype method at runtime and is listed
      // here rather than filtered out, because filtering by visibility would
      // let a private `deleteCentre` appear without failing this.
      expect(surface).toEqual([
        'create',
        'get',
        'listActive',
        'listAll',
        'requireCentre',
        'update',
      ]);
    });

    it.each(['delete', 'remove', 'destroy', 'archive', 'deleteMany'])(
      'has no %s method a console could call',
      (method) => {
        expect(
          (InspectionCentresService.prototype as unknown as Record<string, unknown>)[method],
        ).toBeUndefined();
      },
    );
  });

  describe('the write path is audited', () => {
    it('takes an audit service as well as Prisma', () => {
      // Two constructor dependencies, unlike the read-only services in steps
      // 5-7 which take Prisma alone. That asymmetry is the point: this
      // capability changes where drivers are told to take their vehicles, so
      // every change is recorded against the admin who made it. If this ever
      // drops to one dependency, the write stopped being audited.
      expect(InspectionCentresService.length).toBe(2);
    });
  });

  describe('isActive is update-only', () => {
    it('is absent from the create contract', () => {
      // A centre is born active. Switching one off is a separate act with its
      // own consequence, not a checkbox set in passing while creating it.
      const create = new CreateInspectionCentreDto();
      expect('isActive' in create).toBe(false);
      expect(Object.keys(create)).not.toContain('isActive');
    });

    it('is present on the update contract', () => {
      const update = new UpdateInspectionCentreDto();
      update.isActive = false;
      expect(update.isActive).toBe(false);
    });
  });

  describe('address is optional on purpose', () => {
    it('create requires name and city but not address', () => {
      // Pinned because a console that made address mandatory would force an
      // operator to invent a street line, and the DTO says exactly why that is
      // wrong: a placeholder would read to a driver as a real address.
      const create = new CreateInspectionCentreDto();
      create.name = 'Ikeja Centre';
      create.city = 'Lagos';
      expect(create.address).toBeUndefined();
      expect(create.name).toBe('Ikeja Centre');
      expect(create.city).toBe('Lagos');
    });
  });
});
