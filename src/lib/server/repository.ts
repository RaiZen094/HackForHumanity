import "server-only";

import { randomUUID } from "node:crypto";
import sql from "mssql";
import { z } from "zod";
import { workerArtifactSchema, type WorkerArtifact } from "@/lib/domain/worker-artifacts";
import { createProject as newDomainProject } from "@/lib/domain/project";
import {
  approvedPlanSchema,
  interpretationSchema,
  pageSpecSchema,
  projectStageSchema,
  workerRecommendationSchema,
  type PendingExpansion,
  type ProductEvent,
  type StudioMessage,
  type StudioProject,
} from "@/lib/domain/schemas";
import { getSqlPool } from "@/lib/server/sql";

const pendingExpansionSchema = z.object({ worker: workerRecommendationSchema, request: z.string(), restriction: z.string().nullable() });
const parseNullable = <T>(value: string | null, parser: (input: unknown) => T) => value ? parser(JSON.parse(value)) : null;

interface ProjectRow {
  Id: string;
  Name: string;
  Stage: string;
  OriginalPrompt: string | null;
  CurrentPrompt: string | null;
  InterpretationJson: string | null;
  RecommendationsJson: string | null;
  ApprovedPlanJson: string | null;
  PendingExpansionJson: string | null;
  PageSpecJson: string | null;
  LastError: string | null;
  CreatedAt: Date;
  UpdatedAt: Date;
}

interface MessageRow { Id: string; Role: string; Kind: string; Content: string; CreatedAt: Date }
interface EventRow { Id: string; Name: string; PropertiesJson: string; CreatedAt: Date }

function hydrate(row: ProjectRow, messages: MessageRow[] = [], events: EventRow[] = []): StudioProject {
  return {
    id: row.Id,
    name: row.Name,
    stage: projectStageSchema.parse(row.Stage),
    originalPrompt: row.OriginalPrompt,
    currentPrompt: row.CurrentPrompt,
    interpretation: parseNullable(row.InterpretationJson, interpretationSchema.parse),
    recommendations: row.RecommendationsJson ? z.array(workerRecommendationSchema).parse(JSON.parse(row.RecommendationsJson)) : [],
    approvedPlan: parseNullable(row.ApprovedPlanJson, approvedPlanSchema.parse),
    pendingExpansion: parseNullable(row.PendingExpansionJson, pendingExpansionSchema.parse) as PendingExpansion | null,
    pageSpec: parseNullable(row.PageSpecJson, pageSpecSchema.parse),
    lastError: row.LastError,
    messages: messages.map((item) => ({ id: item.Id, role: item.Role, kind: item.Kind, content: item.Content, createdAt: item.CreatedAt.toISOString() })) as StudioMessage[],
    events: events.map((item) => ({ id: item.Id, name: item.Name, properties: JSON.parse(item.PropertiesJson), createdAt: item.CreatedAt.toISOString() })) as ProductEvent[],
    createdAt: row.CreatedAt.toISOString(),
    updatedAt: row.UpdatedAt.toISOString(),
  };
}

export async function ensureGuest(tokenHash: string) {
  const pool = await getSqlPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const request = transaction.request();
    request.input("TokenHash", sql.NVarChar(128), tokenHash);
    request.input("Id", sql.NVarChar(64), randomUUID());
    const result = await request.query<{ Id: string }>(`
      DECLARE @ExistingId NVARCHAR(64);
      SELECT @ExistingId = Id FROM dbo.WorkerStudioGuestSession WITH (UPDLOCK, HOLDLOCK) WHERE TokenHash = @TokenHash;
      IF @ExistingId IS NULL
      BEGIN
        SET @ExistingId = @Id;
        INSERT INTO dbo.WorkerStudioGuestSession (Id, TokenHash) VALUES (@ExistingId, @TokenHash);
      END;
      ELSE UPDATE dbo.WorkerStudioGuestSession SET UpdatedAt = SYSUTCDATETIME() WHERE Id = @ExistingId;
      SELECT @ExistingId AS Id;
    `);
    await transaction.commit();
    return { id: result.recordset[0].Id };
  } catch (error) {
    await transaction.rollback().catch(() => undefined);
    throw error;
  }
}

