// backend/src/scripts/seed-drugs.ts
// Seeds ~30 common medications into medication_stock for EVERY institution.
//
// Run with:  bun run src/scripts/seed-drugs.ts
// Safe to re-run: skips a drug if the same name+strength already exists for
// that institution (so it won't create duplicates).

import { db } from '../db';
import { medicationStock, stockMovements, institutions, practitioners } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';

// ── Drug catalogue ──────────────────────────────────────────────────────────
// Strengths/forms chosen to match what doctors typically prescribe so the
// dispense auto-deduct (matches by name + strength) lines up.

type DrugSeed = {
  medicationName: string;
  genericName?: string;
  strength: string;
  dosageForm: string;
  unit: string;
  quantity: number;
  reorderLevel: number;
};

const DRUGS: DrugSeed[] = [
  // Antibiotics
  { medicationName: 'Amoxicillin', genericName: 'Amoxicillin', strength: '500mg', dosageForm: 'capsule', unit: 'units', quantity: 480, reorderLevel: 100 },
  { medicationName: 'Amoxicillin', genericName: 'Amoxicillin', strength: '250mg', dosageForm: 'capsule', unit: 'units', quantity: 360, reorderLevel: 80 },
  { medicationName: 'Co-amoxiclav', genericName: 'Amoxicillin/Clavulanate', strength: '625mg', dosageForm: 'tablet', unit: 'units', quantity: 200, reorderLevel: 50 },
  { medicationName: 'Ciprofloxacin', genericName: 'Ciprofloxacin', strength: '500mg', dosageForm: 'tablet', unit: 'units', quantity: 240, reorderLevel: 60 },
  { medicationName: 'Metronidazole', genericName: 'Metronidazole', strength: '400mg', dosageForm: 'tablet', unit: 'units', quantity: 300, reorderLevel: 80 },
  { medicationName: 'Doxycycline', genericName: 'Doxycycline', strength: '100mg', dosageForm: 'capsule', unit: 'units', quantity: 180, reorderLevel: 40 },
  { medicationName: 'Azithromycin', genericName: 'Azithromycin', strength: '500mg', dosageForm: 'tablet', unit: 'units', quantity: 120, reorderLevel: 30 },
  { medicationName: 'Ceftriaxone', genericName: 'Ceftriaxone', strength: '1g', dosageForm: 'injection', unit: 'vials', quantity: 90, reorderLevel: 25 },

  // Analgesics / anti-inflammatory
  { medicationName: 'Paracetamol', genericName: 'Acetaminophen', strength: '500mg', dosageForm: 'tablet', unit: 'units', quantity: 600, reorderLevel: 150 },
  { medicationName: 'Ibuprofen', genericName: 'Ibuprofen', strength: '400mg', dosageForm: 'tablet', unit: 'units', quantity: 420, reorderLevel: 100 },
  { medicationName: 'Diclofenac', genericName: 'Diclofenac Sodium', strength: '50mg', dosageForm: 'tablet', unit: 'units', quantity: 260, reorderLevel: 60 },
  { medicationName: 'Tramadol', genericName: 'Tramadol', strength: '50mg', dosageForm: 'capsule', unit: 'units', quantity: 140, reorderLevel: 40 },
  { medicationName: 'Morphine', genericName: 'Morphine Sulfate', strength: '10mg', dosageForm: 'injection', unit: 'vials', quantity: 40, reorderLevel: 15 },

  // Antimalarials
  { medicationName: 'Artemether-Lumefantrine', genericName: 'Coartem', strength: '20/120mg', dosageForm: 'tablet', unit: 'units', quantity: 320, reorderLevel: 80 },
  { medicationName: 'Quinine', genericName: 'Quinine Sulfate', strength: '300mg', dosageForm: 'tablet', unit: 'units', quantity: 150, reorderLevel: 40 },

  // Anti-TB / HIV (common in Zambia)
  { medicationName: 'Rifampicin', genericName: 'Rifampicin', strength: '150mg', dosageForm: 'tablet', unit: 'units', quantity: 200, reorderLevel: 50 },
  { medicationName: 'Isoniazid', genericName: 'Isoniazid', strength: '300mg', dosageForm: 'tablet', unit: 'units', quantity: 180, reorderLevel: 50 },
  { medicationName: 'Tenofovir-Lamivudine-Dolutegravir', genericName: 'TLD', strength: '300/300/50mg', dosageForm: 'tablet', unit: 'units', quantity: 280, reorderLevel: 70 },

  // Cardiovascular
  { medicationName: 'Amlodipine', genericName: 'Amlodipine', strength: '5mg', dosageForm: 'tablet', unit: 'units', quantity: 300, reorderLevel: 80 },
  { medicationName: 'Lisinopril', genericName: 'Lisinopril', strength: '10mg', dosageForm: 'tablet', unit: 'units', quantity: 220, reorderLevel: 60 },
  { medicationName: 'Hydrochlorothiazide', genericName: 'HCTZ', strength: '25mg', dosageForm: 'tablet', unit: 'units', quantity: 200, reorderLevel: 50 },
  { medicationName: 'Atenolol', genericName: 'Atenolol', strength: '50mg', dosageForm: 'tablet', unit: 'units', quantity: 160, reorderLevel: 40 },
  { medicationName: 'Furosemide', genericName: 'Furosemide', strength: '40mg', dosageForm: 'tablet', unit: 'units', quantity: 180, reorderLevel: 50 },

  // Diabetes
  { medicationName: 'Metformin', genericName: 'Metformin', strength: '500mg', dosageForm: 'tablet', unit: 'units', quantity: 400, reorderLevel: 100 },
  { medicationName: 'Glibenclamide', genericName: 'Glibenclamide', strength: '5mg', dosageForm: 'tablet', unit: 'units', quantity: 150, reorderLevel: 40 },
  { medicationName: 'Insulin (Soluble)', genericName: 'Human Insulin', strength: '100IU/ml', dosageForm: 'injection', unit: 'vials', quantity: 60, reorderLevel: 20 },

  // GI / other
  { medicationName: 'Omeprazole', genericName: 'Omeprazole', strength: '20mg', dosageForm: 'capsule', unit: 'units', quantity: 340, reorderLevel: 80 },
  { medicationName: 'Oral Rehydration Salts', genericName: 'ORS', strength: 'sachet', dosageForm: 'syrup', unit: 'sachets', quantity: 500, reorderLevel: 120 },
  { medicationName: 'Salbutamol', genericName: 'Salbutamol', strength: '100mcg', dosageForm: 'inhaler', unit: 'units', quantity: 80, reorderLevel: 25 },
  { medicationName: 'Prednisolone', genericName: 'Prednisolone', strength: '5mg', dosageForm: 'tablet', unit: 'units', quantity: 220, reorderLevel: 60 },
  { medicationName: 'Chlorpheniramine', genericName: 'Chlorpheniramine Maleate', strength: '4mg', dosageForm: 'tablet', unit: 'units', quantity: 260, reorderLevel: 60 },
];

