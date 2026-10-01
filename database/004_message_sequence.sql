SET XACT_ABORT ON;
SET NOCOUNT ON;

IF COL_LENGTH(N'dbo.WorkerStudioMessage', N'SequenceNumber') IS NULL
BEGIN
  ALTER TABLE dbo.WorkerStudioMessage ADD SequenceNumber INT NULL;
  EXEC(N';WITH Ranked AS (
    SELECT Id, ROW_NUMBER() OVER (PARTITION BY ProjectId ORDER BY CreatedAt, Id) AS RowNumber
    FROM dbo.WorkerStudioMessage
  )
  UPDATE message SET SequenceNumber = ranked.RowNumber
  FROM dbo.WorkerStudioMessage message
  INNER JOIN Ranked ranked ON ranked.Id = message.Id;');
  EXEC(N'ALTER TABLE dbo.WorkerStudioMessage ALTER COLUMN SequenceNumber INT NOT NULL;');
  EXEC(N'ALTER TABLE dbo.WorkerStudioMessage ADD CONSTRAINT DF_WorkerStudioMessage_SequenceNumber DEFAULT 0 FOR SequenceNumber;');
  EXEC(N'CREATE INDEX IX_WorkerStudioMessage_Project_Sequence ON dbo.WorkerStudioMessage(ProjectId, SequenceNumber);');
END;

IF NOT EXISTS (SELECT 1 FROM dbo.WorkerStudioSchemaMigration WHERE Version = N'004_message_sequence')
  INSERT INTO dbo.WorkerStudioSchemaMigration (Version) VALUES (N'004_message_sequence');
