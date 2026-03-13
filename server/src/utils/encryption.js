/**
 * encryption.js — AES-256-CBC Utility for HRMS
 * 
 * Place this file at:  src/utils/encryption.js
 * 
 * Add this to your .env file:
 *   ENCRYPTION_KEY=your_32_character_secret_key_here!!
 * 
 * The key MUST be exactly 32 characters (256 bits).
 * Generate one: node -e "console.log(require('crypto').randomBytes(32).toString('hex').slice(0,32))"
 */

const crypto = require('crypto');

const ALGORITHM  = 'aes-256-cbc';
const IV_LENGTH  = 16; // AES block size

// Read key from env — must be exactly 32 chars
const RAW_KEY = process.env.ENCRYPTION_KEY || 'hrms_default_key_change_in_prod!'; // 32 chars

if (RAW_KEY.length !== 32) {
  throw new Error(
    `ENCRYPTION_KEY must be exactly 32 characters. Current length: ${RAW_KEY.length}`
  );
}

const KEY = Buffer.from(RAW_KEY, 'utf8');

// ─── ENCRYPT ──────────────────────────────────────────────────────────────────
const encrypt = (text) => {
  if (text === null || text === undefined || text === '') return text;
  const value     = String(text);
  const iv        = crypto.randomBytes(IV_LENGTH);
  const cipher    = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
};

// ─── DECRYPT ──────────────────────────────────────────────────────────────────
const decrypt = (text) => {
  if (text === null || text === undefined || text === '') return text;
  const value = String(text);
  if (!value.includes(':')) return value; // not encrypted — return as-is
  try {
    const [ivHex, encryptedHex] = value.split(':');
    if (!ivHex || !encryptedHex) return value;
    const iv        = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher  = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return value; // fallback for old unencrypted records
  }
};

// ─── DECRYPT NUMBER ────────────────────────────────────────────────────────────
// Decrypts an encrypted salary string back to a Number. Returns 0 if missing.
const decryptNumber = (text) => {
  const raw = decrypt(text);
  if (raw === null || raw === undefined || raw === '') return 0;
  const num = parseFloat(raw);
  return isNaN(num) ? 0 : num;
};

// ─── ENCRYPT EMPLOYEE OBJECT ──────────────────────────────────────────────────
/**
 * Encrypts all sensitive fields before saving to DB.
 * 
 * IMPORTANT — schema change required for baseSalary:
 *   In Employee.js change  baseSalary: { type: Number }
 *   to                     baseSalary: { type: mongoose.Schema.Types.Mixed }
 *   This allows storing either a Number (old records) or an encrypted String.
 */
const encryptEmployee = (data) => {
  return {
    ...data,
    // Personal
    contact:                  encrypt(data.contact),
    address:                  encrypt(data.address),
    currentAddress:           encrypt(data.currentAddress),
    personalEmail:            encrypt(data.personalEmail),
    gender:                   encrypt(data.gender),
    maritalStatus:            encrypt(data.maritalStatus),
    nationality:              encrypt(data.nationality),
    dateOfBirth:              data.dateOfBirth, // Date — not encrypted

    // Salary
    baseSalary: (data.baseSalary !== null && data.baseSalary !== undefined && data.baseSalary !== '')
      ? encrypt(String(data.baseSalary))
      : data.baseSalary,

    // Identity
    panNumber:                encrypt(data.panNumber),
    aadharNumber:             encrypt(data.aadharNumber),

    // Bank
    bankName:                 encrypt(data.bankName),
    bankAccountNumber:        encrypt(data.bankAccountNumber),
    ifscCode:                 encrypt(data.ifscCode),

    // Emergency Contact
    emergencyContactName:     encrypt(data.emergencyContactName),
    emergencyContactPhone:    encrypt(data.emergencyContactPhone),
    emergencyContactRelation: encrypt(data.emergencyContactRelation),
  };
};

// ─── DECRYPT EMPLOYEE OBJECT ──────────────────────────────────────────────────
const decryptEmployee = (emp) => {
  if (!emp) return emp;
  const obj = typeof emp.toObject === 'function' ? emp.toObject() : { ...emp };
  return {
    ...obj,
    contact:                  decrypt(obj.contact),
    address:                  decrypt(obj.address),
    currentAddress:           decrypt(obj.currentAddress),
    personalEmail:            decrypt(obj.personalEmail),
    gender:                   decrypt(obj.gender),
    maritalStatus:            decrypt(obj.maritalStatus),
    nationality:              decrypt(obj.nationality),
    baseSalary:               decryptNumber(obj.baseSalary), // returns Number
    panNumber:                decrypt(obj.panNumber),
    aadharNumber:             decrypt(obj.aadharNumber),
    bankName:                 decrypt(obj.bankName),
    bankAccountNumber:        decrypt(obj.bankAccountNumber),
    ifscCode:                 decrypt(obj.ifscCode),
    emergencyContactName:     decrypt(obj.emergencyContactName),
    emergencyContactPhone:    decrypt(obj.emergencyContactPhone),
    emergencyContactRelation: decrypt(obj.emergencyContactRelation),
  };
};

module.exports = { encrypt, decrypt, decryptNumber, encryptEmployee, decryptEmployee };