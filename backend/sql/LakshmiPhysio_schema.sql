/* =====================================================================================
   Lakshmi Physio - database schema (SQL Server 2016 or later; built on SQL Server 2022)

   Creates the database (if missing), all 16 tables, and the starting rows.
   Every step is guarded with IF NOT EXISTS / COL_LENGTH, so it is safe to run again
   on a database that already has some or all of the tables. It never drops or
   changes existing data.

   How to run:
     - SSMS / Azure Data Studio: open this file and Execute (F5). Keep the GO lines.
     - sqlcmd:  sqlcmd -S <server> -U <user> -P <password> -i LakshmiPhysio_schema.sql
     - To use another database name, change T_LakshmiPhysio in the two lines below
       (and DB_NAME in the backend .env).

   NOT created by this script: the first login user (Admin). Passwords are stored as
   scrypt hashes made by the backend, which SQL cannot produce. After running this
   script, on the live server set DB_* and ADMIN_INITIAL_PASSWORD in backend/.env and run:
       npm run init-db
   It sees the tables are already there and only adds the Admin user (it does nothing
   else on a database that already has data).

   Same schema as backend/src/db/initDb.js - keep the two in step when tables change.
   ===================================================================================== */

IF DB_ID(N'T_LakshmiPhysio') IS NULL
    CREATE DATABASE [T_LakshmiPhysio];
GO

USE [T_LakshmiPhysio];
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ---------------------------------------------------------------------------------
   Configuration
   --------------------------------------------------------------------------------- */

-- Clinic details (single row): login page, sidebar, printed bills, WhatsApp sender.
IF OBJECT_ID(N'dbo.ClinicMaster', N'U') IS NULL
CREATE TABLE dbo.ClinicMaster (
    ClinicId            INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    ClinicName          NVARCHAR(200) NOT NULL,
    DoctorName          NVARCHAR(200) NULL,
    EmailId             NVARCHAR(200) NULL,
    ContactNo           NVARCHAR(50)  NULL,
    Address             NVARCHAR(500) NULL,
    Logo                NVARCHAR(MAX) NULL,          -- image as data URL
    AppName             NVARCHAR(100) NULL,
    UpdatedAt           DATETIME      NOT NULL DEFAULT GETDATE()
);
GO

-- WhatsApp sender: clinic's or doctor's number (international digits, e.g. 919876543210).
-- Verified when the phone that scans the WhatsApp QR code is this same number.
IF COL_LENGTH(N'dbo.ClinicMaster', N'WhatsAppNo') IS NULL
ALTER TABLE dbo.ClinicMaster ADD
    WhatsAppNo          NVARCHAR(20)  NULL,
    WhatsAppOwner       NVARCHAR(10)  NULL,          -- Clinic | Doctor
    WhatsAppVerifiedAt  DATETIME      NULL;
GO

-- Licence / subscription validity.
IF OBJECT_ID(N'dbo.Validity', N'U') IS NULL
CREATE TABLE dbo.Validity (
    ValidityId          INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    PlanName            NVARCHAR(100) NOT NULL,
    StartDate           DATE          NOT NULL,
    EndDate             DATE          NOT NULL,
    Notes               NVARCHAR(500) NULL,
    CreatedAt           DATETIME      NOT NULL DEFAULT GETDATE()
);
GO

-- Login users. PasswordHash = "<saltHex>:<scryptHashHex>" made by the backend.
IF OBJECT_ID(N'dbo.AppUser', N'U') IS NULL
CREATE TABLE dbo.AppUser (
    UserId              INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    UserName            NVARCHAR(100) NOT NULL UNIQUE,
    FullName            NVARCHAR(200) NULL,
    PasswordHash        NVARCHAR(300) NOT NULL,
    Role                NVARCHAR(50)  NOT NULL DEFAULT 'Reception',   -- Admin | Reception | Doctor
    IsActive            BIT           NOT NULL DEFAULT 1,
    CreatedAt           DATETIME      NOT NULL DEFAULT GETDATE()
);
GO

