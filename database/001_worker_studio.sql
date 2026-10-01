SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.WorkerStudioSchemaMigration', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.WorkerStudioSchemaMigration (
    Version NVARCHAR(64) NOT NULL CONSTRAINT PK_WorkerStudioSchemaMigration PRIMARY KEY,
    AppliedAt DATETIME2(3) NOT NULL CONSTRAINT DF_WorkerStudioSchemaMigration_AppliedAt DEFAULT SYSUTCDATETIME()
  );
END;

IF OBJECT_ID(N'dbo.WorkerStudioGuestSession', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.WorkerStudioGuestSession (
    Id NVARCHAR(64) NOT NULL CONSTRAINT PK_WorkerStudioGuestSession PRIMARY KEY,
    TokenHash NVARCHAR(128) NOT NULL,
    CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_WorkerStudioGuestSession_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_WorkerStudioGuestSession_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_WorkerStudioGuestSession_TokenHash UNIQUE (TokenHash)
  );
END;

IF OBJECT_ID(N'dbo.WorkerStudioProject', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.WorkerStudioProject (
    Id NVARCHAR(64) NOT NULL CONSTRAINT PK_WorkerStudioProject PRIMARY KEY,
    GuestSessionId NVARCHAR(64) NOT NULL,
    Name NVARCHAR(160) NOT NULL CONSTRAINT DF_WorkerStudioProject_Name DEFAULT N'Untitled project',
    Stage NVARCHAR(40) NOT NULL CONSTRAINT DF_WorkerStudioProject_Stage DEFAULT N'DESCRIBE',
    OriginalPrompt NVARCHAR(MAX) NULL,
    CurrentPrompt NVARCHAR(MAX) NULL,
    InterpretationJson NVARCHAR(MAX) NULL,
    RecommendationsJson NVARCHAR(MAX) NULL,
    ApprovedPlanJson NVARCHAR(MAX) NULL,
    PendingExpansionJson NVARCHAR(MAX) NULL,
    PageSpecJson NVARCHAR(MAX) NULL,
    LastError NVARCHAR(1000) NULL,
    CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_WorkerStudioProject_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_WorkerStudioProject_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_WorkerStudioProject_GuestSession FOREIGN KEY (GuestSessionId) REFERENCES dbo.WorkerStudioGuestSession(Id) ON DELETE CASCADE
  );
  CREATE INDEX IX_WorkerStudioProject_GuestSession_UpdatedAt ON dbo.WorkerStudioProject(GuestSessionId, UpdatedAt DESC);
END;

IF OBJECT_ID(N'dbo.WorkerStudioMessage', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.WorkerStudioMessage (
    Id NVARCHAR(64) NOT NULL CONSTRAINT PK_WorkerStudioMessage PRIMARY KEY,
    ProjectId NVARCHAR(64) NOT NULL,
    Role NVARCHAR(20) NOT NULL,
    Kind NVARCHAR(40) NOT NULL,
    Content NVARCHAR(MAX) NOT NULL,
    MetadataJson NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_WorkerStudioMessage_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_WorkerStudioMessage_Project FOREIGN KEY (ProjectId) REFERENCES dbo.WorkerStudioProject(Id) ON DELETE CASCADE
  );
  CREATE INDEX IX_WorkerStudioMessage_Project_CreatedAt ON dbo.WorkerStudioMessage(ProjectId, CreatedAt);
END;

IF OBJECT_ID(N'dbo.WorkerStudioApproval', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.WorkerStudioApproval (
    Id NVARCHAR(64) NOT NULL CONSTRAINT PK_WorkerStudioApproval PRIMARY KEY,
    ProjectId NVARCHAR(64) NOT NULL,
    Kind NVARCHAR(30) NOT NULL,
    SnapshotJson NVARCHAR(MAX) NOT NULL,
    ApprovedAt DATETIME2(3) NOT NULL CONSTRAINT DF_WorkerStudioApproval_ApprovedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_WorkerStudioApproval_Project FOREIGN KEY (ProjectId) REFERENCES dbo.WorkerStudioProject(Id) ON DELETE CASCADE
  );
  CREATE INDEX IX_WorkerStudioApproval_Project_ApprovedAt ON dbo.WorkerStudioApproval(ProjectId, ApprovedAt);
END;

IF OBJECT_ID(N'dbo.WorkerStudioBuild', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.WorkerStudioBuild (
    Id NVARCHAR(64) NOT NULL CONSTRAINT PK_WorkerStudioBuild PRIMARY KEY,
    ProjectId NVARCHAR(64) NOT NULL,
    Status NVARCHAR(30) NOT NULL,
    PageSpecJson NVARCHAR(MAX) NULL,
    DurationMs INT NULL,
    Result NVARCHAR(80) NULL,
    Error NVARCHAR(1000) NULL,
    CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_WorkerStudioBuild_CreatedAt DEFAULT SYSUTCDATETIME(),
    CompletedAt DATETIME2(3) NULL,
    CONSTRAINT FK_WorkerStudioBuild_Project FOREIGN KEY (ProjectId) REFERENCES dbo.WorkerStudioProject(Id) ON DELETE CASCADE
  );
  CREATE INDEX IX_WorkerStudioBuild_Project_CreatedAt ON dbo.WorkerStudioBuild(ProjectId, CreatedAt);
END;

IF OBJECT_ID(N'dbo.WorkerStudioRevision', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.WorkerStudioRevision (
    Id NVARCHAR(64) NOT NULL CONSTRAINT PK_WorkerStudioRevision PRIMARY KEY,
    ProjectId NVARCHAR(64) NOT NULL,
    RequestText NVARCHAR(MAX) NOT NULL,
    Category NVARCHAR(40) NOT NULL,
    Status NVARCHAR(30) NOT NULL,
    PlanJson NVARCHAR(MAX) NULL,
    ResultSummary NVARCHAR(1000) NULL,
    DurationMs INT NULL,
    CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_WorkerStudioRevision_CreatedAt DEFAULT SYSUTCDATETIME(),
    CompletedAt DATETIME2(3) NULL,
    CONSTRAINT FK_WorkerStudioRevision_Project FOREIGN KEY (ProjectId) REFERENCES dbo.WorkerStudioProject(Id) ON DELETE CASCADE
  );
  CREATE INDEX IX_WorkerStudioRevision_Project_CreatedAt ON dbo.WorkerStudioRevision(ProjectId, CreatedAt);
END;

IF OBJECT_ID(N'dbo.WorkerStudioProductEvent', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.WorkerStudioProductEvent (
    Id NVARCHAR(64) NOT NULL CONSTRAINT PK_WorkerStudioProductEvent PRIMARY KEY,
    ProjectId NVARCHAR(64) NOT NULL,
    Name NVARCHAR(80) NOT NULL,
    PropertiesJson NVARCHAR(MAX) NOT NULL,
    CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_WorkerStudioProductEvent_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_WorkerStudioProductEvent_Project FOREIGN KEY (ProjectId) REFERENCES dbo.WorkerStudioProject(Id) ON DELETE CASCADE
  );
  CREATE INDEX IX_WorkerStudioProductEvent_Project_CreatedAt ON dbo.WorkerStudioProductEvent(ProjectId, CreatedAt);
  CREATE INDEX IX_WorkerStudioProductEvent_Name_CreatedAt ON dbo.WorkerStudioProductEvent(Name, CreatedAt);
END;

IF OBJECT_ID(N'dbo.WorkerStudioIdempotency', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.WorkerStudioIdempotency (
    Id NVARCHAR(64) NOT NULL CONSTRAINT PK_WorkerStudioIdempotency PRIMARY KEY,
    ProjectId NVARCHAR(64) NOT NULL,
    IdempotencyKey NVARCHAR(128) NOT NULL,
    Operation NVARCHAR(50) NOT NULL,
    ResponseJson NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_WorkerStudioIdempotency_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_WorkerStudioIdempotency_Project FOREIGN KEY (ProjectId) REFERENCES dbo.WorkerStudioProject(Id) ON DELETE CASCADE,
    CONSTRAINT UQ_WorkerStudioIdempotency_Project_Key UNIQUE (ProjectId, IdempotencyKey)
  );
END;

IF NOT EXISTS (SELECT 1 FROM dbo.WorkerStudioSchemaMigration WHERE Version = N'001_worker_studio')
  INSERT INTO dbo.WorkerStudioSchemaMigration (Version) VALUES (N'001_worker_studio');
