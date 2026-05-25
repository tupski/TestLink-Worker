# Database Layer Documentation

This directory contains the database abstraction layer for TestLink Worker, supporting both SQLite and MySQL databases.

## Architecture

The database layer consists of:

- **Type Definitions** (`types/database.ts`): TypeScript interfaces for database configuration and adapters
- **Database Adapters**: Implementations of the `DatabaseAdapter` interface
  - `sqlite-adapter.ts`: SQLite implementation for local development
  - `mysql-adapter.ts`: MySQL implementation for production deployment
- **Schema Module** (`schema.ts`): MySQL schema creation and initialization
- **Factory Module** (`factory.ts`): Factory functions to create the appropriate adapter based on configuration

## Usage

### Basic Usage with Environment Variables

```typescript
import { createDatabaseAdapterFromEnv } from './database/factory';

// Load configuration from environment variables and create adapter
const db = await createDatabaseAdapterFromEnv();

// Query data
const sites = await db.query('SELECT * FROM sites WHERE is_active = ?', [1]);

// Execute statements
await db.execute('INSERT INTO sites (id, name, links, created_at) VALUES (?, ?, ?, ?)', 
  ['uuid', 'Test Site', 'https://example.com', new Date().toISOString()]);

// Use transactions
const transaction = await db.beginTransaction();
try {
  await transaction.execute('UPDATE sites SET name = ? WHERE id = ?', ['New Name', 'uuid']);
  await transaction.commit();
} catch (error) {
  await transaction.rollback();
  throw error;
}

// Close connection when done
await db.close();
```

### Manual Configuration

```typescript
import { createDatabaseAdapter } from './database/factory';
import { DatabaseConfig } from './types/database';

// MySQL configuration
const mysqlConfig: DatabaseConfig = {
  type: 'mysql',
  host: 'localhost',
  port: 3306,
  user: 'testlink_user',
  password: 'secure_password',
  database: 'testlink_db',
  connectionLimit: 10
};

const mysqlDb = await createDatabaseAdapter(mysqlConfig);

// SQLite configuration
const sqliteConfig: DatabaseConfig = {
  type: 'sqlite',
  database: './data/database.sqlite'
};

const sqliteDb = await createDatabaseAdapter(sqliteConfig);
```

### Schema Initialization (MySQL Only)

The MySQL adapter automatically creates the schema during initialization. However, you can also use the schema module directly:

```typescript
import { createMySQLSchema, seedDefaultSettings, initializeMySQLDatabase } from './database/schema';
import { MySQLAdapter } from './database/mysql-adapter';

const adapter = new MySQLAdapter(config);
await adapter.initialize(); // This already calls initializeMySQLDatabase()

// Or manually:
await createMySQLSchema(adapter);      // Create tables only
await seedDefaultSettings(adapter);    // Seed default settings only
await initializeMySQLDatabase(adapter); // Create tables + seed settings
```

## Environment Variables

### MySQL Configuration

```bash
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USER=testlink_user
DB_PASSWORD=secure_password
DB_NAME=testlink_db
DB_CONNECTION_LIMIT=10  # Optional, default: 10
```

### SQLite Configuration

```bash
DB_TYPE=sqlite
SQLITE_PATH=./data/database.sqlite  # Optional, default: ./data/database.sqlite
```

## Database Schema

### Tables

#### sites
Stores link categories with metadata.

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR(36) | UUID primary key |
| name | VARCHAR(255) | Display name |
| links | TEXT | Newline-separated URLs |
| created_at | DATETIME | Creation timestamp |
| sort_order | INT | Display order (lower = higher priority) |
| is_active | TINYINT(1) | Active status (1 = active, 0 = inactive) |

**Indexes**: `idx_sort_order`, `idx_created_at`, `idx_is_active`

#### progress
Tracks testing progress per device per site.

| Column | Type | Description |
|--------|------|-------------|
| device_id | VARCHAR(255) | Device identifier (composite key) |
| site_id | VARCHAR(36) | Site ID reference (composite key) |
| last_index | INT | Last tested link index |
| normal_count | INT | Count of successful tests |
| error_count | INT | Count of failed tests |

**Indexes**: `idx_device_id`, `idx_site_id`  
**Foreign Keys**: `site_id` references `sites(id)` ON DELETE CASCADE

#### history
Audit log of admin actions.

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Auto-increment primary key |
| action | VARCHAR(50) | Action type: 'ADD', 'EDIT', 'DELETE' |
| site_name | VARCHAR(255) | Name of affected site |
| diff_summary | TEXT | Human-readable summary of changes |
| diff_details | TEXT | JSON string with detailed diff |
| created_at | DATETIME | Action timestamp |

**Indexes**: `idx_created_at`, `idx_action`

#### kv_settings
Key-value store for application settings.

| Column | Type | Description |
|--------|------|-------------|
| key | VARCHAR(100) | Setting key (primary key) |
| value | TEXT | Setting value |

### Default Settings

The following settings are automatically seeded during initialization:

- `app_title`: "Test Link"
- `app_tagline`: "Runner link & cek koneksi, satu layar."
- `default_interval`: "3"
- `maintenance_mode`: "0"
- `maintenance_message`: ""
- `about_page_title`: "Tentang Test Link"
- `about_page_body`: Application description

## Testing

### Run All Database Tests

```bash
npm test -- src/database/ --run
```

### Run Specific Test Files

```bash
npm test -- src/database/schema.test.ts --run
npm test -- src/database/mysql-adapter.test.ts --run
npm test -- src/database/sqlite-adapter.test.ts --run
```

## Migration from SQLite to MySQL

See the migration script in `src/scripts/migrate.ts` for data migration from SQLite to MySQL.

## Performance Considerations

### MySQL Connection Pooling

The MySQL adapter uses connection pooling with the following defaults:
- **Connection Limit**: 10 (configurable via `DB_CONNECTION_LIMIT`)
- **Idle Timeout**: 60 seconds
- **Keep Alive**: Enabled

### Prepared Statements

All queries use prepared statements (parameterized queries) to:
- Prevent SQL injection attacks
- Improve query performance through query plan caching
- Ensure proper data type handling

### Indexes

Indexes are created on frequently queried columns:
- `sites`: `sort_order`, `created_at`, `is_active`
- `progress`: `device_id`, `site_id`
- `history`: `created_at`, `action`

### Slow Query Logging

Queries taking longer than 1 second are automatically logged with a warning for monitoring and optimization.

## Error Handling

All database operations include comprehensive error handling:
- Connection errors are logged with timestamps
- Query errors include SQL statement and parameters
- Transactions are automatically rolled back on error
- Graceful shutdown ensures connections are properly closed

## Requirements Validation

This database layer validates the following requirements:

- **1.1**: Database abstraction layer supporting both SQLite and MySQL
- **1.2**: All tables preserved with same structure
- **1.3**: Connection pooling for MySQL
- **1.4**: Automatic table creation on startup
- **1.5**: Environment variable configuration
- **1.6**: Identical results for all operations
- **9.1**: Backward compatibility with SQLite
- **10.1**: Prepared statements for all queries
- **10.2**: Optimized connection pooling
- **10.3**: Indexes on frequently queried columns
- **10.4**: Transaction support
- **10.6**: Graceful shutdown

## License

Part of TestLink Worker application.