-- Screens each user may open (Menu Access).
IF OBJECT_ID(N'dbo.MenuAccess', N'U') IS NULL
CREATE TABLE dbo.MenuAccess (
    UserId              INT           NOT NULL,
    ScreenKey           NVARCHAR(100) NOT NULL,
    CONSTRAINT PK_MenuAccess PRIMARY KEY (UserId, ScreenKey),
    CONSTRAINT FK_MenuAccess_User FOREIGN KEY (UserId) REFERENCES dbo.AppUser(UserId) ON DELETE CASCADE
);
GO

/* ---------------------------------------------------------------------------------
   Registration
   --------------------------------------------------------------------------------- */

IF OBJECT_ID(N'dbo.Patient', N'U') IS NULL
CREATE TABLE dbo.Patient (
    PatientId           INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    PatientCode         AS ('LP' + RIGHT('00000' + CAST(PatientId AS VARCHAR(10)), 5)) PERSISTED,   -- LP00001
    Name                NVARCHAR(200) NOT NULL,
    MobileNo            NVARCHAR(20)  NULL,
    Age                 INT           NULL,
    Gender              NVARCHAR(10)  NULL,
    Address             NVARCHAR(500) NULL,
    Referral            NVARCHAR(200) NULL,
    IsActive            BIT           NOT NULL DEFAULT 1,
    CreatedAt           DATETIME      NOT NULL DEFAULT GETDATE()
);
GO

IF OBJECT_ID(N'dbo.Employee', N'U') IS NULL
CREATE TABLE dbo.Employee (
    EmployeeId          INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Name                NVARCHAR(200) NOT NULL,
    MobileNo            NVARCHAR(20)  NULL,
    EmpType             NVARCHAR(20)  NOT NULL,      -- Reception | Doctor
    Address             NVARCHAR(500) NULL,
    WorkDays            NVARCHAR(100) NULL,          -- CSV: Mon,Tue,...  (Doctor only)
    FromTime            NVARCHAR(10)  NULL,          -- HH:mm             (Doctor only)
    ToTime              NVARCHAR(10)  NULL,
    BreakFrom           NVARCHAR(10)  NULL,
    BreakTo             NVARCHAR(10)  NULL,
    DoctorFee           DECIMAL(10,2) NULL,
    IsActive            BIT           NOT NULL DEFAULT 1,
    CreatedAt           DATETIME      NOT NULL DEFAULT GETDATE()
);
GO

/* ---------------------------------------------------------------------------------
   Masters (Examine)
   --------------------------------------------------------------------------------- */

IF OBJECT_ID(N'dbo.Treatment', N'U') IS NULL
CREATE TABLE dbo.Treatment (
    TreatmentId         INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TreatmentName       NVARCHAR(200)  NOT NULL,
    Exercise            NVARCHAR(1000) NULL,
    Fee                 DECIMAL(10,2)  NOT NULL DEFAULT 0,
    IsActive            BIT            NOT NULL DEFAULT 1,
    CreatedAt           DATETIME       NOT NULL DEFAULT GETDATE()
);
GO

-- Master Details: titles grouped by Category (Exercise | Modality), each with an optional
-- image (data URL). Delete is soft (IsActive = 0).
IF OBJECT_ID(N'dbo.MasterTitle', N'U') IS NULL
CREATE TABLE dbo.MasterTitle (
    MasterTitleId       INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Category            NVARCHAR(20)  NOT NULL,
    Title               NVARCHAR(200) NOT NULL,
    Image               NVARCHAR(MAX) NULL,
    IsActive            BIT           NOT NULL DEFAULT 1,
    CreatedBy           NVARCHAR(100) NULL,
    CreatedAt           DATETIME      NOT NULL DEFAULT GETDATE(),
    UpdatedAt           DATETIME      NULL
);
GO

