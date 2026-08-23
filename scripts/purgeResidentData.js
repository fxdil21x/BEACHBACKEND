import 'dotenv/config';
import mongoose from 'mongoose';
import ResidentRecord from '../models/ResidentRecord.js';
import ResidentPass from '../models/ResidentPass.js';
import ResidentEntryLog from '../models/ResidentEntryLog.js';
import User from '../models/User.js';
import { connectDB } from '../config/db.js';

async function purgeResidentData() {
  console.log('Connecting to database...');
  await connectDB();

  console.log('Purging all resident data (Preserving all ADMIN and MASTER_ADMIN accounts)...');

  const [records, passes, entryLogs, residentUsers] = await Promise.all([
    ResidentRecord.deleteMany({}),
    ResidentPass.deleteMany({}),
    ResidentEntryLog.deleteMany({}),
    // Strictly delete only role: 'USER'
    User.deleteMany({ role: 'USER' }),
  ]);

  console.log('Successfully purged resident data:');
  console.log(`  - Resident records:  ${records.deletedCount}`);
  console.log(`  - Resident passes:   ${passes.deletedCount}`);
  console.log(`  - Entry logs:        ${entryLogs.deletedCount}`);
  console.log(`  - Resident accounts: ${residentUsers.deletedCount}`);
  console.log('ADMIN and MASTER_ADMIN accounts preserved intact.');

  await mongoose.disconnect();
  console.log('Done.');
}

purgeResidentData().catch((err) => {
  console.error('Purge failed:', err);
  process.exit(1);
});
