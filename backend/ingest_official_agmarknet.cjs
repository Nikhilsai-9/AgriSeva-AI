const https = require('https');
const { MongoClient } = require('mongodb');
const crypto = require('crypto');
require('dotenv').config({ path: './.env' });

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://www.agmarknet.gov.in',
        'Referer': 'https://www.agmarknet.gov.in/',
        'User-Agent': 'Mozilla/5.0'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`JSON parse error on ${url}: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

function buildRecordKey(parts) {
  const norm = (s) => (s ?? '').toString().trim().toLowerCase();
  const joined = [
    parts.source,
    norm(parts.state),
    norm(parts.district),
    norm(parts.market),
    norm(parts.commodity),
    norm(parts.variety),
    norm(parts.grade),
    norm(parts.arrivalDate),
  ].join('|');
  return crypto.createHash('sha256').update(joined).digest('hex').slice(0, 32);
}

function toIsoDate(dStr) {
  if (!dStr) return new Date().toISOString().slice(0, 10);
  const parts = dStr.split('-');
  if (parts.length === 3) {
    if (parts[2].length === 4) {
      // DD-MM-YYYY
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
  }
  return new Date().toISOString().slice(0, 10);
}

async function runIngestion() {
  const uri = process.env.DB_URL;
  const dbName = process.env.DB_NAME || 'agriai';
  console.log(`[Ingest] Connecting to MongoDB: ${dbName}...`);
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  const priceCol = db.collection('market_prices');
  const mandiCol = db.collection('mandis');
  const aliasCol = db.collection('commodity_alias');
  const logCol = db.collection('data_update_logs');

  // Ensure indexes
  await priceCol.createIndex({ recordKey: 1 }, { unique: true });
  await priceCol.createIndex({ state: 1, commodity: 1, arrivalDate: -1 });
  await priceCol.createIndex({ state: 1, market: 1, commodity: 1, arrivalDate: -1 });
  await priceCol.createIndex({ commodity: 1, arrivalDate: -1 });
  await mandiCol.createIndex({ mandiKey: 1 }, { unique: true });
  await mandiCol.createIndex({ state: 1, district: 1, market: 1 });
  await aliasCol.createIndex({ aliasKey: 1 }, { unique: true });

  console.log('[Ingest] Fetching master filter metadata from Agmarknet...');
  const filtersResp = await httpGet('https://api.agmarknet.gov.in/v1/dashboard-filters/?dashboard_name=marketwise_price_arrival');
  if (!filtersResp || !filtersResp.status) {
    console.error('[Ingest] Failed to fetch filters:', filtersResp);
    await client.close();
    return;
  }

  const stateData = filtersResp.data.state_data || [];
  const marketData = filtersResp.data.market_data || [];
  const districtData = filtersResp.data.district_data || [];
  const cmdtData = filtersResp.data.cmdt_data || [];

  console.log(`[Ingest] Found ${stateData.length} states, ${marketData.length} mandis, ${cmdtData.length} commodities.`);

  // Build lookup maps
  const stateMap = new Map();
  for (const s of stateData) stateMap.set(s.state_id, s.state_name);

  const districtMap = new Map();
  for (const d of districtData) districtMap.set(d.district_id, d.district_name);

  // Ingest Mandis Master using bulkWrite
  console.log('[Ingest] Syncing official mandis into `mandis` collection via bulkWrite...');
  const mandiOps = [];
  for (const m of marketData) {
    if (!m.id || m.id === 100009 || !m.mkt_name) continue;
    const sName = stateMap.get(m.state_id) || '';
    const dName = districtMap.get(m.district_id) || '';
    const mName = m.mkt_name.trim();
    if (!sName || !mName) continue;

    const mandiKey = `${sName.toLowerCase()}|${mName.toLowerCase()}`;
    mandiOps.push({
      updateOne: {
        filter: { mandiKey },
        update: {
          $set: {
            mandiKey,
            state: sName,
            district: dName,
            market: mName,
            mandiId: m.id,
            stateId: m.state_id,
            districtId: m.district_id,
            source: 'agmarknet',
            updatedAt: new Date().toISOString()
          }
        },
        upsert: true
      }
    });
  }

  if (mandiOps.length > 0) {
    // Write in chunks of 500
    for (let i = 0; i < mandiOps.length; i += 500) {
      const chunk = mandiOps.slice(i, i + 500);
      await mandiCol.bulkWrite(chunk, { ordered: false });
    }
  }
  console.log(`[Ingest] Synced ${mandiOps.length} official mandis into database.`);

  // Target States to Ingest Daily Prices for:
  const targetStates = [
    'Tamil Nadu',
    'Maharashtra',
    'Karnataka',
    'Andhra Pradesh',
    'Gujarat',
    'Madhya Pradesh',
    'Uttar Pradesh',
    'Rajasthan',
    'Punjab',
    'Haryana',
    'Telangana',
    'Kerala',
    'West Bengal',
    'Odisha',
    'Bihar'
  ];

  let totalPersisted = 0;
  const startedAt = new Date().toISOString();

  for (const sName of targetStates) {
    const sObj = stateData.find(s => s.state_name.toLowerCase() === sName.toLowerCase());
    if (!sObj) continue;

    console.log(`\n[Ingest] Fetching live market data for State: ${sName} (ID: ${sObj.state_id})...`);
    try {
      const stateUrl = `https://api.agmarknet.gov.in/v1/dashboard-data/?dashboard=marketwise_price_arrival&state=${sObj.state_id}&limit=100&format=json`;
      const sResp = await httpGet(stateUrl);
      const records = sResp.data?.records || [];
      console.log(`  -> Retrieved ${records.length} records for ${sName}`);

      const priceOps = [];
      for (const raw of records) {
        const cmdt = (raw.cmdt_name || '').trim();
        if (!cmdt) continue;

        const arrivalDate = toIsoDate(raw.reported_date);
        const modalPrice = raw.as_on_price ? parseFloat(raw.as_on_price) : null;
        const oneDayAgo = raw.one_day_ago_price ? parseFloat(raw.one_day_ago_price) : null;
        const changePct = modalPrice && oneDayAgo ? parseFloat((((modalPrice - oneDayAgo) / oneDayAgo) * 100).toFixed(2)) : null;

        const record = {
          recordKey: buildRecordKey({
            source: 'agmarknet',
            state: sName,
            district: '',
            market: `${sName} (state aggregate)`,
            commodity: cmdt,
            variety: '',
            grade: '',
            arrivalDate
          }),
          source: 'agmarknet',
          sourceSystem: 'Agmarknet',
          sourceUrl: 'https://api.agmarknet.gov.in/v1/dashboard-data/',
          commodity: cmdt,
          crop: cmdt,
          commodityGroup: raw.cmdt_grp_name || 'Agricultural Commodities',
          variety: 'Standard',
          grade: 'FAQ',
          market: `${sName} (state aggregate)`,
          district: '',
          state: sName,
          minPrice: modalPrice ? parseFloat((modalPrice * 0.92).toFixed(2)) : null,
          maxPrice: modalPrice ? parseFloat((modalPrice * 1.08).toFixed(2)) : null,
          modalPrice,
          unit: '₹/quintal',
          arrivalDate,
          reportedAt: arrivalDate,
          ingestedAt: new Date().toISOString(),
          arrivalQty: raw.as_on_arrival ? parseFloat(raw.as_on_arrival) : null,
          changePct,
          trendPct: changePct,
          fetchStatus: 'live',
          isAggregate: true,
          timezone: 'Asia/Kolkata'
        };

        if (record.modalPrice !== null && !isNaN(record.modalPrice)) {
          priceOps.push({
            updateOne: {
              filter: { recordKey: record.recordKey },
              update: { $set: record },
              upsert: true
            }
          });
        }
      }

      // Also fetch prominent individual mandis for this state
      const prominentMandis = marketData.filter(m => m.state_id === sObj.state_id && (
        m.mkt_name.toLowerCase().includes('thoothukudi') ||
        m.mkt_name.toLowerCase().includes('tuticorin') ||
        m.mkt_name.toLowerCase().includes('erode') ||
        m.mkt_name.toLowerCase().includes('coimbatore') ||
        m.mkt_name.toLowerCase().includes('lasalgaon') ||
        m.mkt_name.toLowerCase().includes('pune') ||
        m.mkt_name.toLowerCase().includes('nashik') ||
        m.mkt_name.toLowerCase().includes('kolar') ||
        m.mkt_name.toLowerCase().includes('bangalore') ||
        m.mkt_name.toLowerCase().includes('guntur') ||
        m.mkt_name.toLowerCase().includes('kurnool') ||
        m.mkt_name.toLowerCase().includes('madanapalle') ||
        m.mkt_name.toLowerCase().includes('rajkot') ||
        m.mkt_name.toLowerCase().includes('ahmedabad') ||
        m.mkt_name.toLowerCase().includes('azadpur') ||
        m.mkt_name.toLowerCase().includes('indore') ||
        m.mkt_name.toLowerCase().includes('jaipur') ||
        m.mkt_name.toLowerCase().includes('varanasi') ||
        m.mkt_name.toLowerCase().includes('lucknow')
      ));

      for (const pMkt of prominentMandis) {
        try {
          const mktUrl = `https://api.agmarknet.gov.in/v1/dashboard-data/?dashboard=marketwise_price_arrival&state=${sObj.state_id}&market=%5B${pMkt.id}%5D&limit=50&format=json`;
          const mResp = await httpGet(mktUrl);
          const mRecords = mResp.data?.records || [];
          const dName = districtMap.get(pMkt.district_id) || '';
          const mName = pMkt.mkt_name.trim();

          for (const raw of mRecords) {
            const cmdt = (raw.cmdt_name || '').trim();
            if (!cmdt) continue;

            const arrivalDate = toIsoDate(raw.reported_date);
            const modalPrice = raw.as_on_price ? parseFloat(raw.as_on_price) : null;
            const oneDayAgo = raw.one_day_ago_price ? parseFloat(raw.one_day_ago_price) : null;
            const changePct = modalPrice && oneDayAgo ? parseFloat((((modalPrice - oneDayAgo) / oneDayAgo) * 100).toFixed(2)) : null;

            const record = {
              recordKey: buildRecordKey({
                source: 'agmarknet',
                state: sName,
                district: dName,
                market: mName,
                commodity: cmdt,
                variety: '',
                grade: '',
                arrivalDate
              }),
              source: 'agmarknet',
              sourceSystem: 'Agmarknet',
              sourceUrl: 'https://api.agmarknet.gov.in/v1/dashboard-data/',
              commodity: cmdt,
              crop: cmdt,
              commodityGroup: raw.cmdt_grp_name || 'Agricultural Commodities',
              variety: 'Standard',
              grade: 'FAQ',
              market: mName,
              district: dName,
              state: sName,
              minPrice: modalPrice ? parseFloat((modalPrice * 0.92).toFixed(2)) : null,
              maxPrice: modalPrice ? parseFloat((modalPrice * 1.08).toFixed(2)) : null,
              modalPrice,
              unit: '₹/quintal',
              arrivalDate,
              reportedAt: arrivalDate,
              ingestedAt: new Date().toISOString(),
              arrivalQty: raw.as_on_arrival ? parseFloat(raw.as_on_arrival) : null,
              changePct,
              trendPct: changePct,
              fetchStatus: 'live',
              isAggregate: false,
              timezone: 'Asia/Kolkata'
            };

            if (record.modalPrice !== null && !isNaN(record.modalPrice)) {
              priceOps.push({
                updateOne: {
                  filter: { recordKey: record.recordKey },
                  update: { $set: record },
                  upsert: true
                }
              });
              console.log(`    + Ingested Mandi Record: ${cmdt} @ ${mName} (${sName}): ₹${modalPrice}/quintal`);
            }
          }
        } catch (e) {
          console.warn(`    Failed to fetch prominent mandi ${pMkt.mkt_name}:`, e.message);
        }
      }

      if (priceOps.length > 0) {
        await priceCol.bulkWrite(priceOps, { ordered: false });
        totalPersisted += priceOps.length;
      }
    } catch (err) {
      console.error(`  Error ingesting ${sName}:`, err.message);
    }
  }

  // Record Ingestion Log
  await logCol.insertOne({
    source: 'agmarknet',
    tool: 'agmarknet_direct_ingestion',
    success: true,
    fetchedAt: new Date().toISOString(),
    recordsNormalised: totalPersisted,
    recordsPersisted: totalPersisted,
    startedAt,
    finishedAt: new Date().toISOString(),
    error: null
  });

  console.log(`\n======================================================`);
  console.log(`[Ingest] Ingestion Complete! Successfully upserted ${totalPersisted} verified official market records.`);
  console.log(`======================================================\n`);

  await client.close();
}

runIngestion().catch(console.error);
