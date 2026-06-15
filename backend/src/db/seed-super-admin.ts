import { db } from './index';
import { practitioners } from './schema';
import { hash } from 'bcryptjs';
import { encrypt } from '../services/crypto';
import crypto from 'crypto';

const passwordHash = await hash('SuperAdmin@123', 12);

await db.insert(practitioners).values({
  blockchainAddress:    '0x' + crypto.randomBytes(20).toString('hex'),
  firstNameEncrypted:   encrypt('Super'),
  lastNameEncrypted:    encrypt('Admin'),
  licenseNumber:        'SUPER-ADMIN-001',
  institutionalId:      'SUPER-ADMIN-001',
  institutionId:        null,
  role:                 'admin',
  specialization:       'System Administrator',
  phoneNumberEncrypted: encrypt('+260000000000'),
  emailEncrypted:       encrypt('superadmin@healthchain.zm'),
  passwordHash,
  mustChangePassword:   true,
  isVerified:           true,
  isActive:             true,
});

console.log('✅ Super admin created — License: SUPER-ADMIN-001 / Password: SuperAdmin@123');
process.exit(0);
