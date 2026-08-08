import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateInspectionCentreDto } from './create-inspection-centre.dto';
import { CreateVehicleDto } from './create-vehicle.dto';
import { DecideInspectionDto } from './decide-inspection.dto';
import { RecordInspectionChecklistDto } from './record-inspection-checklist.dto';
import { ScheduleInspectionDto } from './schedule-inspection.dto';
import { SubmitEmergencyContactDto } from './submit-emergency-contact.dto';
import { UpdateVehicleDto } from './update-vehicle.dto';

describe('DPX-DRIVER-002 DTO validation', () => {
  it('accepts a valid vehicle registration', async () => {
    const dto = plainToInstance(CreateVehicleDto, {
      plateNumber: 'ABC-123',
      make: 'Toyota',
      model: 'Corolla',
      color: 'Blue',
      year: 2020,
      rideCategory: 'ECONOMY',
      seats: 4,
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a vehicle year outside the plausible range', async () => {
    const dto = plainToInstance(CreateVehicleDto, {
      plateNumber: 'ABC-123',
      make: 'Toyota',
      model: 'Corolla',
      color: 'Blue',
      year: 1899,
      rideCategory: 'ECONOMY',
    });

    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'year')).toBe(true);
  });

  it('rejects an unknown ride category on vehicle update', async () => {
    const dto = plainToInstance(UpdateVehicleDto, { rideCategory: 'SPACESHIP' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'rideCategory')).toBe(true);
  });

  it('requires both emergency contact fields', async () => {
    const dto = plainToInstance(SubmitEmergencyContactDto, { emergencyContactName: 'Jane' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'emergencyContactPhone')).toBe(true);
  });

  it('requires the emergency contact relationship (DPX-DRIVER-007)', async () => {
    const dto = plainToInstance(SubmitEmergencyContactDto, {
      emergencyContactName: 'Jane Doe',
      emergencyContactPhone: '+2348012345678',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'emergencyContactRelationship')).toBe(true);
  });

  it('rejects an unknown emergency contact relationship', async () => {
    const dto = plainToInstance(SubmitEmergencyContactDto, {
      emergencyContactName: 'Jane Doe',
      emergencyContactPhone: '+2348012345678',
      emergencyContactRelationship: 'Colleague',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'emergencyContactRelationship')).toBe(true);
  });

  it('rejects a malformed optional emergency contact email', async () => {
    const dto = plainToInstance(SubmitEmergencyContactDto, {
      emergencyContactName: 'Jane Doe',
      emergencyContactPhone: '+2348012345678',
      emergencyContactRelationship: 'Spouse',
      emergencyContactEmail: 'not-an-email',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'emergencyContactEmail')).toBe(true);
  });

  it('accepts a complete emergency contact (relationship set, email omitted)', async () => {
    const dto = plainToInstance(SubmitEmergencyContactDto, {
      emergencyContactName: 'Jane Doe',
      emergencyContactPhone: '+2348012345678',
      emergencyContactRelationship: 'Spouse',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid inspection centre', async () => {
    const dto = plainToInstance(CreateInspectionCentreDto, {
      name: 'Lagos Centre',
      address: '1 Test Road, Lagos',
      city: 'Lagos',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects an out-of-range latitude on an inspection centre', async () => {
    const dto = plainToInstance(CreateInspectionCentreDto, {
      name: 'Lagos Centre',
      address: '1 Test Road, Lagos',
      city: 'Lagos',
      latitude: 999,
    });

    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'latitude')).toBe(true);
  });

  it('requires a UUID vehicleId/centreId when scheduling an inspection', async () => {
    const dto = plainToInstance(ScheduleInspectionDto, {
      vehicleId: 'not-a-uuid',
      centreId: 'not-a-uuid',
      scheduledAt: new Date().toISOString(),
    });

    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'vehicleId')).toBe(true);
    expect(errors.some((e) => e.property === 'centreId')).toBe(true);
  });

  it('validates nested checklist items when recording an inspection checklist', async () => {
    const dto = plainToInstance(RecordInspectionChecklistDto, {
      checklist: [{ key: 'tires', label: 'Tires', passed: 'not-a-boolean' }],
    });

    const errors = await validate(dto);
    const checklistError = errors.find((e) => e.property === 'checklist');
    expect(checklistError).toBeDefined();
  });

  it('rejects an empty checklist array', async () => {
    const dto = plainToInstance(RecordInspectionChecklistDto, { checklist: [] });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'checklist')).toBe(true);
  });

  it('requires a boolean `passed` when deciding an inspection', async () => {
    const dto = plainToInstance(DecideInspectionDto, { passed: 'yes' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'passed')).toBe(true);
  });
});
