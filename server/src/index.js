import { createApp } from './app.js';
import { openDatabase, isEmptyDatabase } from './db.js';
import { seedDemo } from './seed.js';

const port = Number(process.env.PORT || 4000);
const db = openDatabase();
if (isEmptyDatabase(db)) {
  const result = seedDemo(db);
  if (result.seeded) console.log('Seeded demo workspace.');
}

const app = createApp(db);
const server = app.listen(port, () => {
  console.log(`Meridian API listening on http://localhost:${port}`);
  console.log('Demo accounts (password: demo1234):');
  console.log('  Employee       elena.rossi@meridian.io');
  console.log('  Manager        james.rivera@meridian.io');
  console.log('  Senior Manager sarah.chen@meridian.io');
  console.log('  Administrator  maya.patel@meridian.io');
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Stop the existing Meridian API (or set PORT to another value) and try again.`);
  } else {
    console.error(error);
  }
  process.exit(1);
});
