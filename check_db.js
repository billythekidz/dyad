
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = 'D:\\GITHUB\\dyad\\userData\\sqlite.db';

try {
  const db = new Database(dbPath, { readonly: true });
  const tableInfo = db.pragma('table_info(messages)');

  const memoryTierColumn = tableInfo.find(col => col.name === 'memory_tier');

  if (memoryTierColumn) {
    console.log('SUCCESS: memory_tier column found.');
    console.log(JSON.stringify(memoryTierColumn, null, 2));
  } else {
    console.log('FAILURE: memory_tier column NOT found.');
    console.log('Available columns:', tableInfo.map(col => col.name).join(', '));
  }
} catch (error) {
  console.error('Error:', error.message);
}