const SUPPLIERS = [
  'Meddent Pharmaceuticals Ltd',
  'Zampharm Distributors',
  'Pharmanova Zambia',
  'Missionpharma',
  'Kanyama Medical Supplies',
];

// Random helpers
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function randomBatch(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  return `B${pick(letters.split(''))}${pick(letters.split(''))}-${Math.floor(1000 + Math.random() * 9000)}`;
}

// Expiry between 3 months and 3 years out; a couple deliberately near-term
function randomExpiry(i: number): string {
  const now = new Date();
  // every 10th drug gets a near-expiry date (within 90 days) to demo warnings
  const monthsOut = (i % 10 === 0) ? 2 : 6 + Math.floor(Math.random() * 30);
  const d = new Date(now.getFullYear(), now.getMonth() + monthsOut, 15 + (i % 10));
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

async function main() {
  console.log('🌱 Seeding medication stock...\n');

  // All institutions
  const allInstitutions = await db.select({ id: institutions.id }).from(institutions);
  if (!allInstitutions.length) {
    console.error('No institutions found. Nothing to seed.');
    process.exit(1);
  }

  // Find a pharmacist (or any practitioner) per institution to attribute the
  // movement log to. Falls back to the first practitioner found.
  const [anyStaff] = await db.select({ id: practitioners.id }).from(practitioners).limit(1);
  const performedBy = anyStaff?.id ?? null;

  let inserted = 0;
  let skipped = 0;

  for (const inst of allInstitutions) {
    console.log(`🏥 ${inst.name}`);
    for (let i = 0; i < DRUGS.length; i++) {
      const drug = DRUGS[i];

      // Skip if this drug+strength already exists for this institution
      const existing = await db.select({ id: medicationStock.id })
        .from(medicationStock)
        .where(and(
          eq(medicationStock.institutionId, inst.id),
          sql`LOWER(${medicationStock.medicationName}) = LOWER(${drug.medicationName})`,
          sql`LOWER(${medicationStock.strength}) = LOWER(${drug.strength})`,
        ))
        .limit(1);

      if (existing.length) { skipped++; continue; }

      const [created] = await db.insert(medicationStock).values({
        institutionId: inst.id,
        medicationName: drug.medicationName,
        genericName: drug.genericName ?? null,
        strength: drug.strength,
        dosageForm: drug.dosageForm,
        unit: drug.unit,
        quantity: drug.quantity,
        reorderLevel: drug.reorderLevel,
        batchNumber: randomBatch(),
        expiryDate: randomExpiry(i),
        supplier: pick(SUPPLIERS),
      }).returning({ id: medicationStock.id });

      // Movement log entry (only if we have a staff id to attribute it to)
      if (performedBy) {
        await db.insert(stockMovements).values({
          stockId: created.id,
          institutionId: inst.id,
          changeType: 'restock',
          quantityChange: drug.quantity,
          quantityAfter: drug.quantity,
          performedBy,
          notes: 'Seeded initial stock',
        });
      }

      inserted++;
    }
    console.log(`   ✓ done\n`);
  }

  console.log(`\n✅ Seeding complete.`);
  console.log(`   Inserted: ${inserted}`);
  console.log(`   Skipped (already existed): ${skipped}`);
  console.log(`   Institutions: ${allInstitutions.length}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