async function readProject(tokenHash: string, projectId: string) {
  const pool = await getSqlPool();
  const projectRequest = pool.request();
  projectRequest.input("TokenHash", sql.NVarChar(128), tokenHash);
  projectRequest.input("ProjectId", sql.NVarChar(64), projectId);
  const projectResult = await projectRequest.query<ProjectRow>(`
    SELECT p.* FROM dbo.WorkerStudioProject p
    INNER JOIN dbo.WorkerStudioGuestSession s ON s.Id = p.GuestSessionId
    WHERE p.Id = @ProjectId AND s.TokenHash = @TokenHash;
  `);
  const row = projectResult.recordset[0];
  if (!row) return null;

  const messageRequest = pool.request();
  messageRequest.input("ProjectId", sql.NVarChar(64), projectId);
  const messages = await messageRequest.query<MessageRow>("SELECT Id, Role, Kind, Content, CreatedAt FROM dbo.WorkerStudioMessage WHERE ProjectId = @ProjectId ORDER BY SequenceNumber, CreatedAt, Id;");
  const eventRequest = pool.request();
  eventRequest.input("ProjectId", sql.NVarChar(64), projectId);
  const events = await eventRequest.query<EventRow>("SELECT Id, Name, PropertiesJson, CreatedAt FROM dbo.WorkerStudioProductEvent WHERE ProjectId = @ProjectId ORDER BY CreatedAt, Id;");
  return hydrate(row, messages.recordset, events.recordset);
}

export async function createOwnedProject(tokenHash: string) {
  const guest = await ensureGuest(tokenHash);
  const project = newDomainProject();
  const pool = await getSqlPool();
  const request = pool.request();
  request.input("Id", sql.NVarChar(64), project.id);
  request.input("GuestSessionId", sql.NVarChar(64), guest.id);
  request.input("Name", sql.NVarChar(160), project.name);
  request.input("Stage", sql.NVarChar(40), project.stage);
  await request.query("INSERT INTO dbo.WorkerStudioProject (Id, GuestSessionId, Name, Stage) VALUES (@Id, @GuestSessionId, @Name, @Stage);");
  return (await readProject(tokenHash, project.id))!;
}

export async function listOwnedProjects(tokenHash: string) {
  await ensureGuest(tokenHash);
  const pool = await getSqlPool();
  const request = pool.request();
  request.input("TokenHash", sql.NVarChar(128), tokenHash);
  const ids = await request.query<{ Id: string }>(`
    SELECT p.Id FROM dbo.WorkerStudioProject p
    INNER JOIN dbo.WorkerStudioGuestSession s ON s.Id = p.GuestSessionId
    WHERE s.TokenHash = @TokenHash ORDER BY p.UpdatedAt DESC;
  `);
  const projects = await Promise.all(ids.recordset.map((item) => readProject(tokenHash, item.Id)));
  return projects.filter((item): item is StudioProject => item !== null);
}

export async function getOwnedProject(tokenHash: string, projectId: string) {
  await ensureGuest(tokenHash);
  return readProject(tokenHash, projectId);
}

function bindProject(request: sql.Request, project: StudioProject) {
  request.input("ProjectId", sql.NVarChar(64), project.id);
  request.input("Name", sql.NVarChar(160), project.name);
  request.input("Stage", sql.NVarChar(40), project.stage);
  request.input("OriginalPrompt", sql.NVarChar(sql.MAX), project.originalPrompt);
  request.input("CurrentPrompt", sql.NVarChar(sql.MAX), project.currentPrompt);
  request.input("InterpretationJson", sql.NVarChar(sql.MAX), project.interpretation ? JSON.stringify(project.interpretation) : null);
  request.input("RecommendationsJson", sql.NVarChar(sql.MAX), JSON.stringify(project.recommendations));
  request.input("ApprovedPlanJson", sql.NVarChar(sql.MAX), project.approvedPlan ? JSON.stringify(project.approvedPlan) : null);
  request.input("PendingExpansionJson", sql.NVarChar(sql.MAX), project.pendingExpansion ? JSON.stringify(project.pendingExpansion) : null);
  request.input("PageSpecJson", sql.NVarChar(sql.MAX), project.pageSpec ? JSON.stringify(project.pageSpec) : null);
  request.input("LastError", sql.NVarChar(1000), project.lastError);
}

