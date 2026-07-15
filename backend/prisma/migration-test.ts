import { startPrismaDevServer } from '@prisma/dev';
import { spawn } from 'node:child_process';
import { Server, createServer } from 'node:net';
import { resolve } from 'node:path';
import { Client } from 'pg';

interface DatabaseErrorLike {
  code?: string;
}

interface CountRow {
  count: string;
}

function reserveAvailablePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server: Server = createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Could not reserve a local port for the migration test.'));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolvePort(port);
      });
    });
  });
}

function runPrisma(arguments_: string[], databaseUrl: string): Promise<void> {
  return new Promise((resolveRun, reject) => {
    const backendRoot = process.cwd();
    const prismaCli = resolve(backendRoot, 'node_modules/prisma/build/index.js');
    const child = spawn(process.execPath, [prismaCli, ...arguments_], {
      cwd: backendRoot,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill();
    }, 120_000);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('close', (code, signal) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(
          new Error(
            `Prisma ${arguments_.join(' ')} failed with ${
              signal ? `signal ${signal}` : `exit code ${String(code)}`
            }.\n${stdout}\n${stderr}`.trim(),
          ),
        );
        return;
      }

      const output = `${stdout}${stderr}`.trim();
      if (output) {
        console.info(output);
      }
      resolveRun();
    });
  });
}

async function expectSqlState(operation: Promise<unknown>, expectedCode: string): Promise<void> {
  try {
    await operation;
  } catch (error: unknown) {
    const code = (error as DatabaseErrorLike).code;
    if (code === expectedCode) {
      return;
    }
    throw error;
  }

  throw new Error(`Expected PostgreSQL error ${expectedCode}, but the statement succeeded.`);
}

async function readCount(client: Client, table: string, userId?: string): Promise<number> {
  const safeTables = new Set([
    'users',
    'stores',
    'food_records',
    'tags',
    'food_record_tags',
    'record_images',
    'dish_items',
    'auth_identities',
    'refresh_sessions',
  ]);
  if (!safeTables.has(table)) {
    throw new Error(`Unexpected table name: ${table}`);
  }

  const query = userId
    ? `SELECT count(*)::text AS count FROM ${table} WHERE user_id = $1`
    : `SELECT count(*)::text AS count FROM ${table}`;
  const result = await client.query<CountRow>(query, userId ? [userId] : []);
  return Number(result.rows[0]?.count ?? '0');
}

async function testMigration(): Promise<void> {
  const [port, databasePort, shadowDatabasePort, streamsPort] = await Promise.all([
    reserveAvailablePort(),
    reserveAvailablePort(),
    reserveAvailablePort(),
    reserveAvailablePort(),
  ]);
  const server = await startPrismaDevServer({
    databasePort,
    name: `foodtrace-migration-test-${process.pid}`,
    persistenceMode: 'stateless',
    port,
    shadowDatabasePort,
    streamsPort,
  });
  const databaseConnection = new URL(server.database.connectionString);
  databaseConnection.hostname = '127.0.0.1';
  const databaseUrl = databaseConnection.toString();
  const client = new Client({ connectionString: databaseUrl });

  try {
    await runPrisma(['migrate', 'deploy'], databaseUrl);
    await runPrisma(['migrate', 'deploy'], databaseUrl);
    await runPrisma(['db', 'seed'], databaseUrl);
    await runPrisma(['db', 'seed'], databaseUrl);
    await runPrisma(['migrate', 'status'], databaseUrl);

    await client.connect();

    const tableResult = await client.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'users',
          'stores',
          'food_records',
          'tags',
          'food_record_tags',
          'record_images',
          'dish_items',
          'auth_identities',
          'refresh_sessions'
        )
      ORDER BY table_name
    `);
    if (tableResult.rowCount !== 9) {
      throw new Error(`Expected 9 core tables, found ${tableResult.rowCount ?? 0}.`);
    }

    if (
      (await readCount(client, 'users')) !== 1 ||
      (await readCount(client, 'stores')) !== 3 ||
      (await readCount(client, 'food_records')) !== 3
    ) {
      throw new Error('Development seed did not create the expected baseline rows.');
    }

    const seedUserId = '00000000-0000-4000-8000-000000000001';
    const secondUserId = '10000000-0000-4000-8000-000000000001';
    const secondStoreId = '10000000-0000-4000-8000-000000000101';
    const secondSessionId = '10000000-0000-4000-8000-000000000301';

    await expectSqlState(
      client.query(
        `INSERT INTO stores (
          id, user_id, source, map_poi_id, name, latitude, longitude
        ) VALUES ($1, $2, 'TENCENT_POI', 'dev-tencent-poi-001', '重复店铺', 31.2, 121.4)`,
        ['10000000-0000-4000-8000-000000000102', seedUserId],
      ),
      '23505',
    );

    await client.query(`INSERT INTO users (id, nickname) VALUES ($1, '隔离测试用户')`, [
      secondUserId,
    ]);
    await client.query(
      `INSERT INTO stores (
        id, user_id, source, map_poi_id, name, latitude, longitude
      ) VALUES ($1, $2, 'TENCENT_POI', 'dev-tencent-poi-001', '另一用户的同一 POI', 31.2, 121.4)`,
      [secondStoreId, secondUserId],
    );
    await client.query(
      `INSERT INTO refresh_sessions (
        id, user_id, family_id, token_hash, device_id, expires_at
      ) VALUES ($1, $2, $3, $4, 'migration-test-device', now() + interval '1 day')`,
      [secondSessionId, secondUserId, '10000000-0000-4000-8000-000000000302', 'a'.repeat(64)],
    );

    await expectSqlState(
      client.query(
        `INSERT INTO food_records (id, user_id, store_id, status)
         VALUES ($1, $2, $3, 'WANT_TO_GO')`,
        [
          '10000000-0000-4000-8000-000000000201',
          secondUserId,
          '00000000-0000-4000-8000-000000000101',
        ],
      ),
      '23503',
    );

    await expectSqlState(
      client.query(
        `INSERT INTO food_records (
          id, user_id, store_id, status, total_price
        ) VALUES ($1, $2, $3, 'VISITED', -0.01)`,
        ['10000000-0000-4000-8000-000000000203', secondUserId, secondStoreId],
      ),
      '23514',
    );

    await expectSqlState(
      client.query(
        `INSERT INTO food_records (
          id, user_id, store_id, status, overall_rating
        ) VALUES ($1, $2, $3, 'VISITED', 5.1)`,
        ['10000000-0000-4000-8000-000000000202', secondUserId, secondStoreId],
      ),
      '23514',
    );

    await client.query('DELETE FROM users WHERE id = $1', [seedUserId]);
    for (const table of [
      'stores',
      'food_records',
      'tags',
      'food_record_tags',
      'record_images',
      'dish_items',
      'auth_identities',
      'refresh_sessions',
    ]) {
      if ((await readCount(client, table, seedUserId)) !== 0) {
        throw new Error(`User cascade delete left rows in ${table}.`);
      }
    }

    if ((await readCount(client, 'stores', secondUserId)) !== 1) {
      throw new Error("Deleting one user affected another user's store.");
    }

    console.info(
      'Migration integration test passed: deploy, re-deploy, repeatable seed, constraints, isolation, and cascades.',
    );
  } finally {
    await client.end().catch(() => undefined);
    await server.close();
  }
}

testMigration().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
