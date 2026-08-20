import ResidentRecord from '../models/ResidentRecord.js';

const BATCH_SIZE = 1000;

export function parseImportPayload(data) {
  if (Array.isArray(data)) {
    return { records: data, metadata: null };
  }

  if (data && typeof data === 'object') {
    const records = data.voters ?? data.records;
    if (Array.isArray(records)) {
      return { records, metadata: data.metadata ?? null };
    }
  }

  return null;
}

function validateRecord(record, index) {
  const errors = [];
  if (!record.name?.trim()) errors.push('name is required');
  if (record.age !== undefined && record.age !== null && Number.isNaN(Number(record.age))) {
    errors.push('age must be a number');
  }
  return errors.length ? { index, errors, record } : null;
}

function applyMetadata(record, metadata) {
  if (!metadata) return record;

  return {
    ...record,
    district: record.district || metadata.district || '',
    localBody: record.localBody || record.local_body || metadata.local_body || metadata.localBody || '',
    ward: record.ward || metadata.ward || '',
    pollingStation:
      record.pollingStation || record.polling_station || metadata.polling_station || metadata.pollingStation || '',
    blockWard: record.blockWard || record.block_ward || metadata.block_ward || metadata.blockWard || '',
    districtWard:
      record.districtWard || record.district_ward || metadata.district_ward || metadata.districtWard || '',
  };
}

function normalizeRecord(record) {
  const secId = String(record.newSecIdNo || record.new_sec_id_no || '').trim();
  const normalized = {
    serialNo: record.serialNo ?? record.serial_no ?? null,
    name: String(record.name || '').trim(),
    guardianName: String(record.guardianName || record.guardian_name || '').trim(),
    oldWardNoHouseNo: String(record.oldWardNoHouseNo || record.old_ward_no_house_no || '').trim(),
    houseName: String(record.houseName || record.house_name || '').trim(),
    gender: String(record.gender || '').trim(),
    age: record.age != null ? Number(record.age) : null,
    ward: String(record.ward || '').trim(),
    district: String(record.district || '').trim(),
    localBody: String(record.localBody || record.local_body || '').trim(),
    pollingStation: String(record.pollingStation || record.polling_station || '').trim(),
    blockWard: String(record.blockWard || record.block_ward || '').trim(),
    districtWard: String(record.districtWard || record.district_ward || '').trim(),
  };
  if (secId) {
    normalized.newSecIdNo = secId;
  }
  return normalized;
}

async function insertBatch(batch, batchStartIndex) {
  const result = { imported: 0, duplicates: 0, failed: [] };

  try {
    const inserted = await ResidentRecord.insertMany(batch, { ordered: false });
    result.imported = inserted.length;
    return result;
  } catch (err) {
    if (err.name === 'MongoBulkWriteError' || err.code === 11000) {
      const writeErrors = err.writeErrors || [];
      result.imported = err.insertedDocs?.length ?? err.result?.insertedCount ?? 0;

      for (const we of writeErrors) {
        const idx = we.index ?? 0;
        const code = we.code ?? we.err?.code;
        if (code === 11000) {
          result.duplicates += 1;
        } else {
          result.failed.push({
            index: batchStartIndex + idx,
            errors: [we.errmsg || we.message || 'Insert failed'],
            record: batch[idx],
          });
        }
      }

      if (writeErrors.length === 0 && err.result?.insertedCount) {
        result.imported = err.result.insertedCount;
      }

      if (writeErrors.length > 0 && result.imported === 0) {
        result.imported = batch.length - writeErrors.length;
      }

      return result;
    }

    result.failed.push({ index: batchStartIndex, errors: [err.message], record: null });
    return result;
  }
}

export async function importResidentsFromJson(data) {
  const parsed = parseImportPayload(data);
  if (!parsed) {
    throw new Error('Invalid import format. Expected { metadata, voters } or an array of records.');
  }

  const { records, metadata } = parsed;

  const summary = {
    totalRecords: records.length,
    importedRecords: 0,
    duplicateRecords: 0,
    failedRecords: [],
    metadata: metadata || null,
  };

  const validBatch = [];

  for (let i = 0; i < records.length; i++) {
    const withMetadata = applyMetadata(records[i], metadata);
    const validationError = validateRecord(withMetadata, i);
    if (validationError) {
      summary.failedRecords.push(validationError);
      continue;
    }
    validBatch.push(normalizeRecord(withMetadata));
  }

  for (let i = 0; i < validBatch.length; i += BATCH_SIZE) {
    const batch = validBatch.slice(i, i + BATCH_SIZE);
    const batchResult = await insertBatch(batch, i);
    summary.importedRecords += batchResult.imported;
    summary.duplicateRecords += batchResult.duplicates;
    summary.failedRecords.push(...batchResult.failed);
  }

  return summary;
}
