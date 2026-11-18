// Re-runnable schema + seed script for Lakshmi Physio.
// Creates the database itself (if missing), then every table with IF NOT EXISTS
// guards, so running it again on a live database is safe.
import crypto from 'crypto';
import sql from 'mssql';
import dotenv from 'dotenv';
import { hashPassword } from '../utils/password.js';

dotenv.config();

const base = {
  server: process.env.DB_SERVER,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT) || 1433,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
    enableArithAbort: true,
  },
};
const DB = process.env.DB_NAME;

const schema = `
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ClinicMaster' AND xtype='U')
CREATE TABLE ClinicMaster (
    ClinicId    INT IDENTITY(1,1) PRIMARY KEY,
    ClinicName  NVARCHAR(200) NOT NULL,
    DoctorName  NVARCHAR(200) NULL,
    EmailId     NVARCHAR(200) NULL,
    ContactNo   NVARCHAR(50)  NULL,
    Address     NVARCHAR(500) NULL,
    Logo        NVARCHAR(MAX) NULL,
    AppName     NVARCHAR(100) NULL,
    UpdatedAt   DATETIME NOT NULL DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Validity' AND xtype='U')
CREATE TABLE Validity (
    ValidityId  INT IDENTITY(1,1) PRIMARY KEY,
    PlanName    NVARCHAR(100) NOT NULL,
    StartDate   DATE NOT NULL,
    EndDate     DATE NOT NULL,
    Notes       NVARCHAR(500) NULL,
    CreatedAt   DATETIME NOT NULL DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AppUser' AND xtype='U')
CREATE TABLE AppUser (
    UserId       INT IDENTITY(1,1) PRIMARY KEY,
    UserName     NVARCHAR(100) NOT NULL UNIQUE,
    FullName     NVARCHAR(200) NULL,
    PasswordHash NVARCHAR(300) NOT NULL,
    Role         NVARCHAR(50)  NOT NULL DEFAULT 'Reception',
    IsActive     BIT NOT NULL DEFAULT 1,
    CreatedAt    DATETIME NOT NULL DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='MenuAccess' AND xtype='U')
CREATE TABLE MenuAccess (
    UserId     INT NOT NULL,
    ScreenKey  NVARCHAR(100) NOT NULL,
    CONSTRAINT PK_MenuAccess PRIMARY KEY (UserId, ScreenKey),
    CONSTRAINT FK_MenuAccess_User FOREIGN KEY (UserId) REFERENCES AppUser(UserId) ON DELETE CASCADE
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Patient' AND xtype='U')
CREATE TABLE Patient (
    PatientId    INT IDENTITY(1,1) PRIMARY KEY,
    PatientCode  AS ('LP' + RIGHT('00000' + CAST(PatientId AS VARCHAR(10)), 5)) PERSISTED,
    Name         NVARCHAR(200) NOT NULL,
    MobileNo     NVARCHAR(20)  NULL,
    Age          INT NULL,
    Gender       NVARCHAR(10)  NULL,
    Address      NVARCHAR(500) NULL,
    Referral     NVARCHAR(200) NULL,
    IsActive     BIT NOT NULL DEFAULT 1,
    CreatedAt    DATETIME NOT NULL DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Employee' AND xtype='U')
CREATE TABLE Employee (
    EmployeeId  INT IDENTITY(1,1) PRIMARY KEY,
    Name        NVARCHAR(200) NOT NULL,
    MobileNo    NVARCHAR(20)  NULL,
    EmpType     NVARCHAR(20)  NOT NULL,           -- Reception | Doctor
    Address     NVARCHAR(500) NULL,
    WorkDays    NVARCHAR(100) NULL,               -- CSV: Mon,Tue,...  (Doctor only)
    FromTime    NVARCHAR(10)  NULL,               -- HH:mm             (Doctor only)
    ToTime      NVARCHAR(10)  NULL,
    BreakFrom   NVARCHAR(10)  NULL,
    BreakTo     NVARCHAR(10)  NULL,
    DoctorFee   DECIMAL(10,2) NULL,
    IsActive    BIT NOT NULL DEFAULT 1,
    CreatedAt   DATETIME NOT NULL DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Treatment' AND xtype='U')
CREATE TABLE Treatment (
    TreatmentId   INT IDENTITY(1,1) PRIMARY KEY,
    TreatmentName NVARCHAR(200) NOT NULL,
    Exercise      NVARCHAR(1000) NULL,
    Fee           DECIMAL(10,2) NOT NULL DEFAULT 0,
    IsActive      BIT NOT NULL DEFAULT 1,
    CreatedAt     DATETIME NOT NULL DEFAULT GETDATE()
);

-- Booking / Walk-in confirmation. Status: Confirmed -> Examined -> Billed (or Cancelled)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Booking' AND xtype='U')
CREATE TABLE Booking (
    BookingId    INT IDENTITY(1,1) PRIMARY KEY,
    PatientId    INT NOT NULL,
    DoctorId     INT NULL,
    BookingType  NVARCHAR(20) NOT NULL DEFAULT 'Walk-in',   -- Booking | Walk-in | Follow-up
    ConfirmTime  DATETIME NOT NULL DEFAULT GETDATE(),
    Status       NVARCHAR(20) NOT NULL DEFAULT 'Confirmed',
    Notes        NVARCHAR(500) NULL,
    CreatedBy    NVARCHAR(100) NULL,
    CreatedAt    DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Booking_Patient FOREIGN KEY (PatientId) REFERENCES Patient(PatientId),
    CONSTRAINT FK_Booking_Doctor  FOREIGN KEY (DoctorId)  REFERENCES Employee(EmployeeId)
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Visit' AND xtype='U')
CREATE TABLE Visit (
    VisitId         INT IDENTITY(1,1) PRIMARY KEY,
    BookingId       INT NULL,
    PatientId       INT NOT NULL,
    DoctorId        INT NULL,
    VisitDate       DATETIME NOT NULL DEFAULT GETDATE(),
    AssessmentNotes NVARCHAR(MAX) NULL,
    FollowUpDate    DATE NULL,
    DoctorFee       DECIMAL(10,2) NOT NULL DEFAULT 0,
    TreatmentFee    DECIMAL(10,2) NOT NULL DEFAULT 0,
    IsBilled        BIT NOT NULL DEFAULT 0,
    CreatedBy       NVARCHAR(100) NULL,
    CONSTRAINT FK_Visit_Patient FOREIGN KEY (PatientId) REFERENCES Patient(PatientId),
    CONSTRAINT FK_Visit_Booking FOREIGN KEY (BookingId) REFERENCES Booking(BookingId)
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='VisitTreatment' AND xtype='U')
CREATE TABLE VisitTreatment (
    VisitTreatmentId INT IDENTITY(1,1) PRIMARY KEY,
    VisitId          INT NOT NULL,
    TreatmentId      INT NULL,
    TreatmentName    NVARCHAR(200) NOT NULL,
    Exercise         NVARCHAR(1000) NULL,
    Fee              DECIMAL(10,2) NOT NULL DEFAULT 0,
    CONSTRAINT FK_VisitTreatment_Visit FOREIGN KEY (VisitId) REFERENCES Visit(VisitId) ON DELETE CASCADE
);

-- Follow-up schedule: one row per date the doctor asked the patient to come back
-- (e.g. alternate days for a week). Visit.FollowUpDate keeps the first of these.
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='VisitFollowUp' AND xtype='U')
BEGIN
CREATE TABLE VisitFollowUp (
    VisitFollowUpId INT IDENTITY(1,1) PRIMARY KEY,
    VisitId         INT NOT NULL,
    FollowUpDate    DATE NOT NULL,
    CONSTRAINT FK_VisitFollowUp_Visit FOREIGN KEY (VisitId) REFERENCES Visit(VisitId) ON DELETE CASCADE,
    CONSTRAINT UQ_VisitFollowUp UNIQUE (VisitId, FollowUpDate)
);
INSERT INTO VisitFollowUp (VisitId, FollowUpDate) SELECT VisitId, FollowUpDate FROM Visit WHERE FollowUpDate IS NOT NULL;
END

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Bill' AND xtype='U')
CREATE TABLE Bill (
    BillId        INT IDENTITY(1,1) PRIMARY KEY,
    BillNo        AS ('B' + RIGHT('000000' + CAST(BillId AS VARCHAR(10)), 6)) PERSISTED,
    VisitId       INT NULL,
    PatientId     INT NOT NULL,
    BillDate      DATETIME NOT NULL DEFAULT GETDATE(),
    DoctorFee     DECIMAL(10,2) NOT NULL DEFAULT 0,
    TreatmentFee  DECIMAL(10,2) NOT NULL DEFAULT 0,
    Discount      DECIMAL(10,2) NOT NULL DEFAULT 0,
    NetAmount     DECIMAL(10,2) NOT NULL DEFAULT 0,
    PaymentMode   NVARCHAR(30) NULL,
    CreatedBy     NVARCHAR(100) NULL,
    CONSTRAINT FK_Bill_Patient FOREIGN KEY (PatientId) REFERENCES Patient(PatientId),
    CONSTRAINT FK_Bill_Visit   FOREIGN KEY (VisitId)   REFERENCES Visit(VisitId)
);
`;

