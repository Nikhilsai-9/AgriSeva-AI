import 'dotenv/config';
import { MongoClient } from 'mongodb';

const dbUrl = process.env.DB_URL;
const dbName = process.env.DB_NAME || 'agriai';

async function run() {
  console.log(`Connecting to MongoDB (${dbName})...`);
  const client = new MongoClient(dbUrl);
  await client.connect();
  const db = client.db(dbName);
  console.log('Connected!');

  const total = await db.collection('questions').countDocuments({});
  console.log('Total questions in DB:', total);

  const valid = await db.collection('questions').countDocuments({ isTesting: { $ne: true } });
  console.log('Valid (isTesting != true) questions in All Questions:', valid);

  const sources = await db.collection('questions').aggregate([
    { $group: { _id: '$source', count: { $sum: 1 } } }
  ]).toArray();
  console.log('Questions by source:');
  for (const s of sources) {
    console.log(`  ${s._id}: ${s.count}`);
  }

  const recent = await db.collection('questions').find().sort({ createdAt: -1 }).limit(8).toArray();
  console.log('\nRecent 8 questions:');
  for (const q of recent) {
    console.log(`  - id: ${q._id}`);
    console.log(`    source: ${q.source} | lang: ${q.language || q.detectedLanguage} | crop: ${q.details?.crop} | domain: ${q.details?.domain}`);
    console.log(`    status: ${q.status} | isTesting: ${q.isTesting} | answers: ${q.totalAnswersCount}`);
    console.log(`    farmerPhone: ${q.farmerPhone || q.userId} | image: ${q.imageUrl ? 'YES' : 'NONE'}`);
    console.log(`    q: ${String(q.question).slice(0, 70)}`);
  }

  await client.close();
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