export async function saveOwnedProject(tokenHash: string, project: StudioProject) {
  const pool = await getSqlPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
  try {
    const update = transaction.request();
    update.input("TokenHash", sql.NVarChar(128), tokenHash);
    bindProject(update, project);
    const updated = await update.query(`
      UPDATE p SET Name=@Name, Stage=@Stage, OriginalPrompt=@OriginalPrompt, CurrentPrompt=@CurrentPrompt,
        InterpretationJson=@InterpretationJson, RecommendationsJson=@RecommendationsJson, ApprovedPlanJson=@ApprovedPlanJson,
        PendingExpansionJson=@PendingExpansionJson, PageSpecJson=@PageSpecJson, LastError=@LastError, UpdatedAt=SYSUTCDATETIME()
      FROM dbo.WorkerStudioProject p INNER JOIN dbo.WorkerStudioGuestSession s ON s.Id=p.GuestSessionId
      WHERE p.Id=@ProjectId AND s.TokenHash=@TokenHash;
    `);
    if ((updated.rowsAffected[0] ?? 0) !== 1) {
      await transaction.rollback();
      return null;
    }

    const cleanup = transaction.request();
    cleanup.input("ProjectId", sql.NVarChar(64), project.id);
    await cleanup.query(`
      DELETE FROM dbo.WorkerStudioMessage WHERE ProjectId=@ProjectId;
      DELETE FROM dbo.WorkerStudioProductEvent WHERE ProjectId=@ProjectId;
      DELETE FROM dbo.WorkerStudioApproval WHERE ProjectId=@ProjectId;
      DELETE FROM dbo.WorkerStudioBuild WHERE ProjectId=@ProjectId;
      DELETE FROM dbo.WorkerStudioRevision WHERE ProjectId=@ProjectId;
    `);

    for (const [sequence, item] of project.messages.entries()) {
      const request = transaction.request();
      request.input("Id", sql.NVarChar(64), item.id);
      request.input("ProjectId", sql.NVarChar(64), project.id);
      request.input("Role", sql.NVarChar(20), item.role);
      request.input("Kind", sql.NVarChar(40), item.kind);
      request.input("Content", sql.NVarChar(sql.MAX), item.content);
      request.input("CreatedAt", sql.DateTime2(3), new Date(item.createdAt));
      request.input("SequenceNumber", sql.Int, sequence + 1);
      await request.query("INSERT INTO dbo.WorkerStudioMessage (Id,ProjectId,Role,Kind,Content,CreatedAt,SequenceNumber) VALUES (@Id,@ProjectId,@Role,@Kind,@Content,@CreatedAt,@SequenceNumber);");
    }
    for (const item of project.events) {
      const request = transaction.request();
      request.input("Id", sql.NVarChar(64), item.id);
      request.input("ProjectId", sql.NVarChar(64), project.id);
      request.input("Name", sql.NVarChar(80), item.name);
      request.input("PropertiesJson", sql.NVarChar(sql.MAX), JSON.stringify(item.properties));
      request.input("CreatedAt", sql.DateTime2(3), new Date(item.createdAt));
      await request.query("INSERT INTO dbo.WorkerStudioProductEvent (Id,ProjectId,Name,PropertiesJson,CreatedAt) VALUES (@Id,@ProjectId,@Name,@PropertiesJson,@CreatedAt);");
    }
    if (project.approvedPlan) {
      const request = transaction.request();
      request.input("Id", sql.NVarChar(64), randomUUID());
      request.input("ProjectId", sql.NVarChar(64), project.id);
      request.input("SnapshotJson", sql.NVarChar(sql.MAX), JSON.stringify(project.approvedPlan));
      request.input("ApprovedAt", sql.DateTime2(3), new Date(project.approvedPlan.approvedAt));
      await request.query("INSERT INTO dbo.WorkerStudioApproval (Id,ProjectId,Kind,SnapshotJson,ApprovedAt) VALUES (@Id,@ProjectId,N'worker_team',@SnapshotJson,@ApprovedAt);");
    }
    if (project.pageSpec) {
      const request = transaction.request();
      request.input("Id", sql.NVarChar(64), randomUUID());
      request.input("ProjectId", sql.NVarChar(64), project.id);
      request.input("PageSpecJson", sql.NVarChar(sql.MAX), JSON.stringify(project.pageSpec));
      await request.query("INSERT INTO dbo.WorkerStudioBuild (Id,ProjectId,Status,PageSpecJson,Result,CompletedAt) VALUES (@Id,@ProjectId,N'completed',@PageSpecJson,N'success',SYSUTCDATETIME());");
    }
    let failure: { operation?: string; message?: string; request?: string | null } | null = null;
    if (project.stage === "FAILED" && project.lastError) {
      try { failure = JSON.parse(project.lastError) as typeof failure; } catch { failure = { message: project.lastError }; }
    }
    if (failure?.operation === "build") {
      const request = transaction.request();
      request.input("Id", sql.NVarChar(64), randomUUID());
      request.input("ProjectId", sql.NVarChar(64), project.id);
      request.input("Error", sql.NVarChar(1000), failure.message ?? "Build failed.");
      await request.query("INSERT INTO dbo.WorkerStudioBuild (Id,ProjectId,Status,Result,Error,CompletedAt) VALUES (@Id,@ProjectId,N'failed',N'failure',@Error,SYSUTCDATETIME());");
    }
    for (const item of project.messages.filter((message) => message.role === "participant" && message.kind === "revision")) {
      const request = transaction.request();
      request.input("Id", sql.NVarChar(64), item.id);
      request.input("ProjectId", sql.NVarChar(64), project.id);
      request.input("RequestText", sql.NVarChar(sql.MAX), item.content);
      request.input("CreatedAt", sql.DateTime2(3), new Date(item.createdAt));
      const isFailed = failure?.operation === "revise" && failure.request === item.content;
      request.input("Status", sql.NVarChar(30), isFailed ? "failed" : "completed");
      request.input("ResultSummary", sql.NVarChar(1000), isFailed ? failure?.message ?? "Revision failed." : null);
      await request.query("INSERT INTO dbo.WorkerStudioRevision (Id,ProjectId,RequestText,Category,Status,ResultSummary,CreatedAt,CompletedAt) VALUES (@Id,@ProjectId,@RequestText,N'recorded',@Status,@ResultSummary,@CreatedAt,SYSUTCDATETIME());");
    }
    if (failure?.operation === "revise" && failure.request && !project.messages.some((item) => item.role === "participant" && item.kind === "revision" && item.content === failure?.request)) {
      const request = transaction.request();
      request.input("Id", sql.NVarChar(64), randomUUID());
      request.input("ProjectId", sql.NVarChar(64), project.id);
      request.input("RequestText", sql.NVarChar(sql.MAX), failure.request);
      request.input("ResultSummary", sql.NVarChar(1000), failure.message ?? "Revision failed.");
      await request.query("INSERT INTO dbo.WorkerStudioRevision (Id,ProjectId,RequestText,Category,Status,ResultSummary,CreatedAt,CompletedAt) VALUES (@Id,@ProjectId,@RequestText,N'unknown',N'failed',@ResultSummary,SYSUTCDATETIME(),SYSUTCDATETIME());");
    }
    await transaction.commit();
    return readProject(tokenHash, project.id);
  } catch (error) {
    await transaction.rollback().catch(() => undefined);
    throw error;
  }
}