IF OBJECT_ID(N'dbo.MasterSubTitle', N'U') IS NULL
CREATE TABLE dbo.MasterSubTitle (
    MasterSubTitleId    INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    MasterTitleId       INT           NOT NULL,
    SubTitle            NVARCHAR(200) NOT NULL,
    Image               NVARCHAR(MAX) NULL,
    IsActive            BIT           NOT NULL DEFAULT 1,
    CreatedBy           NVARCHAR(100) NULL,
    CreatedAt           DATETIME      NOT NULL DEFAULT GETDATE(),
    UpdatedAt           DATETIME      NULL,
    CONSTRAINT FK_MasterSubTitle_Title FOREIGN KEY (MasterTitleId) REFERENCES dbo.MasterTitle(MasterTitleId)
);
GO

/* ---------------------------------------------------------------------------------
   Booking, examination, follow-up
   --------------------------------------------------------------------------------- */

-- Booking / Walk-in confirmation. Status: Confirmed -> Examined -> Billed (or Cancelled)
IF OBJECT_ID(N'dbo.Booking', N'U') IS NULL
CREATE TABLE dbo.Booking (
    BookingId           INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    PatientId           INT           NOT NULL,
    DoctorId            INT           NULL,
    BookingType         NVARCHAR(20)  NOT NULL DEFAULT 'Walk-in',     -- Booking | Walk-in | Follow-up
    ConfirmTime         DATETIME      NOT NULL DEFAULT GETDATE(),
    Status              NVARCHAR(20)  NOT NULL DEFAULT 'Confirmed',
    Notes               NVARCHAR(500) NULL,
    CreatedBy           NVARCHAR(100) NULL,
    CreatedAt           DATETIME      NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Booking_Patient FOREIGN KEY (PatientId) REFERENCES dbo.Patient(PatientId),
    CONSTRAINT FK_Booking_Doctor  FOREIGN KEY (DoctorId)  REFERENCES dbo.Employee(EmployeeId)
);
GO

IF OBJECT_ID(N'dbo.Visit', N'U') IS NULL
CREATE TABLE dbo.Visit (
    VisitId             INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    BookingId           INT           NULL,
    PatientId           INT           NOT NULL,
    DoctorId            INT           NULL,
    VisitDate           DATETIME      NOT NULL DEFAULT GETDATE(),
    AssessmentNotes     NVARCHAR(MAX) NULL,
    FollowUpDate        DATE          NULL,          -- first of the VisitFollowUp dates
    DoctorFee           DECIMAL(10,2) NOT NULL DEFAULT 0,
    TreatmentFee        DECIMAL(10,2) NOT NULL DEFAULT 0,
    IsBilled            BIT           NOT NULL DEFAULT 0,
    CreatedBy           NVARCHAR(100) NULL,
    CONSTRAINT FK_Visit_Patient FOREIGN KEY (PatientId) REFERENCES dbo.Patient(PatientId),
    CONSTRAINT FK_Visit_Booking FOREIGN KEY (BookingId) REFERENCES dbo.Booking(BookingId)
);
GO

IF OBJECT_ID(N'dbo.VisitTreatment', N'U') IS NULL
CREATE TABLE dbo.VisitTreatment (
    VisitTreatmentId    INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    VisitId             INT            NOT NULL,
    TreatmentId         INT            NULL,
    TreatmentName       NVARCHAR(200)  NOT NULL,
    Exercise            NVARCHAR(1000) NULL,
    Fee                 DECIMAL(10,2)  NOT NULL DEFAULT 0,
    CONSTRAINT FK_VisitTreatment_Visit FOREIGN KEY (VisitId) REFERENCES dbo.Visit(VisitId) ON DELETE CASCADE
);
GO

