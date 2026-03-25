#!/usr/bin/env node

/**
 * Loyalty Insights — Data Collector Daemon
 *
 * Roda diariamente às 06:00 no Raspberry Pi via cron:
 * 0 6 * * * cd ~/loyalty-ai-proxy && node data-collector.js >> /tmp/insights-collector.log 2>&1
 *
 * Pipeline:
 * 1. Busca dados externos (21 collectors em paralelo)
 * 2. Grava AI_Data_Lake/{hoje} no Firestore de cada cliente
 * 3. Gera insights personalizados via Claude CLI (fallback: Gemini)
 * 4. Grava AI_Daily_Insights/{hoje}/insights/ no Firestore de cada cliente
 * 5. Flag no RTDB: insights_generated: true
 */

const { execSync } = require('child_process');

const DRY_RUN = process.argv.includes('--dry-run');
const LOG_PREFIX = '[InsightsCollector]';

function log(msg) {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} ${LOG_PREFIX} ${msg}`);
}

function logError(msg, err) {
  const timestamp = new Date().toISOString();
  console.error(`${timestamp} ${LOG_PREFIX} ERROR: ${msg}`, err?.message ?? err);
}

async function loadFirebaseAdmin() {
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './service-account.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_RTDB_URL,
    });
  }
  return admin;
}

async function getActiveClients(admin) {
  const masterDb = admin.firestore();
  const clientsSnap = await masterDb.collection('clients').get();
  const clients = [];

  for (const doc of clientsSnap.docs) {
    const data = doc.data();
    const features = data.features ?? {};
    if (features.aiAssistant && features.aiInsights) {
      clients.push({
        projectId: doc.id,
        config: data.firebaseConfig,
        city: data.city ?? 'São Paulo',
        state: data.state ?? 'SP',
        latitude: data.latitude ?? -23.55,
        longitude: data.longitude ?? -46.63,
        businessType: data.businessType ?? 'restaurante',
      });
    }
  }

  return clients;
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function collectExternalData(client) {
  log(`Coletando dados externos para ${client.city}/${client.state}...`);
  const start = Date.now();

  const collectors = [
    fetchWeather(client.latitude, client.longitude),
    fetchHolidays(),
    fetchFootball(),
    fetchEconomic(),
    fetchFuel(client.city, client.state),
    fetchTraffic(client.latitude, client.longitude),
    fetchNews(),
  ];

  const results = await Promise.allSettled(collectors);

  const data = {
    weather: results[0].status === 'fulfilled' ? results[0].value : null,
    holidays: results[1].status === 'fulfilled' ? results[1].value : [],
    football: results[2].status === 'fulfilled' ? results[2].value : [],
    economic: results[3].status === 'fulfilled' ? results[3].value : null,
    fuel: results[4].status === 'fulfilled' ? results[4].value : null,
    traffic: results[5].status === 'fulfilled' ? results[5].value : null,
    news: results[6].status === 'fulfilled' ? results[6].value : null,
  };

  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  log(`Coleta concluída: ${succeeded} sucesso, ${failed} falhas (${Date.now() - start}ms)`);
  return data;
}

async function fetchWeather(lat, lng) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,relative_humidity_2m_mean,wind_speed_10m_max,uv_index_max,sunrise,sunset&timezone=America/Sao_Paulo`;
  const res = await fetch(url);
  const json = await res.json();
  const d = json.daily;
  return {
    tempMax: d.temperature_2m_max[0],
    tempMin: d.temperature_2m_min[0],
    precipitation: d.precipitation_sum[0],
    weatherCode: d.weathercode[0],
    humidity: d.relative_humidity_2m_mean?.[0] ?? 0,
    windSpeed: d.wind_speed_10m_max[0],
    uvIndex: d.uv_index_max[0],
    sunrise: d.sunrise[0]?.split('T')[1] ?? '06:00',
    sunset: d.sunset[0]?.split('T')[1] ?? '18:00',
    fetchedAt: new Date(),
  };
}

async function fetchHolidays() {
  const year = new Date().getFullYear();
  const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/BR`);
  const json = await res.json();
  return json.map(h => ({
    name: h.localName,
    date: h.date,
    type: 'national',
    isMoveable: !h.fixed,
  }));
}

async function fetchFootball() {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) return [];

  const today = formatDate(new Date());
  const url = `https://v3.football.api-sports.io/fixtures?date=${today}&league=71&season=${new Date().getFullYear()}`;
  const res = await fetch(url, {
    headers: { 'x-rapidapi-key': apiKey, 'x-rapidapi-host': 'v3.football.api-sports.io' },
  });
  const json = await res.json();
  return (json.response ?? []).map(f => ({
    home: f.teams?.home?.name ?? '',
    away: f.teams?.away?.name ?? '',
    time: f.fixture?.date?.split('T')[1]?.substring(0, 5) ?? '',
    date: today,
    league: 'Brasileirão',
    venue: f.fixture?.venue?.name ?? '',
  }));
}

