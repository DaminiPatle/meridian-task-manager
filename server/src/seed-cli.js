import { openDatabase } from './db.js';
import { seedDemo } from './seed.js';

const db = openDatabase();
const force = process.argv.includes('--force');
const result = seedDemo(db, { force });
if (result.seeded) {
  console.log(`Demo workspace seeded: ${result.tasks} tasks across ${result.users} users.`);
  console.log('Password for every demo account: demo1234');
} else {
  console.log('Database already contains data. Use --force to reset the demo workspace.');
}
