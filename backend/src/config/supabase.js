const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Mock database path
const mockDbPath = path.resolve(__dirname, '../../../mock_db.json');

// Helper to load mock database
function loadMockDb() {
  if (fs.existsSync(mockDbPath)) {
    try {
      return JSON.parse(fs.readFileSync(mockDbPath, 'utf8'));
    } catch (e) {
      console.warn('Mock DB: Error reading mock_db.json, resetting.');
    }
  }
  return {
    users: [],
    profiles: [],
    wallets: [],
    audit_logs: [],
    transactions: [],
    loans: [],
    investments: [],
    insurance_policies: [],
    rewards_xp: [],
    ai_recommendations: [],
    notifications: [],
    active_sessions: [],
    user_goals: []
  };
}

// Helper to save mock database
function saveMockDb(db) {
  try {
    fs.writeFileSync(mockDbPath, JSON.stringify(db, null, 2), 'utf8');
  } catch (e) {
    console.error('Mock DB: Failed to save mock database:', e.message);
  }
}

class MockSupabaseTable {
  constructor(tableName, db) {
    this.tableName = tableName;
    this.db = db;
    this.filters = [];
    this.orFilter = null;
    this.rowsToInsert = null;
    this.updateFields = null;
    this.selectFields = null;
    this.isDelete = false;
  }

  select(fields = '*') {
    this.selectFields = fields;
    return this;
  }

  or(filterStr) {
    this.orFilter = filterStr; // e.g. "email.eq.foo,phone.eq.bar"
    return this;
  }

  eq(field, value) {
    this.filters.push({ field, value });
    return this;
  }

  insert(rows) {
    this.rowsToInsert = rows;
    return this;
  }

  update(updateFields) {
    this.updateFields = updateFields;
    return this;
  }

  delete() {
    this.isDelete = true;
    return this;
  }

  // Allows await or promise chaining
  then(onfulfilled, onrejected) {
    return this.execute().then(onfulfilled, onrejected);
  }

  async execute() {
    const table = this.db[this.tableName];

    // Handle Insert
    if (this.rowsToInsert) {
      const newRows = this.rowsToInsert.map(row => {
        const newRow = { ...row };
        if (!newRow.id) {
          newRow.id = require('crypto').randomUUID ? require('crypto').randomUUID() : Math.random().toString(36).substring(2);
        }
        if (!newRow.created_at) {
          newRow.created_at = new Date().toISOString();
        }
        table.push(newRow);
        return newRow;
      });
      saveMockDb(this.db);
      return { data: newRows, error: null };
    }

    // Handle Delete
    if (this.isDelete) {
      const deletedRows = [];
      const remainingRows = [];
      for (let i = 0; i < table.length; i++) {
        let matches = true;
        for (const filter of this.filters) {
          if (String(table[i][filter.field]) !== String(filter.value)) {
            matches = false;
          }
        }
        if (matches) {
          deletedRows.push(table[i]);
        } else {
          remainingRows.push(table[i]);
        }
      }
      this.db[this.tableName] = remainingRows;
      saveMockDb(this.db);
      return { data: deletedRows, error: null };
    }

    // Handle Update
    if (this.updateFields) {
      const updatedRows = [];
      for (let i = 0; i < table.length; i++) {
        let matches = true;
        for (const filter of this.filters) {
          if (String(table[i][filter.field]) !== String(filter.value)) {
            matches = false;
          }
        }
        if (matches) {
          Object.assign(table[i], this.updateFields);
          updatedRows.push(table[i]);
        }
      }
      saveMockDb(this.db);
      return { data: updatedRows, error: null };
    }

    // Handle Select
    let data = [...table];

    // Apply OR filter
    if (this.orFilter) {
      const conditions = this.orFilter.split(',');
      data = data.filter(row => {
        return conditions.some(cond => {
          const parts = cond.split('.eq.');
          if (parts.length === 2) {
            const field = parts[0];
            const val = parts[1];
            return String(row[field]) === String(val);
          }
          return false;
        });
      });
    }

    // Apply AND filters (eq)
    for (const filter of this.filters) {
      data = data.filter(row => String(row[filter.field]) === String(filter.value));
    }

    return { data, error: null };
  }
}

class MockSupabaseClient {
  constructor() {
    this.db = loadMockDb();
    console.log('\x1b[36m%s\x1b[0m', `Supabase Service: Using JSON file-persisted MOCK database at ${mockDbPath}`);
  }

  from(tableName) {
    // Ensure table array exists
    if (!this.db[tableName]) {
      this.db[tableName] = [];
    }
    return new MockSupabaseTable(tableName, this.db);
  }
}

let liveClient = null;
const mockClient = new MockSupabaseClient();
let useMock = true;

if (supabaseUrl && supabaseKey && !supabaseUrl.includes('your-project') && !supabaseKey.includes('your-supabase')) {
  console.log('Supabase Service: Connecting to live Supabase project.');
  try {
    liveClient = createClient(supabaseUrl, supabaseKey);
    useMock = false;
  } catch (err) {
    console.error('Supabase Service: Initialization failed, falling back to mock DB:', err.message);
    useMock = true;
  }
} else {
  console.warn('\x1b[33m%s\x1b[0m', 'Warning: Supabase credentials are not configured. Falling back to local persisted mock DB.');
}

const supabase = {
  from(tableName) {
    if (useMock || !liveClient) {
      return mockClient.from(tableName);
    }
    return liveClient.from(tableName);
  },
  setUseMock(val) {
    useMock = val;
    if (val) {
      console.log('\x1b[33m%s\x1b[0m', 'Supabase Service: Switched to local persisted MOCK database.');
    }
  },
  isMock() {
    return useMock || !liveClient;
  }
};

module.exports = supabase;