-- Follow-up schedule: one row per date the doctor asked the patient to come back.
IF OBJECT_ID(N'dbo.VisitFollowUp', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.VisitFollowUp (
        VisitFollowUpId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        VisitId         INT  NOT NULL,
        FollowUpDate    DATE NOT NULL,
        CONSTRAINT FK_VisitFollowUp_Visit FOREIGN KEY (VisitId) REFERENCES dbo.Visit(VisitId) ON DELETE CASCADE,
        CONSTRAINT UQ_VisitFollowUp UNIQUE (VisitId, FollowUpDate)
    );
    -- Older databases kept only Visit.FollowUpDate: copy those dates in.
    INSERT INTO dbo.VisitFollowUp (VisitId, FollowUpDate)
    SELECT VisitId, FollowUpDate FROM dbo.Visit WHERE FollowUpDate IS NOT NULL;
END
GO

-- Choices added to the Examine follow-up drop-downs: Kind 'repeat' = every Days days, 'span' = for Days days.
IF OBJECT_ID(N'dbo.FollowUpOption', N'U') IS NULL
CREATE TABLE dbo.FollowUpOption (
    OptionId            INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Kind                NVARCHAR(10)  NOT NULL,
    Label               NVARCHAR(60)  NOT NULL,
    Days                INT           NOT NULL,
    CreatedBy           NVARCHAR(100) NULL,
    CreatedAt           DATETIME      NOT NULL DEFAULT GETDATE(),
    CONSTRAINT UQ_FollowUpOption UNIQUE (Kind, Days)
);
GO

-- Per-patient notes on a Master Details image: numbered pins (JSON [{n,x,y,text}], x/y are
-- 0..1 fractions of the image) plus one common note. RefType 'title' | 'sub'; RefId is that row's id.
IF OBJECT_ID(N'dbo.PatientImageMark', N'U') IS NULL
CREATE TABLE dbo.PatientImageMark (
    MarkId              INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    PatientId           INT           NOT NULL,
    RefType             NVARCHAR(10)  NOT NULL,
    RefId               INT           NOT NULL,
    Pins                NVARCHAR(MAX) NULL,
    CommonNote          NVARCHAR(MAX) NULL,
    IsActive            BIT           NOT NULL DEFAULT 1,
    CreatedBy           NVARCHAR(100) NULL,
    CreatedAt           DATETIME      NOT NULL DEFAULT GETDATE(),
    UpdatedBy           NVARCHAR(100) NULL,
    UpdatedAt           DATETIME      NULL,
    CONSTRAINT FK_PatientImageMark_Patient FOREIGN KEY (PatientId) REFERENCES dbo.Patient(PatientId)
);
GO

/* ---------------------------------------------------------------------------------
   Billing
   --------------------------------------------------------------------------------- */

IF OBJECT_ID(N'dbo.Bill', N'U') IS NULL
CREATE TABLE dbo.Bill (
    BillId              INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    BillNo              AS ('B' + RIGHT('000000' + CAST(BillId AS VARCHAR(10)), 6)) PERSISTED,   -- B000001
    VisitId             INT           NULL,
    PatientId           INT           NOT NULL,
    BillDate            DATETIME      NOT NULL DEFAULT GETDATE(),
    DoctorFee           DECIMAL(10,2) NOT NULL DEFAULT 0,
    TreatmentFee        DECIMAL(10,2) NOT NULL DEFAULT 0,
    Discount            DECIMAL(10,2) NOT NULL DEFAULT 0,
    NetAmount           DECIMAL(10,2) NOT NULL DEFAULT 0,
    PaymentMode         NVARCHAR(30)  NULL,
    CreatedBy           NVARCHAR(100) NULL,
    CONSTRAINT FK_Bill_Patient FOREIGN KEY (PatientId) REFERENCES dbo.Patient(PatientId),
    CONSTRAINT FK_Bill_Visit   FOREIGN KEY (VisitId)   REFERENCES dbo.Visit(VisitId)
);
GO

/* ---------------------------------------------------------------------------------
   Starting rows (only when the table is empty)
   --------------------------------------------------------------------------------- */

IF NOT EXISTS (SELECT 1 FROM dbo.ClinicMaster)
    INSERT INTO dbo.ClinicMaster (ClinicName, AppName) VALUES (N'Lakshmi Physio', N'Lakshmi Physio');

IF NOT EXISTS (SELECT 1 FROM dbo.Validity)
    INSERT INTO dbo.Validity (PlanName, StartDate, EndDate, Notes)
    VALUES (N'Annual', CAST(GETDATE() AS DATE), DATEADD(YEAR, 1, CAST(GETDATE() AS DATE)), N'Initial plan');
GO

PRINT 'Lakshmi Physio schema ready. Next: run "npm run init-db" in backend to create the Admin login.';
GO