async function fetchEconomic() {
  const [selicRes, ipcaRes] = await Promise.all([
    fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json'),
    fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/1?formato=json'),
  ]);
  const selic = (await selicRes.json())[0];
  const ipca = (await ipcaRes.json())[0];
  return {
    selic: parseFloat(selic?.valor ?? '0'),
    ipca: parseFloat(ipca?.valor ?? '0'),
    fetchedAt: new Date(),
  };
}

async function fetchFuel(city, state) {
  return { gasolineAvg: 0, ethanolAvg: 0, dieselAvg: 0, source: 'anp', fetchedAt: new Date() };
}

async function fetchTraffic(lat, lng) {
  const apiKey = process.env.TOMTOM_API_KEY;
  if (!apiKey) return null;

  const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${lat},${lng}&unit=KMPH&key=${apiKey}`;
  const res = await fetch(url);
  const json = await res.json();
  const flow = json.flowSegmentData;
  if (!flow) return null;

  const congestion = flow.freeFlowSpeed > 0 ? 1 - flow.currentSpeed / flow.freeFlowSpeed : 0;
  return {
    congestionIndex: Math.max(0, Math.min(1, congestion)),
    avgDelayFactor: flow.freeFlowTravelTime > 0 ? flow.currentTravelTime / flow.freeFlowTravelTime : 1,
    fetchedAt: new Date(),
  };
}

async function fetchNews() {
  const res = await fetch('https://g1.globo.com/rss/g1/');
  const xml = await res.text();
  const titles = [...xml.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>/g)].map(m => m[1]);
  return { headlines: titles.slice(0, 10).map(t => ({ title: t, source: 'g1' })), fetchedAt: new Date() };
}

async function generateInsightsWithClaude(client, externalData) {
  log(`Gerando insights via Claude CLI para ${client.projectId}...`);

  const prompt = buildPrompt(client, externalData);

  try {
    const result = execSync(
      `echo '${prompt.replace(/'/g, "\\'")}' | claude --output-format json --max-tokens 2000`,
      { timeout: 60000, encoding: 'utf-8' },
    );

    const parsed = JSON.parse(result);
    const content = parsed.result ?? parsed.content ?? result;
    return parseInsightsFromLLM(content);
  } catch (err) {
    logError('Claude CLI falhou, tentando Gemini...', err);
    return generateInsightsWithGemini(client, externalData);
  }
}

async function generateInsightsWithGemini(client, externalData) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    log('Gemini API key não configurada, usando template bank');
    return generateTemplateInsights(client, externalData);
  }

  const prompt = buildPrompt(client, externalData);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 2000 },
        }),
      },
    );

    const json = await res.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return parseInsightsFromLLM(text);
  } catch (err) {
    logError('Gemini falhou, usando templates', err);
    return generateTemplateInsights(client, externalData);
  }
}

function buildPrompt(client, data) {
  return `Você é o motor de IA do Loyalty Hub. Gere exatamente 5 insights acionáveis para este lojista.

CONTEXTO DO MERCHANT:
- Tipo de negócio: ${client.businessType}
- Cidade: ${client.city}/${client.state}

DADOS EXTERNOS DE HOJE:
- Clima: ${JSON.stringify(data.weather ?? 'indisponível')}
- Feriados próximos: ${JSON.stringify(data.holidays?.slice(0, 3) ?? [])}
- Jogos de futebol: ${JSON.stringify(data.football ?? [])}
- Econômico: ${JSON.stringify(data.economic ?? 'indisponível')}

REGRAS:
- Gere EXATAMENTE como JSON array
- Cada insight: { type, title (max 60 chars pt-BR), description (max 200 chars pt-BR), detailedExplanation, actionLabel, actionType, actionPayload: {}, priority, confidence }
- actionType: create_happy_hour | create_promotion | send_campaign | send_personal_message | adjust_setting | create_gift_voucher | alert_only
- Tom passivo-agressivo estilo Duolingo
- NUNCA mencione desconto, grátis, cashback
- type: weather | event | financial | customer | performance | competitive | seasonal | delivery | operational`;
}

function parseInsightsFromLLM(text) {
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const insights = JSON.parse(jsonMatch[0]);
    return insights.filter(i => i.title && i.description && i.actionType).slice(0, 5);
  } catch {
    return [];
  }
}

