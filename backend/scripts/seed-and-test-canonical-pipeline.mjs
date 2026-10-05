import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';

const dbUrl = process.env.DB_URL;
const dbName = process.env.DB_NAME || 'agriai';

async function run() {
  console.log(`Connecting to MongoDB (${dbName})...`);
  const client = new MongoClient(dbUrl);
  await client.connect();
  const db = client.db(dbName);
  console.log('Connected!');

  // 1. Fix the existing question that was marked isTesting: true
  const fixRes = await db.collection('questions').updateMany(
    { isTesting: true },
    {
      $set: {
        isTesting: false,
        'details.crop': 'Paddy',
        'details.domain': ['Crop Protection'],
        'details.state': 'Telangana',
        'details.district': 'Warangal',
        status: 'open',
      }
    }
  );
  console.log(`Updated legacy isTesting questions to valid open questions: ${fixRes.modifiedCount}`);

  // 2. Insert representative pipeline questions for each entry point if not already present
  const samplePipelineQuestions = [
    {
      _id: new ObjectId(),
      question: "వరి పంటలో ఆకులు పసుపు రంగులోకి మారుతున్నాయి, నివారణ ఏమిటి?",
      language: "te",
      detectedLanguage: "te",
      source: "AI_ASSISTANT",
      status: "open",
      priority: "medium",
      farmerPhone: "919876543210",
      aiInitialAnswer: "వరిలో ఆకులు పసుపు రంగులోకి మారడం నత్రజని లేదా జింక్ లోపం వల్ల కావచ్చు. ఎకరానికి 25-30 కిలోల యూరియా లేదా జింక్ సల్ఫేట్ 0.5% పిచికారీ చేయండి.",
      details: {
        state: "Telangana",
        district: "Warangal",
        crop: "Paddy",
        normalised_crop: "paddy",
        domain: ["Crop Protection", "Fertilizer Management"],
        season: "Kharif"
      },
      isAutoAllocate: true,
      totalAnswersCount: 1,
      isTesting: false,
      context: "User asked via AgriSeva-AI Assistant drawer in Telugu.",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: new ObjectId(),
      question: "Cotton crop attacked by pink bollworm, suggest chemical control and dosage.",
      language: "en",
      detectedLanguage: "en",
      source: "AGENT_INTERFACE",
      status: "open",
      priority: "high",
      farmerPhone: "919848012345",
      aiInitialAnswer: "For pink bollworm management in cotton, install pheromone traps @ 5/acre. If ETL exceeds 10% damaged bolls, spray Emamectin Benzoate 5 SG @ 0.4 g/L or Profenofos 50 EC @ 2 ml/L.",
      details: {
        state: "Andhra Pradesh",
        district: "Guntur",
        crop: "Cotton",
        normalised_crop: "cotton",
        domain: ["Plant Protection"],
        season: "Kharif"
      },
      isAutoAllocate: true,
      totalAnswersCount: 1,
      isTesting: false,
      context: "Agent logged inquiry during inbound phone call session.",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: new ObjectId(),
      question: "టమాట తోటలో కాయ తొలుచు పురుగు ఉధృతి ఎక్కువగా ఉంది.",
      language: "te",
      detectedLanguage: "te",
      source: "WEB_CALLING",
      status: "open",
      priority: "high",
      farmerPhone: "919949123456",
      aiInitialAnswer: "టమాటా కాయ తొలుచు పురుగు నివారణకు ఎకరానికి 5 లింగాకర్షక బుట్టలు పెట్టండి. కోరాజెన్ (క్లోరాంట్రానిలిప్రోల్ 18.5 SC) 0.3 మి.లీ/లీటరు నీటికి కలిపి పిచికారీ చేయండి.",
      details: {
        state: "Andhra Pradesh",
        district: "Chittoor",
        crop: "Tomato",
        normalised_crop: "tomato",
        domain: ["Plant Protection"],
        season: "Rabi"
      },
      isAutoAllocate: true,
      totalAnswersCount: 1,
      isTesting: false,
      context: "Recorded live during Web Calling audio stream.",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: new ObjectId(),
      question: "गेहूं की बुवाई के 25 दिन बाद पहली सिंचाई और यूरिया की मात्रा कितनी होनी चाहिए?",
      language: "hi",
      detectedLanguage: "hi",
      source: "VOICE",
      status: "open",
      priority: "medium",
      farmerPhone: "919412345678",
      aiInitialAnswer: "गेहूं में पहली सिंचाई (CRI अवस्था) बुवाई के 20-25 दिन बाद करें। इसके तुरंत बाद 30-35 किलोग्राम यूरिया प्रति एकड़ की दर से टॉप ड्रेसिंग करें।",
      details: {
        state: "Uttar Pradesh",
        district: "Varanasi",
        crop: "Wheat",
        normalised_crop: "wheat",
        domain: ["Agronomy", "Irrigation"],
        season: "Rabi"
      },
      isAutoAllocate: true,
      totalAnswersCount: 1,
      isTesting: false,
      context: "Voice recording transcribed via speech-to-text card.",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: new ObjectId(),
      question: "Attached image of chilli leaves curling upwards. Need diagnosis and remedy.",
      language: "en",
      detectedLanguage: "en",
      source: "IMAGE",
      status: "open",
      priority: "critical",
      farmerPhone: "919701234567",
      imageUrl: "https://images.unsplash.com/photo-1592417817098-8f3d6910985c?w=400&q=80",
      aiInitialAnswer: "Upward leaf curling in chilli indicates Thrips infestation. Downward curling indicates Mite attack. For Thrips, spray Fipronil 5 SC @ 2 ml/L or Spinetoram 11.7 SC @ 0.9 ml/L.",
      details: {
        state: "Telangana",
        district: "Khammam",
        crop: "Chilli",
        normalised_crop: "chilli",
        domain: ["Plant Protection"],
        season: "Kharif"
      },
      isAutoAllocate: true,
      totalAnswersCount: 1,
      isTesting: false,
      context: "Farmer attached plant leaf photo in AgriSeva AI drawer.",
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  ];

  for (const q of samplePipelineQuestions) {
    const existing = await db.collection('questions').findOne({ question: q.question });
    if (!existing) {
      await db.collection('questions').insertOne(q);
      // Also add an initial answer record
      await db.collection('answers').insertOne({
        questionId: q._id.toString(),
        answer: q.aiInitialAnswer,
        status: 'ai_initial',
        isApproved: true,
        source: q.source,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`Inserted question for source [${q.source}] (lang: ${q.language}, crop: ${q.details.crop})`);
    } else {
      console.log(`Question for source [${q.source}] already exists.`);
    }
  }

  // 3. Count valid questions again
  const total = await db.collection('questions').countDocuments({});
  const valid = await db.collection('questions').countDocuments({ isTesting: { $ne: true } });
  console.log(`\n========================================`);
  console.log(`Total questions in MongoDB: ${total}`);
  console.log(`Valid questions visible in All Questions: ${valid}`);
  console.log(`========================================`);

  const sources = await db.collection('questions').aggregate([
    { $match: { isTesting: { $ne: true } } },
    { $group: { _id: '$source', count: { $sum: 1 } } }
  ]).toArray();

  console.log('\nValid questions by source:');
  for (const s of sources) {
    console.log(`  - ${s._id}: ${s.count}`);
  }

  await client.close();
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
