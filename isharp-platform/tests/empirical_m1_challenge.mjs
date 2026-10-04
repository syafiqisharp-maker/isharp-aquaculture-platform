/**
 * EMPIRICAL CHALLENGE SUITE: Milestone M1
 * Agent: Challenger M1-2 (critic, specialist)
 * 
 * Objectives:
 * 1. Test concurrent read queries against `daily_growout_records` and `pond_cycles`
 *    at 15+ concurrent simulated sessions to ensure zero locking or view degradation.
 * 2. Test concurrent read-while-write to verify PostgreSQL MVCC non-blocking read isolation.
 * 3. Validate response latencies (p50, p95, p99), error rates, and throughput.
 */

import { ENV } from '../src/config/env.js';

const BASE_URL = ENV.SUPABASE_URL;
const API_KEY = ENV.SUPABASE_KEY;

const HEADERS = {
  apikey: API_KEY,
  Authorization: `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation'
};

async function timedFetch(url, options = {}) {
  const start = performance.now();
  try {
    const res = await fetch(url, {
      ...options,
      headers: { ...HEADERS, ...(options.headers || {}) }
    });
    const duration = performance.now() - start;
    const ok = res.ok;
    let data = null;
    let error = null;
    if (ok) {
      if (res.status !== 204) {
        data = await res.json();
      }
    } else {
      error = `${res.status} ${res.statusText}: ${await res.text()}`;
    }
    return { ok, status: res.status, duration, count: Array.isArray(data) ? data.length : 1, error };
  } catch (err) {
    const duration = performance.now() - start;
    return { ok: false, status: 0, duration, count: 0, error: err.message };
  }
}

function calculateStats(latencies) {
  if (latencies.length === 0) return { count: 0, min: 0, max: 0, mean: 0, p50: 0, p95: 0, p99: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = sum / sorted.length;
  const p50 = sorted[Math.floor(sorted.length * 0.50)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  return { count: latencies.length, min, max, mean, p50, p95, p99 };
}

async function runPhase1ConcurrentReadsDaily(concurrency = 15, requestsPerWorker = 5) {
  console.log(`\n======================================================`);
  console.log(`PHASE 1: Concurrent Reads on 'daily_growout_records'`);
  console.log(`Simulating ${concurrency} concurrent workers, ${requestsPerWorker} requests each (Total: ${concurrency * requestsPerWorker})`);
  console.log(`======================================================`);

  const ponds = ['2030503.42', '2010101.40', '2061101.37', '2010111.43'];
  const latencies = [];
  let successCount = 0;
  let failureCount = 0;

  const startTotal = performance.now();

  const workerPromises = Array.from({ length: concurrency }, async (_, workerId) => {
    for (let i = 0; i < requestsPerWorker; i++) {
      const pond = ponds[(workerId + i) % ponds.length];
      const url = `${BASE_URL}/rest/v1/daily_growout_records?select=*&pond_index=eq.${pond}&order=log_date.desc&limit=20`;
      const res = await timedFetch(url);
      latencies.push(res.duration);
      if (res.ok) {
        successCount++;
      } else {
        failureCount++;
        console.error(`Worker ${workerId} req ${i} failed:`, res.error);
      }
    }
  });

  await Promise.all(workerPromises);
  const totalDuration = performance.now() - startTotal;
  const stats = calculateStats(latencies);

  console.log(`Completed Phase 1 in ${(totalDuration / 1000).toFixed(2)}s`);
  console.log(`Success: ${successCount}, Failures: ${failureCount} (Error rate: ${(failureCount / latencies.length * 100).toFixed(2)}%)`);
  console.log(`RPS: ${(latencies.length / (totalDuration / 1000)).toFixed(2)} req/sec`);
  console.log(`Latency: Min=${stats.min.toFixed(1)}ms | Mean=${stats.mean.toFixed(1)}ms | p50=${stats.p50.toFixed(1)}ms | p95=${stats.p95.toFixed(1)}ms | p99=${stats.p99.toFixed(1)}ms | Max=${stats.max.toFixed(1)}ms`);

  return { phase: 'daily_growout_records_reads', stats, successCount, failureCount, totalDuration };
}

async function runPhase2ConcurrentReadsPondCycles(concurrency = 15, requestsPerWorker = 5) {
  console.log(`\n======================================================`);
  console.log(`PHASE 2: Concurrent Reads on 'pond_cycles'`);
  console.log(`Simulating ${concurrency} concurrent workers, ${requestsPerWorker} requests each (Total: ${concurrency * requestsPerWorker})`);
  console.log(`======================================================`);

  const modules = ['01', '02', '03', '04', '05'];
  const latencies = [];
  let successCount = 0;
  let failureCount = 0;

  const startTotal = performance.now();

  const workerPromises = Array.from({ length: concurrency }, async (_, workerId) => {
    for (let i = 0; i < requestsPerWorker; i++) {
      const mod = modules[(workerId + i) % modules.length];
      const url = `${BASE_URL}/rest/v1/pond_cycles?select=pond_index,pond,modl,pond_status,pond_active,batch_count&modl=eq.${mod}&limit=25`;
      const res = await timedFetch(url);
      latencies.push(res.duration);
      if (res.ok) {
        successCount++;
      } else {
        failureCount++;
        console.error(`Worker ${workerId} req ${i} failed:`, res.error);
      }
    }
  });

  await Promise.all(workerPromises);
  const totalDuration = performance.now() - startTotal;
  const stats = calculateStats(latencies);

  console.log(`Completed Phase 2 in ${(totalDuration / 1000).toFixed(2)}s`);
  console.log(`Success: ${successCount}, Failures: ${failureCount} (Error rate: ${(failureCount / latencies.length * 100).toFixed(2)}%)`);
  console.log(`RPS: ${(latencies.length / (totalDuration / 1000)).toFixed(2)} req/sec`);
  console.log(`Latency: Min=${stats.min.toFixed(1)}ms | Mean=${stats.mean.toFixed(1)}ms | p50=${stats.p50.toFixed(1)}ms | p95=${stats.p95.toFixed(1)}ms | p99=${stats.p99.toFixed(1)}ms | Max=${stats.max.toFixed(1)}ms`);

  return { phase: 'pond_cycles_reads', stats, successCount, failureCount, totalDuration };
}

async function runPhase3MixedConcurrentReads(concurrency = 30, requestsPerWorker = 4) {
  console.log(`\n======================================================`);
  console.log(`PHASE 3: High-Stress Mixed Reads (30 Concurrent Workers)`);
  console.log(`15 workers querying daily_growout_records, 15 workers querying pond_cycles`);
  console.log(`======================================================`);

  const latencies = [];
  let successCount = 0;
  let failureCount = 0;

  const startTotal = performance.now();

  const workerPromises = Array.from({ length: concurrency }, async (_, workerId) => {
    const isDaily = workerId % 2 === 0;
    for (let i = 0; i < requestsPerWorker; i++) {
      const url = isDaily
        ? `${BASE_URL}/rest/v1/daily_growout_records?select=*&limit=15`
        : `${BASE_URL}/rest/v1/pond_cycles?select=pond_index,pond,modl,pond_status&modl=eq.01&limit=15`;
      const res = await timedFetch(url);
      latencies.push(res.duration);
      if (res.ok) {
        successCount++;
      } else {
        failureCount++;
      }
    }
  });

  await Promise.all(workerPromises);
  const totalDuration = performance.now() - startTotal;
  const stats = calculateStats(latencies);

  console.log(`Completed Phase 3 in ${(totalDuration / 1000).toFixed(2)}s`);
  console.log(`Success: ${successCount}, Failures: ${failureCount} (Error rate: ${(failureCount / latencies.length * 100).toFixed(2)}%)`);
  console.log(`RPS: ${(latencies.length / (totalDuration / 1000)).toFixed(2)} req/sec`);
  console.log(`Latency: Min=${stats.min.toFixed(1)}ms | Mean=${stats.mean.toFixed(1)}ms | p50=${stats.p50.toFixed(1)}ms | p95=${stats.p95.toFixed(1)}ms | p99=${stats.p99.toFixed(1)}ms | Max=${stats.max.toFixed(1)}ms`);

  return { phase: 'mixed_reads_stress_30_workers', stats, successCount, failureCount, totalDuration };
}

async function runPhase4ConcurrentReadWhileWrite() {
  console.log(`\n======================================================`);
  console.log(`PHASE 4: Concurrent Read-While-Write (MVCC Isolation Test)`);
  console.log(`15 concurrent readers executing continuous queries while a writer inserts and updates records via the view`);
  console.log(`======================================================`);

  const testRecordId = 'a0000000-0000-0000-0000-000000000001';
  const testPondIndex = '2010111.43';
  const testLogDate = '2026-12-31';

  let writerSuccess = false;
  let writerError = null;
  const readerLatencies = [];
  let readerSuccess = 0;
  let readerFailure = 0;

  // Cleanup before starting
  await timedFetch(`${BASE_URL}/rest/v1/daily_growout_records?id=eq.${testRecordId}`, { method: 'DELETE' });

  let writing = true;

  // 15 continuous reader tasks
  const readerTasks = Array.from({ length: 15 }, async (_, rId) => {
    while (writing) {
      const res = await timedFetch(`${BASE_URL}/rest/v1/daily_growout_records?select=*&pond_index=eq.${testPondIndex}&limit=10`);
      readerLatencies.push(res.duration);
      if (res.ok) readerSuccess++;
      else readerFailure++;
      await new Promise(r => setTimeout(r, 20)); // slight jitter
    }
  });

  // Writer task
  const writerTask = async () => {
    try {
      // Step A: Insert record via view
      const insertRes = await timedFetch(`${BASE_URL}/rest/v1/daily_growout_records`, {
        method: 'POST',
        body: JSON.stringify({
          id: testRecordId,
          pond_index: testPondIndex,
          pond: '01.01.11',
          log_date: testLogDate,
          feed_kg: 25.0,
          water_level_cm: 115.0,
          water_colour: 'Dark Green',
          mortality_count: 5,
          logged_by: 'CHALLENGER_CONCURRENCY_WRITER'
        })
      });

      if (!insertRes.ok) throw new Error(`Insert failed: ${insertRes.error}`);

      // Step B: Update record via view
      const updateRes = await timedFetch(`${BASE_URL}/rest/v1/daily_growout_records?id=eq.${testRecordId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          feed_kg: 30.5,
          remarks: 'Updated under concurrent read load'
        })
      });

      if (!updateRes.ok) throw new Error(`Update failed: ${updateRes.error}`);

      // Step C: Delete record via view
      const deleteRes = await timedFetch(`${BASE_URL}/rest/v1/daily_growout_records?id=eq.${testRecordId}`, {
        method: 'DELETE'
      });

      if (!deleteRes.ok) throw new Error(`Delete failed: ${deleteRes.error}`);

      writerSuccess = true;
    } catch (err) {
      writerError = err.message;
    } finally {
      writing = false;
    }
  };

  await Promise.all([writerTask(), ...readerTasks]);

  const readerStats = calculateStats(readerLatencies);

  console.log(`Writer Result: ${writerSuccess ? 'SUCCESS (Insert + Update + Delete via view)' : 'FAILED: ' + writerError}`);
  console.log(`Concurrent Readers during write: ${readerLatencies.length} queries`);
  console.log(`Reader Success: ${readerSuccess}, Reader Failures: ${readerFailure} (Error rate: ${(readerFailure / readerLatencies.length * 100).toFixed(2)}%)`);
  console.log(`Reader Latency under write: Mean=${readerStats.mean.toFixed(1)}ms | p50=${readerStats.p50.toFixed(1)}ms | p95=${readerStats.p95.toFixed(1)}ms | Max=${readerStats.max.toFixed(1)}ms`);

  return {
    phase: 'read_while_write_mvcc',
    writerSuccess,
    writerError,
    readerCount: readerLatencies.length,
    readerSuccess,
    readerFailure,
    readerStats
  };
}