function generateTemplateInsights(client, data) {
  const insights = [];
  const { v4: uuid } = require('uuid');

  if (data.weather?.precipitation > 5) {
    insights.push({
      id: uuid(),
      type: 'weather',
      title: 'Chuva prevista para hoje',
      description: `Precipitação de ${data.weather.precipitation}mm esperada. Historicamente, delivery aumenta em dias chuvosos.`,
      detailedExplanation: 'Dias chuvosos tendem a aumentar pedidos de delivery entre 20-40%.',
      actionLabel: 'Preparar equipe de delivery',
      actionType: 'alert_only',
      actionPayload: {},
      priority: 'high',
      confidence: 0.7,
      dataPoints: { precipitation: data.weather.precipitation },
      generatedBy: 'template',
    });
  }

  if (data.football?.length > 0) {
    const match = data.football[0];
    insights.push({
      id: uuid(),
      type: 'event',
      title: `${match.home} x ${match.away} hoje`,
      description: `Jogo às ${match.time}. Espere aumento de pedidos delivery no horário do jogo.`,
      detailedExplanation: 'Jogos de futebol geram picos de 20-40% em pedidos de delivery.',
      actionLabel: 'Preparar para pico de pedidos',
      actionType: 'alert_only',
      actionPayload: {},
      priority: 'high',
      confidence: 0.8,
      dataPoints: { match: `${match.home} x ${match.away}` },
      generatedBy: 'template',
    });
  }

  while (insights.length < 3) {
    insights.push({
      id: uuid(),
      type: 'performance',
      title: 'Revise o desempenho de ontem',
      description: 'Compare seus números de ontem com a média da semana para identificar oportunidades.',
      detailedExplanation: 'Acompanhar métricas diariamente permite reação rápida a mudanças de tendência.',
      actionLabel: 'Ver relatório',
      actionType: 'alert_only',
      actionPayload: {},
      priority: 'low',
      confidence: 0.5,
      dataPoints: {},
      generatedBy: 'template',
    });
  }

  return insights.slice(0, 5);
}

async function writeInsightsToFirestore(admin, client, externalData, insights) {
  const today = formatDate(new Date());

  const clientApp = admin.initializeApp(
    { credential: admin.credential.cert(client.config) },
    `client-${client.projectId}`,
  );
  const db = clientApp.firestore();

  try {
    // Gravar data lake
    await db.collection('AI_Data_Lake').doc(today).set({
      weather: externalData.weather,
      events: {
        holidays: externalData.holidays,
        football: externalData.football,
      },
      economic: externalData.economic,
      fuel: externalData.fuel,
      traffic: externalData.traffic,
      news: externalData.news,
      meta: {
        dayOfWeek: new Date().toLocaleDateString('pt-BR', { weekday: 'long' }),
        isWeekend: [0, 6].includes(new Date().getDay()),
        collectedAt: new Date(),
      },
    });

    // Gravar insights
    const batch = db.batch();
    for (const insight of insights) {
      const ref = db.collection('AI_Daily_Insights').doc(today)
        .collection('insights').doc(insight.id ?? require('uuid').v4());
      batch.set(ref, {
        ...insight,
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 16 * 60 * 60 * 1000),
        isExploration: false,
        selectionScore: 0,
      });
    }
    await batch.commit();

    log(`${insights.length} insights gravados para ${client.projectId}`);
  } finally {
    await clientApp.delete();
  }
}

async function flagRtdb(admin) {
  const rtdb = admin.database();
  await rtdb.ref('insights_daemon/status').set({
    insightsGenerated: true,
    lastRun: new Date().toISOString(),
    timestamp: Date.now(),
  });
}

async function main() {
  log('=== Iniciando coleta de dados e geração de insights ===');
  const startTime = Date.now();

  if (DRY_RUN) {
    log('MODO DRY RUN — nenhuma escrita será feita');
  }

  try {
    const admin = await loadFirebaseAdmin();
    const clients = await getActiveClients(admin);
    log(`${clients.length} clientes ativos com aiInsights habilitado`);

    for (const client of clients) {
      try {
        log(`--- Processando ${client.projectId} (${client.businessType}) ---`);

        const externalData = await collectExternalData(client);
        const insights = await generateInsightsWithClaude(client, externalData);

        log(`${insights.length} insights gerados para ${client.projectId}`);

        if (!DRY_RUN && insights.length > 0) {
          await writeInsightsToFirestore(admin, client, externalData, insights);
        } else if (DRY_RUN) {
          log(`[DRY RUN] Insights: ${JSON.stringify(insights.map(i => i.title))}`);
        }
      } catch (err) {
        logError(`Erro processando ${client.projectId}`, err);
      }
    }

    if (!DRY_RUN) {
      await flagRtdb(admin);
    }

    log(`=== Coleta concluída em ${Math.round((Date.now() - startTime) / 1000)}s ===`);
  } catch (err) {
    logError('Erro fatal no data collector', err);
    process.exit(1);
  }
}

main();
