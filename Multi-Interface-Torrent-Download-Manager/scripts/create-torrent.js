import createTorrent from 'create-torrent';
import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), 'tests/fixtures/test-file.txt');
const out = path.join(process.cwd(), 'tests/fixtures/test.torrent');

createTorrent(file, (err, torrent) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  fs.writeFileSync(out, torrent);
  console.log('Created test.torrent');
});