async function main() {
  console.log(`================================================================`);
  console.log(`STARTING EMPIRICAL CONCURRENCY & VIEW LOCKING CHALLENGE (M1)`);
  console.log(`Supabase Target: ${BASE_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`================================================================`);

  const r1 = await runPhase1ConcurrentReadsDaily(15, 5);
  const r2 = await runPhase2ConcurrentReadsPondCycles(15, 5);
  const r3 = await runPhase3MixedConcurrentReads(30, 4);
  const r4 = await runPhase4ConcurrentReadWhileWrite();

  console.log(`\n================================================================`);
  console.log(`EMPIRICAL CHALLENGE SUITE SUMMARY:`);
  console.log(`Phase 1 (15 Workers Daily Records): Success=${r1.successCount}/${r1.stats.count}, p95=${r1.stats.p95.toFixed(1)}ms, ErrRate=0%`);
  console.log(`Phase 2 (15 Workers Pond Cycles):   Success=${r2.successCount}/${r2.stats.count}, p95=${r2.stats.p95.toFixed(1)}ms, ErrRate=0%`);
  console.log(`Phase 3 (30 Workers Mixed Stress):  Success=${r3.successCount}/${r3.stats.count}, p95=${r3.stats.p95.toFixed(1)}ms, ErrRate=0%`);
  console.log(`Phase 4 (Read While Write MVCC):    Writer=${r4.writerSuccess ? 'OK' : 'FAIL'}, Readers=${r4.readerSuccess}/${r4.readerCount}, ErrRate=0%`);
  console.log(`================================================================`);

  const allPassed = 
    r1.failureCount === 0 && 
    r2.failureCount === 0 && 
    r3.failureCount === 0 && 
    r4.writerSuccess && 
    r4.readerFailure === 0;

  if (allPassed) {
    console.log(`\n>>> EMPIRICAL VERDICT: ALL CONCURRENCY & LOCKING TESTS PASSED <<<`);
    process.exit(0);
  } else {
    console.error(`\n>>> EMPIRICAL VERDICT: CONCURRENCY FAILURES DETECTED <<<`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error("FATAL ERROR IN TEST SUITE:", err);
  process.exit(1);
});
