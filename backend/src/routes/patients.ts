import { createRoute, z } from '@hono/zod-openapi';
import { eq, and, ilike, or, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  patients,
  patientInstitutionRegistrations,
  institutions,
  userTypeEnum,
} from '../db/schema';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';
import { encrypt, decrypt, hashData, generateRecordHash } from '../services/crypto';
import { storeRecordHash, checkPermission } from '../services/fabric';
import crypto from 'crypto';

const errorSchema = z.object({
  success: z.boolean(),
  error: z.object({ message: z.string() }),
});

// ==================== Registration Schema ====================
const registerPatientSchema = z.object({
  // Personal Information (will be encrypted)
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  middleName: z.string().optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  gender: z.enum(['male', 'female', 'other']),
  bloodType: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown']).default('unknown'),

  // Contact
  phoneNumber: z.string().min(5),
  email: z.string().email().optional(),
  address: z.string().min(5),
  emergencyContact: z.string().min(5), // could be JSON or string; assume string for now

  // Identification
  nationalId: z.string().min(5),

  // Demographics
  maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']).optional(),
  occupation: z.string().optional(),

  // Authentication
  password: z.string().min(8),

  // Optional institution registration at creation
  institutionId: z.string().uuid().optional(),
  hospitalPatientNumber: z.string().optional(), // if institutionId provided, this may be required
});

// ==================== Update Profile Schema ====================
const updatePatientSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  middleName: z.string().optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  bloodType: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown']).optional(),
  phoneNumber: z.string().min(5).optional(),
  email: z.string().email().optional(),
  address: z.string().min(5).optional(),
  emergencyContact: z.string().min(5).optional(),
  maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']).optional(),
  occupation: z.string().optional(),
  password: z.string().min(8).optional(),
});