export async function idempotentResponse(projectId: string, key: string) {
  const pool = await getSqlPool();
  const request = pool.request();
  request.input("ProjectId", sql.NVarChar(64), projectId);
  request.input("IdempotencyKey", sql.NVarChar(128), key);
  const result = await request.query<{ ResponseJson: string | null }>("SELECT ResponseJson FROM dbo.WorkerStudioIdempotency WHERE ProjectId=@ProjectId AND IdempotencyKey=@IdempotencyKey;");
  return result.recordset[0]?.ResponseJson ? JSON.parse(result.recordset[0].ResponseJson) as unknown : null;
}

export async function storeIdempotentResponse(projectId: string, key: string, operation: string, value: unknown) {
  const pool = await getSqlPool();
  const request = pool.request();
  request.input("Id", sql.NVarChar(64), randomUUID());
  request.input("ProjectId", sql.NVarChar(64), projectId);
  request.input("IdempotencyKey", sql.NVarChar(128), key);
  request.input("Operation", sql.NVarChar(50), operation);
  request.input("ResponseJson", sql.NVarChar(sql.MAX), JSON.stringify(value));
  try {
    await request.query("INSERT INTO dbo.WorkerStudioIdempotency (Id,ProjectId,IdempotencyKey,Operation,ResponseJson) VALUES (@Id,@ProjectId,@IdempotencyKey,@Operation,@ResponseJson);");
  } catch (error) {
    const number = typeof error === "object" && error !== null && "number" in error ? Number(error.number) : 0;
    if (number !== 2601 && number !== 2627) throw error;
  }
}

