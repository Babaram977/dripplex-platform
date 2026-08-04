import type { IncidentReportDto } from '@dripplex/types';
import type { IncidentReport } from '@prisma/client';

export function toIncidentReportDto(report: IncidentReport): IncidentReportDto {
  return {
    id: report.id,
    driverId: report.driverId,
    rideId: report.rideId,
    category: report.category,
    severity: report.severity,
    description: report.description,
    latitude: report.latitude ? Number(report.latitude) : null,
    longitude: report.longitude ? Number(report.longitude) : null,
    status: report.status,
    adminNotes: report.adminNotes,
    acknowledgedBy: report.acknowledgedBy,
    acknowledgedAt: report.acknowledgedAt ? report.acknowledgedAt.toISOString() : null,
    resolvedAt: report.resolvedAt ? report.resolvedAt.toISOString() : null,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  };
}