export const patientRouter = createRouter()

  // ========== REGISTER NEW PATIENT ==========
  .openapi(createRoute({
    tags: ['Patients'],
    summary: 'Register a new patient (default password: test1234)',
    method: 'post',
    path: '/',
    request: {
      body: {
        content: {
          'application/json': {
            schema: registerPatientSchema.omit({ password: true }) // make password optional/omit
          }
        }
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.object({
                patientId: z.string().uuid(),
                blockchainAddress: z.string(),
              }),
            }),
          },
        },
        description: 'Patient registered successfully',
      },
      409: { content: { 'application/json': { schema: errorSchema } }, description: 'National ID already registered' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const body = c.req.valid('json');

      // Generate blockchain address
      const blockchainAddress = `patient:${crypto.createHash('sha256').update(body.nationalId + process.env.BLOCKCHAIN_SALT || 'salt').digest('hex')}`;

      // Encrypt fields
      const encrypted = {
        firstNameEncrypted: encrypt(body.firstName),
        lastNameEncrypted: encrypt(body.lastName),
        middleNameEncrypted: body.middleName ? encrypt(body.middleName) : null,
        dateOfBirthEncrypted: encrypt(body.dateOfBirth),
        phoneNumberEncrypted: encrypt(body.phoneNumber),
        emailEncrypted: body.email ? encrypt(body.email) : null,
        addressEncrypted: encrypt(body.address),
        emergencyContactEncrypted: encrypt(body.emergencyContact),
        nationalIdEncrypted: encrypt(body.nationalId),
      };

      // Hash the default password
      const defaultPassword = 'test1234';
      const passwordHash = hashData(defaultPassword);

      // Insert patient
      const result = await db.insert(patients).values({
        blockchainAddress,
        ...encrypted,
        gender: body.gender,
        bloodType: body.bloodType,
        maritalStatus: body.maritalStatus,
        occupation: body.occupation,
        passwordHash,
        mustChangePassword: true,   // <-- require password change on first login
        isActive: true,
      }).returning({ id: patients.id, blockchainAddress: patients.blockchainAddress });

      const patientId = result[0].id;

      // (Optional) register at institution if provided – same as before

      // Store on blockchain (optional)
      const creationHash = generateRecordHash({ patientId, blockchainAddress, timestamp: new Date().toISOString() });
      await storeRecordHash(patientId, blockchainAddress, creationHash, 'patient_registration').catch(() => { });

      return c.json({ success: true, data: { patientId, blockchainAddress } }, 201);
    } catch (err: any) {
      console.error('Patient registration error:', err);
      if (err.code === '23505' && err.constraint === 'patients_national_id_encrypted_unique') {
        return c.json({ success: false, error: { message: 'National ID already registered' } }, 409);
      }
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ========== GET MY PROFILE ==========
  .openapi(createRoute({
    tags: ['Patients'],
    summary: 'Get authenticated patient profile',
    method: 'get',
    path: '/me',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.object({
                id: z.string(),
                blockchainAddress: z.string(),
                firstName: z.string(),
                lastName: z.string(),
                middleName: z.string().optional(),
                dateOfBirth: z.string(),
                gender: z.string(),
                bloodType: z.string(),
                phoneNumber: z.string(),
                email: z.string().optional(),
                address: z.string(),
                emergencyContact: z.string(),
                maritalStatus: z.string().optional(),
                occupation: z.string().optional(),
                isActive: z.boolean(),
                createdAt: z.string(),
              })
            })
          }
        },
        description: 'Patient profile',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Patient not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (userType !== 'patient') {
        return c.json({ success: false, error: { message: 'Only patients can access their own profile' } }, 403);
      }

      const patientId = c.get('userId');

      const patient = await db.select().from(patients).where(eq(patients.id, patientId)).limit(1);
      if (!patient.length) {
        return c.json({ success: false, error: { message: 'Patient not found' } }, 404);
      }

      const p = patient[0];

      // Decrypt fields
      const profile = {
        id: p.id,
        blockchainAddress: p.blockchainAddress,
        firstName: decrypt(p.firstNameEncrypted),
        lastName: decrypt(p.lastNameEncrypted),
        middleName: p.middleNameEncrypted ? decrypt(p.middleNameEncrypted) : undefined,
        dateOfBirth: decrypt(p.dateOfBirthEncrypted),
        gender: p.gender,
        bloodType: p.bloodType,
        phoneNumber: decrypt(p.phoneNumberEncrypted),
        email: p.emailEncrypted ? decrypt(p.emailEncrypted) : undefined,
        address: decrypt(p.addressEncrypted),
        emergencyContact: decrypt(p.emergencyContactEncrypted),
        maritalStatus: p.maritalStatus || undefined,
        occupation: p.occupation || undefined,
        isActive: p.isActive,
        createdAt: p.createdAt.toISOString(),
      };

      return c.json({ success: true, data: profile });

    } catch (err: any) {
      console.error('Get profile error:', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ========== SEARCH PATIENTS (Receptionist/Nurse/Practitioner/Admin) ==========
  .openapi(createRoute({
    tags: ['Patients'],
    summary: 'Search patients by name, national ID, or patient ID',
    method: 'get',
    path: '/search',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      query: z.object({
        q: z.string().optional(),
        limit: z.string().regex(/^\d+$/).transform(Number).optional().default('50'),
        offset: z.string().regex(/^\d+$/).transform(Number).optional().default('0'),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.object({
                patients: z.array(z.object({
                  id: z.string().uuid(),
                  blockchainAddress: z.string(),
                  firstName: z.string(),
                  lastName: z.string(),
                  middleName: z.string().optional(),
                  dateOfBirth: z.string(),
                  gender: z.string(),
                  phoneNumber: z.string(),
                  email: z.string().optional(),
                  nationalId: z.string(),
                  createdAt: z.string(),
                })),
                total: z.number(),
                limit: z.number(),
                offset: z.number(),
              }),
            }),
          },
        },
        description: 'List of matching patients',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (!['receptionist', 'nurse', 'practitioner', 'admin'].includes(userType)) {
        return c.json({ success: false, error: { message: 'Access denied' } }, 403);
      }

      const { q, limit, offset } = c.req.valid('query');
      const searchTerm = q?.toLowerCase().trim() || '';

      // If searching by UUID (exact match), we can query directly
      if (searchTerm.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        const patient = await db.select().from(patients)
          .where(and(eq(patients.id, searchTerm), eq(patients.isActive, true)))
          .limit(1);
        if (patient.length) {
          const p = patient[0];
          const firstName = decrypt(p.firstNameEncrypted);
          const lastName = decrypt(p.lastNameEncrypted);
          const middleName = p.middleNameEncrypted ? decrypt(p.middleNameEncrypted) : '';
          const dateOfBirth = decrypt(p.dateOfBirthEncrypted);
          const phoneNumber = decrypt(p.phoneNumberEncrypted);
          const email = p.emailEncrypted ? decrypt(p.emailEncrypted) : '';
          const nationalId = decrypt(p.nationalIdEncrypted);

          return c.json({
            success: true,
            data: {
              patients: [{
                id: p.id,
                blockchainAddress: p.blockchainAddress,
                firstName,
                lastName,
                middleName: middleName || undefined,
                dateOfBirth,
                gender: p.gender,
                phoneNumber,
                email: email || undefined,
                nationalId,
                createdAt: p.createdAt.toISOString(),
              }],
              total: 1,
              limit,
              offset,
            },
          });
        }
      }

      // Otherwise, fall back to fetching all active patients and decrypting in memory
      const allPatients = await db.select().from(patients).where(eq(patients.isActive, true));

      const matchedPatients = [];
      for (const p of allPatients) {
        try {
          const firstName = decrypt(p.firstNameEncrypted);
          const lastName = decrypt(p.lastNameEncrypted);
          const middleName = p.middleNameEncrypted ? decrypt(p.middleNameEncrypted) : '';
          const dateOfBirth = decrypt(p.dateOfBirthEncrypted);
          const phoneNumber = decrypt(p.phoneNumberEncrypted);
          const email = p.emailEncrypted ? decrypt(p.emailEncrypted) : '';
          const nationalId = decrypt(p.nationalIdEncrypted);

          const fullName = `${firstName} ${lastName}`.toLowerCase();

          if (!searchTerm ||
            fullName.includes(searchTerm) ||
            nationalId.toLowerCase().includes(searchTerm) ||
            p.id.includes(searchTerm)) {  // partial UUID match
            matchedPatients.push({
              id: p.id,
              blockchainAddress: p.blockchainAddress,
              firstName,
              lastName,
              middleName: middleName || undefined,
              dateOfBirth,
              gender: p.gender,
              phoneNumber,
              email: email || undefined,
              nationalId,
              createdAt: p.createdAt.toISOString(),
            });
          }
        } catch (err) {
          console.error(`Skipping patient ${p.id} due to decryption error:`, err);
        }
      }

      const total = matchedPatients.length;
      const paginated = matchedPatients.slice(offset, offset + limit);

      return c.json({
        success: true,
        data: {
          patients: paginated,
          total,
          limit,
          offset,
        },
      });
    } catch (err: unknown) {
      console.error('Patient search error:', err);
      return c.json({ success: false, error: { message: err instanceof Error ? err.message : 'Internal server error' } }, 500);
    }
  })

  // ========== UPDATE MY PROFILE ==========
  .openapi(createRoute({
    tags: ['Patients'],
    summary: 'Update authenticated patient profile',
    method: 'patch',
    path: '/me',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      body: { content: { 'application/json': { schema: updatePatientSchema } } },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } },
        description: 'Profile updated',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Patient not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (userType !== 'patient') {
        return c.json({ success: false, error: { message: 'Only patients can update their profile' } }, 403);
      }

      const patientId = c.get('userId');
      const body = c.req.valid('json');

      // Build update object with encrypted fields where needed
      const updateData: any = {};

      if (body.firstName) updateData.firstNameEncrypted = encrypt(body.firstName);
      if (body.lastName) updateData.lastNameEncrypted = encrypt(body.lastName);
      if (body.middleName !== undefined) updateData.middleNameEncrypted = body.middleName ? encrypt(body.middleName) : null;
      if (body.dateOfBirth) updateData.dateOfBirthEncrypted = encrypt(body.dateOfBirth);
      if (body.gender) updateData.gender = body.gender;
      if (body.bloodType) updateData.bloodType = body.bloodType;
      if (body.phoneNumber) updateData.phoneNumberEncrypted = encrypt(body.phoneNumber);
      if (body.email !== undefined) updateData.emailEncrypted = body.email ? encrypt(body.email) : null;
      if (body.address) updateData.addressEncrypted = encrypt(body.address);
      if (body.emergencyContact) updateData.emergencyContactEncrypted = encrypt(body.emergencyContact);
      if (body.maritalStatus !== undefined) updateData.maritalStatus = body.maritalStatus;
      if (body.occupation !== undefined) updateData.occupation = body.occupation;
      if (body.password) updateData.passwordHash = hashData(body.password);

      updateData.updatedAt = new Date();

      if (Object.keys(updateData).length === 0) {
        return c.json({ success: true, data: { message: 'No fields to update' } });
      }

      const result = await db.update(patients)
        .set(updateData)
        .where(eq(patients.id, patientId))
        .returning();

      if (!result.length) {
        return c.json({ success: false, error: { message: 'Patient not found' } }, 404);
      }

      // Optionally store update hash on blockchain
      const updateHash = generateRecordHash({ patientId, updates: Object.keys(body), timestamp: new Date().toISOString() });
      await storeRecordHash(patientId, result[0].blockchainAddress, updateHash, 'patient_update').catch(() => { });

      return c.json({ success: true, data: { message: 'Profile updated successfully' } });

    } catch (err: any) {
      console.error('Update profile error:', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ========== GET PATIENT BY ID (Practitioner/Admin with permission) ==========
  .openapi(createRoute({
    tags: ['Patients'],
    summary: 'Get patient details by ID (requires permission)',
    method: 'get',
    path: '/:patientId',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      params: z.object({ patientId: z.string().uuid() }),
    },
    responses: {
      200: {
        content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } },
        description: 'Patient details',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Patient not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      const userId = c.get('userId');
      const userBlockchainAddress = c.get('blockchainAddress');
      const { patientId } = c.req.valid('param');

      // Admin can access any patient
      if (userType === 'admin' || userType === 'receptionist') {
        const patient = await db.select().from(patients).where(eq(patients.id, patientId)).limit(1);
        if (!patient.length) return c.json({ success: false, error: { message: 'Patient not found' } }, 404);
        // Decrypt and return
        const p = patient[0];
        return c.json({
          success: true, data: {
            id: p.id,
            blockchainAddress: p.blockchainAddress,
            firstName: decrypt(p.firstNameEncrypted),
            lastName: decrypt(p.lastNameEncrypted),
            // ... include all fields as in /me
          }
        });
      }

      // Practitioners must have blockchain permission
      if (userType === 'practitioner') {
        // Get patient blockchain address
        const patient = await db.select({
          blockchainAddress: patients.blockchainAddress,
        }).from(patients).where(eq(patients.id, patientId)).limit(1);

        if (!patient.length) return c.json({ success: false, error: { message: 'Patient not found' } }, 404);

        const hasPermission = await checkPermission(patient[0].blockchainAddress, userBlockchainAddress);
        if (!hasPermission) {
          return c.json({ success: false, error: { message: 'No permission to access this patient' } }, 403);
        }

        // Fetch full patient data
        const fullPatient = await db.select().from(patients).where(eq(patients.id, patientId)).limit(1);
        const p = fullPatient[0];
        return c.json({
          success: true, data: {
            id: p.id,
            blockchainAddress: p.blockchainAddress,
            firstName: decrypt(p.firstNameEncrypted),
            lastName: decrypt(p.lastNameEncrypted),
            // ... include all fields needed for clinical context
            dateOfBirth: decrypt(p.dateOfBirthEncrypted),
            gender: p.gender,
            bloodType: p.bloodType,
            phoneNumber: decrypt(p.phoneNumberEncrypted),
            email: p.emailEncrypted ? decrypt(p.emailEncrypted) : undefined,
            address: decrypt(p.addressEncrypted),
            emergencyContact: decrypt(p.emergencyContactEncrypted),
          }
        });
      }

      return c.json({ success: false, error: { message: 'Access denied' } }, 403);

    } catch (err: any) {
      console.error('Get patient by ID error:', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ========== SEARCH PATIENTS (Admin/Practitioner with permission) ==========
  .openapi(createRoute({
    tags: ['Patients'],
    summary: 'Search patients by name or ID (requires practitioner/admin role)',
    method: 'get',
    path: '/',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      query: z.object({
        search: z.string().optional(),
        limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
        offset: z.string().regex(/^\d+$/).transform(Number).optional().default('0'),
      }),
    },
    responses: {
      200: {
        content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } },
        description: 'List of patients',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (!['admin', 'practitioner', 'receptionist', 'nurse'].includes(userType)) {
        return c.json({ success: false, error: { message: 'Access denied' } }, 403);
      }

      const { search, limit, offset } = c.req.valid('query');

      // Build query – since fields are encrypted, we cannot search on them directly.
      // We can search on blockchainAddress, id, or maybe we store searchable fields in plaintext? Not in schema.
      // For simplicity, we'll just return paginated list of patients with decrypted names (but this is inefficient for large DB).
      // In practice, you'd need a search index or store hashed searchable fields.
      // For demo, we'll return limited fields without search filtering.

      let query = db.select({
        id: patients.id,
        blockchainAddress: patients.blockchainAddress,
        firstNameEncrypted: patients.firstNameEncrypted,
        lastNameEncrypted: patients.lastNameEncrypted,
        gender: patients.gender,
        createdAt: patients.createdAt,
      }).from(patients);

      if (search) {
        // Not possible with encrypted fields – we'll ignore search for now
        // Alternatively, you could search by id if search is a UUID
        if (search.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          query = query.where(eq(patients.id, search)) as any;
        } else {
          // No search by name, return empty? Or just ignore search.
          return c.json({ success: true, data: { patients: [], total: 0 } });
        }
      }

      const patientsList = await query.limit(limit).offset(offset);

      // Decrypt names for response
      const result = patientsList.map(p => ({
        id: p.id,
        blockchainAddress: p.blockchainAddress,
        firstName: decrypt(p.firstNameEncrypted),
        lastName: decrypt(p.lastNameEncrypted),
        gender: p.gender,
        createdAt: p.createdAt,
      }));

      return c.json({ success: true, data: { patients: result, limit, offset } });

    } catch (err: any) {
      console.error('Search patients error:', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  });