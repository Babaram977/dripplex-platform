-- CreateEnum
CREATE TYPE "OperationsCaseType" AS ENUM ('SOS', 'INCIDENT', 'SUPPORT');

-- CreateEnum
CREATE TYPE "OperationsPriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "OperationsLifecycleStatus" AS ENUM ('NEW', 'ASSIGNED', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "OperationsAssigneeRole" AS ENUM ('OPERATOR', 'SUPERVISOR');

-- CreateEnum
CREATE TYPE "OperationsCaseEventType" AS ENUM ('CREATED', 'PRIORITY_CHANGED', 'ASSIGNED', 'UNASSIGNED', 'STATUS_CHANGED', 'NOTE_ADDED');

-- CreateTable
CREATE TABLE "operations_cases" (
    "id" UUID NOT NULL,
    "case_type" "OperationsCaseType" NOT NULL,
    "source_id" UUID NOT NULL,
    "priority" "OperationsPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "OperationsLifecycleStatus" NOT NULL DEFAULT 'NEW',
    "assigned_to_id" UUID,
    "assigned_to_role" "OperationsAssigneeRole",
    "assigned_by_id" UUID,
    "assigned_at" TIMESTAMP(3),
    "first_responded_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operations_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations_case_events" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "event_type" "OperationsCaseEventType" NOT NULL,
    "actor_id" UUID,
    "description" VARCHAR(1000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operations_case_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "operations_cases_case_type_status_idx" ON "operations_cases"("case_type", "status");

-- CreateIndex
CREATE INDEX "operations_cases_priority_idx" ON "operations_cases"("priority");

-- CreateIndex
CREATE INDEX "operations_cases_assigned_to_id_idx" ON "operations_cases"("assigned_to_id");

-- CreateIndex
CREATE UNIQUE INDEX "operations_cases_case_type_source_id_key" ON "operations_cases"("case_type", "source_id");

-- CreateIndex
CREATE INDEX "operations_case_events_case_id_created_at_idx" ON "operations_case_events"("case_id", "created_at");

-- AddForeignKey
ALTER TABLE "operations_cases" ADD CONSTRAINT "operations_cases_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations_cases" ADD CONSTRAINT "operations_cases_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations_case_events" ADD CONSTRAINT "operations_case_events_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "operations_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations_case_events" ADD CONSTRAINT "operations_case_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
