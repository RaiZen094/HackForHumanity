SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.WorkerStudioWorkerRun', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.WorkerStudioWorkerRun (
    Id NVARCHAR(64) NOT NULL CONSTRAINT PK_WorkerStudioWorkerRun PRIMARY KEY,
    ProjectId NVARCHAR(64) NOT NULL,
    WorkerId NVARCHAR(80) NOT NULL,
    InputText NVARCHAR(MAX) NOT NULL,
    ResultJson NVARCHAR(MAX) NOT NULL,
    CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_WorkerStudioWorkerRun_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_WorkerStudioWorkerRun_Project FOREIGN KEY (ProjectId) REFERENCES dbo.WorkerStudioProject(Id) ON DELETE CASCADE
  );
  CREATE INDEX IX_WorkerStudioWorkerRun_Project_CreatedAt ON dbo.WorkerStudioWorkerRun(ProjectId, CreatedAt DESC);
END;

IF NOT EXISTS (SELECT 1 FROM dbo.WorkerStudioSchemaMigration WHERE Version = N'002_worker_runs')
  INSERT INTO dbo.WorkerStudioSchemaMigration (Version) VALUES (N'002_worker_runs');
