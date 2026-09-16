if (!process.env.TEST_DATABASE_URL) {
  throw new Error('Set TEST_DATABASE_URL to an isolated PostgreSQL database with migrations applied.');
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.PUSH_ENABLED = 'false';