async function main() {
  const master = await new sql.ConnectionPool({ ...base, database: 'master' }).connect();
  await master.request().query(`IF DB_ID(N'${DB}') IS NULL CREATE DATABASE [${DB}]`);
  await master.close();
  console.log('Database ready:', DB);

  const pool = await new sql.ConnectionPool({ ...base, database: DB }).connect();
  await pool.request().batch(schema);
  console.log('Tables ready');

  const users = await pool.request().query('SELECT COUNT(*) AS c FROM AppUser');
  if (users.recordset[0].c === 0) {
    // The first admin's password comes from .env (never committed). If it isn't set,
    // a random one is generated and printed once here.
    const pwd = process.env.ADMIN_INITIAL_PASSWORD || crypto.randomBytes(9).toString('base64url');
    await pool.request()
      .input('h', sql.NVarChar, hashPassword(pwd))
      .query(`INSERT INTO AppUser (UserName, FullName, PasswordHash, Role) VALUES ('Admin','Administrator',@h,'Admin')`);
    console.log(process.env.ADMIN_INITIAL_PASSWORD
      ? 'Seeded user Admin with ADMIN_INITIAL_PASSWORD from .env'
      : `Seeded user Admin with generated password: ${pwd}  (change it after first login)`);
  }
  const clinic = await pool.request().query('SELECT COUNT(*) AS c FROM ClinicMaster');
  if (clinic.recordset[0].c === 0) {
    await pool.request().query(`INSERT INTO ClinicMaster (ClinicName, AppName) VALUES ('Lakshmi Physio','Lakshmi Physio')`);
  }
  const validity = await pool.request().query('SELECT COUNT(*) AS c FROM Validity');
  if (validity.recordset[0].c === 0) {
    await pool.request().query(`INSERT INTO Validity (PlanName, StartDate, EndDate, Notes)
      VALUES ('Annual', CAST(GETDATE() AS DATE), DATEADD(YEAR, 1, CAST(GETDATE() AS DATE)), 'Initial plan')`);
  }
  await pool.close();
  console.log('Done');
}

main().catch((e) => { console.error(e); process.exit(1); });
