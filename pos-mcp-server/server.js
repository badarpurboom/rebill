import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

dotenv.config();

const PORT = process.env.MCP_PORT || process.env.PORT || 3333;
const API_BASE_URL = (process.env.API_BASE_URL || 'https://laoo.online/api/ai').replace(/\/+$/, '');
const AI_TOKEN = process.env.AI_CONNECTION_TOKEN || 'POS-c79aa012f0cc75a4b89807dc72e85d97';

function createApiClient() {
  return axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Authorization': `Bearer ${AI_TOKEN}`,
      'Accept': 'application/json',
    },
    timeout: 15000,
  });
}

function createConfiguredMcpServer() {
  const server = new McpServer(
    {
      name: 'rebill-pos-mcp',
      version: '1.0.0',
      description: 'Model Context Protocol (MCP) server for ReBill Restaurant POS System with Deep Database Querying capabilities. INSTRUCTIONS: Jab bhi user analytics ya data se related koi sawaal poochhe jo existing simple tools (sales summary, top products) se poora na ho, pehle explore_database_schema call karo agar schema pehle nahi dekha, phir run_sql_query se sahi query likh ke poora, detailed answer do. Sirf surface-level jawab mat do, jitna deep analysis ho sake utna karo.',
    },
    {
      capabilities: {
        tools: { listChanged: true },
        prompts: { listChanged: true },
      },
    }
  );

  const api = createApiClient();

  // 1. explore_database_schema
  server.tool(
    'explore_database_schema',
    'Poore restaurant database ka schema dekhne ke liye — saari tables, columns, aur unke relationships. Kisi bhi analysis se pehle isko call karke pehle samajh lo database mein kya data available hai.',
    {},
    async () => {
      try {
        const response = await api.get(`/schema/`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error) {
        const errDetail = error.response ? JSON.stringify(error.response.data) : error.message;
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to fetch database schema: ${errDetail}` }],
        };
      }
    }
  );

  // 2. run_sql_query
  server.tool(
    'run_sql_query',
    'Restaurant database par koi bhi custom SQL SELECT query chalane ke liye — deep analytics, joins, aggregations, grouping, filtering, kuch bhi. Pehle explore_database_schema tool se schema dekh lo taaki sahi table/column names pata ho, phir yahan apna query likho. Sirf SELECT queries allowed hain.',
    {
      sql: z.string().describe('Custom SQL SELECT query string to execute on the restaurant database'),
    },
    async ({ sql }) => {
      try {
        const response = await api.post(`/query/`, { sql });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error) {
        const errDetail = error.response ? JSON.stringify(error.response.data) : error.message;
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to execute SQL query: ${errDetail}` }],
        };
      }
    }
  );

  // 3. get_sales_summary
  server.tool(
    'get_sales_summary',
    'Get high-level dashboard metrics for today, week, or month (sales, bills, table occupancy, payment breakdown, trends).',
    {
      period: z.enum(['today', 'week', 'month']).default('today').describe('Sales summary period (today, week, or month)'),
    },
    async ({ period }) => {
      try {
        const response = await api.get(`/sales/summary/`, { params: { period } });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error) {
        const errDetail = error.response ? JSON.stringify(error.response.data) : error.message;
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to fetch sales summary: ${errDetail}` }],
        };
      }
    }
  );

  // 4. get_daily_sales_report
  server.tool(
    'get_daily_sales_report',
    'Get detailed breakdown of a specific day sales including subtotal, tax, net sales, cash/card/UPI distribution, and top items.',
    {
      date: z.string().optional().describe('Target date in YYYY-MM-DD format (e.g. 2026-08-23). Defaults to today if omitted.'),
    },
    async ({ date }) => {
      try {
        const params = date ? { date } : {};
        const response = await api.get(`/sales/daily/`, { params });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error) {
        const errDetail = error.response ? JSON.stringify(error.response.data) : error.message;
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to fetch daily sales report: ${errDetail}` }],
        };
      }
    }
  );

  // 5. get_top_products
  server.tool(
    'get_top_products',
    'Get all-time top selling dishes/products by quantity and total revenue.',
    {
      limit: z.number().int().min(1).max(50).default(5).describe('Maximum number of top products to return (default: 5)'),
    },
    async ({ limit }) => {
      try {
        const response = await api.get(`/products/top/`, { params: { limit } });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error) {
        const errDetail = error.response ? JSON.stringify(error.response.data) : error.message;
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to fetch top products: ${errDetail}` }],
        };
      }
    }
  );

  // 6. get_top_customers
  server.tool(
    'get_top_customers',
    'Get top customers by Lifetime Value (LTV), visit count, total spent, and loyalty points.',
    {},
    async () => {
      try {
        const response = await api.get(`/customers/top/`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error) {
        const errDetail = error.response ? JSON.stringify(error.response.data) : error.message;
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to fetch top customers: ${errDetail}` }],
        };
      }
    }
  );

  // 7. get_text_report
  server.tool(
    'get_text_report',
    'Get a ready-made formatted plain text summary of today and yesterday restaurant performance.',
    {},
    async () => {
      try {
        const response = await api.get(`/text-report/`);
        const textReport = response.data && response.data.report ? response.data.report : JSON.stringify(response.data, null, 2);
        return {
          content: [
            {
              type: 'text',
              text: textReport,
            },
          ],
        };
      } catch (error) {
        const errDetail = error.response ? JSON.stringify(error.response.data) : error.message;
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to fetch text report: ${errDetail}` }],
        };
      }
    }
  );

  // 8. get_daily_weather_and_footfall
  server.tool(
    'get_daily_weather_and_footfall',
    'Fetch real-world meteorological weather data (temperature, rainfall mm, condition), Indian calendar festivals & holidays, and real POS footfall/sales correlation for a single date or historical range (up to 90 days).',
    {
      date: z.string().optional().describe('Target date in YYYY-MM-DD format (defaults to today)'),
      days: z.number().int().min(1).max(90).optional().describe('Optional number of historical days to fetch for trend analysis (e.g. 7 or 30)'),
    },
    async ({ date, days }) => {
      try {
        const params = {};
        if (date) params.date = date;
        if (days) params.days = days;
        const response = await api.get(`/context/daily/`, { params });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error) {
        const errDetail = error.response ? JSON.stringify(error.response.data) : error.message;
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to fetch weather and footfall context: ${errDetail}` }],
        };
      }
    }
  );

  // 9. get_upcoming_demand_forecast
  server.tool(
    'get_upcoming_demand_forecast',
    'Get 7-day upcoming predictive demand and footfall forecast. Combines live weather forecast (Open-Meteo), upcoming Indian holidays/festivals/weekends, and historical POS sales trends to project expected bills, guest count (pax), and inventory/staffing recommendations.',
    {},
    async () => {
      try {
        const response = await api.get(`/forecast/demand/`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error) {
        const errDetail = error.response ? JSON.stringify(error.response.data) : error.message;
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to fetch upcoming demand forecast: ${errDetail}` }],
        };
      }
    }
  );

  // 10. cancel_bill  ── WRITE (safe)
  server.tool(
    'cancel_bill',
    `Cancel a single bill by its ID. 
SAFETY: Only ONE bill at a time (bulk cancel is not possible). 
Only RUNNING or BILLED bills can be cancelled — PAID bills cannot be undone. 
NO data is deleted — status is set to CANCELLED and all records are preserved forever. 
Every action is written to the audit log.`,
    {
      bill_id: z.number().int().positive().describe('The exact integer ID of the bill to cancel. Use run_sql_query to verify the bill first.'),
      reason: z.string().optional().describe('Optional reason for cancellation (e.g. "Customer left", "Wrong order")'),
    },
    async ({ bill_id, reason }) => {
      try {
        const response = await api.post(`/bills/cancel/`, { bill_id, reason });
        return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
      } catch (error) {
        const errDetail = error.response ? JSON.stringify(error.response.data) : error.message;
        return { isError: true, content: [{ type: 'text', text: `Failed to cancel bill: ${errDetail}` }] };
      }
    }
  );

  // 11. toggle_menu_item_availability  ── WRITE (safe)
  server.tool(
    'toggle_menu_item_availability',
    `Mark a menu item as available (in stock) or unavailable (out of stock).
SAFETY: Requires exact item_id — no bulk toggle possible.
Only the is_available boolean is changed — price, name, and all other data is untouched.
Use run_sql_query on menu_items table to find the correct item_id first.`,
    {
      item_id: z.number().int().positive().describe('The exact integer ID of the menu item.'),
      available: z.boolean().describe('true = mark as available, false = mark as unavailable/out-of-stock'),
    },
    async ({ item_id, available }) => {
      try {
        const response = await api.post(`/menu/toggle/`, { item_id, available });
        return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
      } catch (error) {
        const errDetail = error.response ? JSON.stringify(error.response.data) : error.message;
        return { isError: true, content: [{ type: 'text', text: `Failed to toggle menu item: ${errDetail}` }] };
      }
    }
  );

  // 12. update_menu_item_price  ── WRITE (safe)
  server.tool(
    'update_menu_item_price',
    `Update the price of a specific menu item portion (e.g. Full, Half).
SAFETY: Requires exact portion_id — no bulk price change possible.
New price must be between ₹1 and ₹1,00,000. Only the price field is updated.
Old price is saved to audit log before change.
Use run_sql_query on menu_portions table to find the correct portion_id first.`,
    {
      portion_id: z.number().int().positive().describe('The exact integer ID of the portion/variant (from menu_portions table).'),
      new_price: z.number().positive().describe('New price in Rupees (e.g. 250 for ₹250). Must be > 0.'),
    },
    async ({ portion_id, new_price }) => {
      try {
        const response = await api.post(`/menu/price/`, { portion_id, new_price });
        return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
      } catch (error) {
        const errDetail = error.response ? JSON.stringify(error.response.data) : error.message;
        return { isError: true, content: [{ type: 'text', text: `Failed to update price: ${errDetail}` }] };
      }
    }
  );

  // 13. update_customer  ── WRITE (safe)
  server.tool(
    'update_customer',
    `Update a customer's name or phone number.
SAFETY: Requires exact customer_id — no bulk update possible.
Only name and phone fields can be changed — loyalty points, visit history, and all other data is untouched.
No delete operation exists for customers.`,
    {
      customer_id: z.number().int().positive().describe('The exact integer ID of the customer.'),
      name: z.string().optional().describe('New name for the customer (optional)'),
      phone: z.string().optional().describe('New phone number for the customer (optional, 7-15 digits)'),
    },
    async ({ customer_id, name, phone }) => {
      try {
        const response = await api.post(`/customers/update/`, { customer_id, name, phone });
        return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
      } catch (error) {
        const errDetail = error.response ? JSON.stringify(error.response.data) : error.message;
        return { isError: true, content: [{ type: 'text', text: `Failed to update customer: ${errDetail}` }] };
      }
    }
  );

  // ── FLOOR MAP TOOLS ──────────────────────────────────────────────────────

  // 14. get_all_tables
  server.tool(
    'get_all_tables',
    'Get all restaurant tables with their live status (AVAILABLE/OCCUPIED/BILLED), running orders, and current items. Use this to see the full floor map picture.',
    {},
    async () => {
      try {
        const response = await api.get(`/tables/`);
        return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
      } catch (error) {
        const errDetail = error.response ? JSON.stringify(error.response.data) : error.message;
        return { isError: true, content: [{ type: 'text', text: `Failed to get tables: ${errDetail}` }] };
      }
    }
  );

  // 15. get_table_detail
  server.tool(
    'get_table_detail',
    'Get full details of a single table: status, all running order items, and bill summary. Use number="1" or table_id=5.',
    {
      number: z.string().optional().describe('Table number as string e.g. "1", "5", "12"'),
      table_id: z.number().int().positive().optional().describe('Internal table ID (use if you know it)'),
    },
    async ({ number, table_id }) => {
      try {
        const params = table_id ? { table_id } : { number };
        const response = await api.get(`/tables/detail/`, { params });
        return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
      } catch (error) {
        const errDetail = error.response ? JSON.stringify(error.response.data) : error.message;
        return { isError: true, content: [{ type: 'text', text: `Failed to get table detail: ${errDetail}` }] };
      }
    }
  );

  // 16. update_table_status
  server.tool(
    'update_table_status',
    `Manually change a table's status to AVAILABLE, OCCUPIED, or BILLED.
SAFETY: Requires table number or table_id. Only status field is changed. Audit logged.
Use "AVAILABLE" to free a table, "OCCUPIED" when guests arrive.`,
    {
      number: z.string().optional().describe('Table number e.g. "1", "5"'),
      table_id: z.number().int().positive().optional().describe('Internal table ID'),
      status: z.enum(['AVAILABLE', 'OCCUPIED', 'BILLED']).describe('New status for the table'),
    },
    async ({ number, table_id, status }) => {
      try {
        const response = await api.post(`/tables/status/`, { number, table_id, status });
        return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
      } catch (error) {
        const errDetail = error.response ? JSON.stringify(error.response.data) : error.message;
        return { isError: true, content: [{ type: 'text', text: `Failed to update table status: ${errDetail}` }] };
      }
    }
  );

  // 17. add_item_to_table_order
  server.tool(
    'add_item_to_table_order',
    `Add a menu item to a table's currently running order.
SAFETY: Table must have a running order. Item must be available. Quantity max 50.
You can search by item_name (fuzzy match) or provide exact variant_id.
Example: add 2x "Water Bottle" to Table 1.`,
    {
      number: z.string().optional().describe('Table number e.g. "1"'),
      table_id: z.number().int().positive().optional().describe('Internal table ID'),
      item_name: z.string().optional().describe('Menu item name to search (e.g. "Water Bottle", "Paneer Tikka")'),
      variant_id: z.number().int().positive().optional().describe('Exact variant/portion ID if known'),
      portion: z.enum(['FULL', 'HALF']).default('FULL').describe('Portion: FULL (default) or HALF'),
      quantity: z.number().int().min(1).max(50).default(1).describe('Number of pieces to add (1–50)'),
      note: z.string().optional().describe('Special instruction e.g. "kam mirchi", "extra cheese"'),
    },
    async ({ number, table_id, item_name, variant_id, portion, quantity, note }) => {
      try {
        const response = await api.post(`/tables/add-item/`, { number, table_id, item_name, variant_id, portion, quantity, note });
        return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
      } catch (error) {
        const errDetail = error.response ? JSON.stringify(error.response.data) : error.message;
        return { isError: true, content: [{ type: 'text', text: `Failed to add item: ${errDetail}` }] };
      }
    }
  );

  // 18. remove_item_from_order
  server.tool(
    'remove_item_from_order',
    `Remove a specific item from a running order by its order_item_id.
SAFETY: Requires explicit order_item_id (no bulk remove). Only works on RUNNING/BILLED orders.
Use get_table_detail first to see order_item_id values for each item on the table.`,
    {
      order_item_id: z.number().int().positive().describe('The order_item_id of the specific item to remove. Get this from get_table_detail.'),
    },
    async ({ order_item_id }) => {
      try {
        const response = await api.post(`/tables/remove-item/`, { order_item_id });
        return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
      } catch (error) {
        const errDetail = error.response ? JSON.stringify(error.response.data) : error.message;
        return { isError: true, content: [{ type: 'text', text: `Failed to remove item: ${errDetail}` }] };
      }
    }
  );

  return server;
}

const app = express();
app.use(cors({
  origin: '*',
  exposedHeaders: ['mcp-session-id', 'Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── OAuth 2.0 Auto-Approve Mock Layer for Claude.ai / Remote MCP ────

const getOAuthMetadata = (req) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['host'] || 'laoo.online';
  const baseUrl = `${protocol}://${host}`;
  return {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/authorize`,
    token_endpoint: `${baseUrl}/token`,
    registration_endpoint: `${baseUrl}/register`,
    jwks_uri: `${baseUrl}/jwks.json`,
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    code_challenge_methods_supported: ['S256', 'plain'],
    scopes_supported: ['all'],
  };
};

// a) Discovery endpoints
app.get('/.well-known/oauth-authorization-server', (req, res) => {
  res.json(getOAuthMetadata(req));
});

app.get('/.well-known/openid-configuration', (req, res) => {
  res.json(getOAuthMetadata(req));
});

app.get('/jwks.json', (req, res) => {
  res.json({ keys: [] });
});

// b) Dynamic Client Registration (RFC 7591)
const handleRegister = (req, res) => {
  const clientId = 'claude-client-' + randomUUID();
  const clientSecret = 'secret-' + randomUUID();
  const redirectUris = req.body?.redirect_uris || [];
  res.status(201).json({
    client_id: clientId,
    client_secret: clientSecret,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_secret_expires_at: 0,
    redirect_uris: redirectUris,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  });
};

app.post(['/register', '/oauth/register'], handleRegister);

// c) Auto-approve Authorization Endpoint
const handleAuthorize = (req, res) => {
  const redirectUri = req.query.redirect_uri;
  const state = req.query.state;
  const code = 'auth_code_' + randomUUID();

  if (!redirectUri) {
    return res.status(400).send('Missing redirect_uri parameter');
  }

  try {
    const targetUrl = new URL(redirectUri);
    targetUrl.searchParams.set('code', code);
    if (state) {
      targetUrl.searchParams.set('state', state);
    }
    return res.redirect(302, targetUrl.toString());
  } catch (err) {
    return res.status(400).send(`Invalid redirect_uri: ${err.message}`);
  }
};

app.get(['/authorize', '/oauth/authorize'], handleAuthorize);

// d) Token Endpoint - returns access_token matching AI_TOKEN
const handleToken = (req, res) => {
  res.json({
    access_token: AI_TOKEN,
    token_type: 'Bearer',
    expires_in: 86400 * 365,
    refresh_token: 'refresh_' + randomUUID(),
    scope: req.body?.scope || req.query?.scope || 'all',
  });
};

app.post(['/token', '/oauth/token'], handleToken);

// ── Health / Welcome route ─────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ReBill POS MCP Server',
    version: '1.0.0',
    oauth: {
      discovery: '/.well-known/oauth-authorization-server',
      authorize: '/authorize',
      token: '/token',
      register: '/register',
    },
    endpoints: {
      streamableHttp: '/mcp',
      sse: '/sse',
      messages: '/messages',
    },
    tools: [
      'explore_database_schema',
      'run_sql_query',
      'get_sales_summary',
      'get_daily_sales_report',
      'get_top_products',
      'get_top_customers',
      'get_text_report',
    ],
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Streamable HTTP Transport (/mcp) ──────────────────────────────
const httpSessions = new Map();

app.all('/mcp', async (req, res) => {
  try {
    const sessionId = req.headers['mcp-session-id'];
    let transport = sessionId ? httpSessions.get(sessionId) : null;

    if (!transport) {
      transport = new StreamableHTTPServerTransport({
        enableJsonResponse: true,
        sessionIdGenerator: () => randomUUID(),
        onsessionclosed: (closedId) => {
          httpSessions.delete(closedId);
        },
      });

      const server = createConfiguredMcpServer();
      await server.connect(transport);
    }

    await transport.handleRequest(req, res, req.body);

    if (transport.sessionId && !httpSessions.has(transport.sessionId)) {
      httpSessions.set(transport.sessionId, transport);
    }
  } catch (err) {
    console.error('Error handling /mcp request:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// ── Server-Sent Events (SSE) Transport (/sse & /messages) ───────────
const sseTransports = new Map();

app.get('/sse', async (req, res) => {
  try {
    const sseTransport = new SSEServerTransport('/messages', res);
    const mcpServer = createConfiguredMcpServer();
    await mcpServer.connect(sseTransport);

    const sessionId = sseTransport.sessionId;
    sseTransports.set(sessionId, sseTransport);

    req.on('close', () => {
      sseTransports.delete(sessionId);
    });
  } catch (err) {
    console.error('Error handling /sse connection:', err);
    if (!res.headersSent) {
      res.status(500).send(err.message);
    }
  }
});

app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = sseTransports.get(sessionId);

  if (!transport) {
    return res.status(404).json({ error: 'SSE session not found or expired' });
  }

  try {
    await transport.handlePostMessage(req, res, req.body);
  } catch (err) {
    console.error('Error handling /messages post:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(` ReBill POS MCP Server listening on port ${PORT}`);
  console.log(` Streamable HTTP Endpoint: http://localhost:${PORT}/mcp`);
  console.log(` SSE Endpoint:             http://localhost:${PORT}/sse`);
  console.log(` Target AI Base URL:       ${API_BASE_URL}`);
  console.log(`=================================================`);
});