interface WorkerRunRow { Id: string; ProjectId: string; WorkerId: string; InputText: string; ResultJson: string; CreatedAt: Date }

export async function listWorkerRuns(tokenHash: string, projectId: string): Promise<WorkerArtifact[] | null> {
  const project = await readProject(tokenHash, projectId);
  if (!project) return null;
  const pool = await getSqlPool();
  const request = pool.request();
  request.input("ProjectId", sql.NVarChar(64), projectId);
  const result = await request.query<WorkerRunRow>("SELECT Id,ProjectId,WorkerId,InputText,ResultJson,CreatedAt FROM dbo.WorkerStudioWorkerRun WHERE ProjectId=@ProjectId ORDER BY CreatedAt DESC;");
  return result.recordset.map((row) => workerArtifactSchema.parse({
    id: row.Id, projectId: row.ProjectId, workerId: row.WorkerId, input: row.InputText,
    result: JSON.parse(row.ResultJson), createdAt: row.CreatedAt.toISOString(),
  }));
}

export async function createWorkerRun(projectId: string, workerId: WorkerArtifact["workerId"], input: string, result: Record<string, unknown>) {
  const artifact = workerArtifactSchema.parse({ id: randomUUID(), projectId, workerId, input, result, createdAt: new Date().toISOString() });
  const pool = await getSqlPool();
  const request = pool.request();
  request.input("Id", sql.NVarChar(64), artifact.id);
  request.input("ProjectId", sql.NVarChar(64), artifact.projectId);
  request.input("WorkerId", sql.NVarChar(80), artifact.workerId);
  request.input("InputText", sql.NVarChar(sql.MAX), artifact.input);
  request.input("ResultJson", sql.NVarChar(sql.MAX), JSON.stringify(artifact.result));
  request.input("CreatedAt", sql.DateTime2(3), new Date(artifact.createdAt));
  await request.query("INSERT INTO dbo.WorkerStudioWorkerRun (Id,ProjectId,WorkerId,InputText,ResultJson,CreatedAt) VALUES (@Id,@ProjectId,@WorkerId,@InputText,@ResultJson,@CreatedAt);");
  return artifact;
}

export async function createProjectAsset(projectId: string, prompt: string, alt: string, image: Buffer) {
  const id = randomUUID();
  const pool = await getSqlPool();
  const request = pool.request();
  request.input("Id", sql.NVarChar(64), id);
  request.input("ProjectId", sql.NVarChar(64), projectId);
  request.input("WorkerId", sql.NVarChar(80), "content-executive");
  request.input("PromptText", sql.NVarChar(sql.MAX), prompt);
  request.input("AltText", sql.NVarChar(500), alt);
  request.input("MimeType", sql.NVarChar(80), "image/jpeg");
  request.input("ImageData", sql.VarBinary(sql.MAX), image);
  await request.query("INSERT INTO dbo.WorkerStudioAsset (Id,ProjectId,WorkerId,PromptText,AltText,MimeType,ImageData) VALUES (@Id,@ProjectId,@WorkerId,@PromptText,@AltText,@MimeType,@ImageData);");
  return { id, mimeType: "image/jpeg" };
}

export async function getOwnedProjectAsset(tokenHash: string, projectId: string, assetId: string) {
  const project = await readProject(tokenHash, projectId);
  if (!project) return null;
  const pool = await getSqlPool();
  const request = pool.request();
  request.input("ProjectId", sql.NVarChar(64), projectId);
  request.input("AssetId", sql.NVarChar(64), assetId);
  const result = await request.query<{ MimeType: string; ImageData: Buffer }>("SELECT MimeType,ImageData FROM dbo.WorkerStudioAsset WHERE Id=@AssetId AND ProjectId=@ProjectId;");
  const row = result.recordset[0];
  return row ? { mimeType: row.MimeType, data: row.ImageData } : null;
}
