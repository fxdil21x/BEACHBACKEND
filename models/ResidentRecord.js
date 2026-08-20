import mongoose from 'mongoose';

const residentRecordSchema = new mongoose.Schema(
  {
    serialNo: { type: Number },
    name: { type: String, required: true, trim: true, index: true },
    guardianName: { type: String, trim: true },
    oldWardNoHouseNo: { type: String, trim: true },
    houseName: { type: String, trim: true, index: true },
    gender: { type: String, trim: true },
    age: { type: Number },
    newSecIdNo: { type: String, required: false, unique: true, sparse: true, index: true, trim: true },
    ward: { type: String, trim: true, index: true },
    district: { type: String, trim: true },
    localBody: { type: String, trim: true },
    pollingStation: { type: String, trim: true },
    blockWard: { type: String, trim: true },
    districtWard: { type: String, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

residentRecordSchema.index({ name: 'text', houseName: 'text' });

export default mongoose.model('ResidentRecord', residentRecordSchema);
