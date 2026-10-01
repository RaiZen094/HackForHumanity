SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.WorkerStudioAsset', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.WorkerStudioAsset (
    Id NVARCHAR(64) NOT NULL CONSTRAINT PK_WorkerStudioAsset PRIMARY KEY,
    ProjectId NVARCHAR(64) NOT NULL,
    WorkerId NVARCHAR(80) NOT NULL,
    PromptText NVARCHAR(MAX) NOT NULL,
    AltText NVARCHAR(500) NOT NULL,
    MimeType NVARCHAR(80) NOT NULL,
    ImageData VARBINARY(MAX) NOT NULL,
    CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_WorkerStudioAsset_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_WorkerStudioAsset_Project FOREIGN KEY (ProjectId) REFERENCES dbo.WorkerStudioProject(Id) ON DELETE CASCADE
  );
  CREATE INDEX IX_WorkerStudioAsset_Project_CreatedAt ON dbo.WorkerStudioAsset(ProjectId, CreatedAt DESC);
END;

IF NOT EXISTS (SELECT 1 FROM dbo.WorkerStudioSchemaMigration WHERE Version = N'003_generated_assets')
  INSERT INTO dbo.WorkerStudioSchemaMigration (Version) VALUES (N'003_generated_assets');
