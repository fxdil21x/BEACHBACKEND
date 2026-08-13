import 'dotenv/config';
import mongoose from 'mongoose';
import ResidentRecord from '../models/ResidentRecord.js';
import ResidentPass from '../models/ResidentPass.js';
import ResidentEntryLog from '../models/ResidentEntryLog.js';
import { connectDB } from '../config/db.js';

async function clearResidentData() {
  await connectDB();

  const [records, passes, entryLogs] = await Promise.all([
    ResidentRecord.deleteMany({}),
    ResidentPass.deleteMany({}),
    ResidentEntryLog.deleteMany({}),
  ]);

  console.log('Cleared resident data:');
  console.log(`  Resident records: ${records.deletedCount}`);
  console.log(`  Resident passes:  ${passes.deletedCount}`);
  console.log(`  Entry logs:       ${entryLogs.deletedCount}`);

  await mongoose.disconnect();
}

clearResidentData().catch((err) => {
  console.error('Clear failed:', err);
  process.exit(1);
});
