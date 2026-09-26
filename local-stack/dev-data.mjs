// LOCAL STACK ONLY: clearly-labelled DEV records created through the real API, never the database.
// Idempotent: existing DEV accounts and enquiries are detected and left alone.
const API = process.env.CLEARWOOD_API_ORIGIN;
const ORIGIN = process.env.CLEARWOOD_ADMIN_ORIGIN;
const SUPER = {
  email: process.env.DEV_SUPERADMIN_EMAIL,
  password: process.env.DEV_SUPERADMIN_PASSWORD,
};
const DEV_PASSWORD = process.env.DEV_ADMIN_PASSWORD;

if (!API || !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(API)) {
  throw new Error(`Refusing to write DEV data to ${API}: only a local API is allowed.`);
}

const jar = new Map();

async function call(method, path, body, { auth = true } = {}) {
  const headers = { Origin: ORIGIN, Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && jar.size) {
    headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    if (method !== 'GET' && jar.has('cw_adm_csrf'))
      headers['X-CSRF-Token'] = jar.get('cw_adm_csrf');
  }
  const res = await fetch(`${API}/api/v1${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (auth) {
    for (const cookie of res.headers.getSetCookie()) {
      const [pair] = cookie.split(';');
      const [name, ...rest] = pair.split('=');
      jar.set(name.trim(), rest.join('='));
    }
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      `${method} ${path} -> ${res.status} ${json?.error?.code ?? ''} ${json?.error?.message ?? ''}`,
    );
  }
  return json;
}

const ACCOUNTS = [
  { email: 'dev.admin@clearwood.local', name: 'DEV Admin', roleCodes: ['ADMIN'] },
  {
    email: 'dev.catalog@clearwood.local',
    name: 'DEV Catalog Manager',
    roleCodes: ['CATALOG_MANAGER'],
  },
  { email: 'dev.orders@clearwood.local', name: 'DEV Order Manager', roleCodes: ['ORDER_MANAGER'] },
  {
    email: 'dev.content@clearwood.local',
    name: 'DEV Content Manager',
    roleCodes: ['CONTENT_MANAGER'],
  },
];

const ENQUIRIES = [
  {
    formKey: 'contract-work',
    name: 'DEV Meera Iyer',
    email: 'dev.meera@example.test',
    city: 'Bengaluru',
    pincode: '560001',
    companyName: 'DEV Iyer Interiors',
    message: 'DEV: 3BHK wardrobe and kitchen shutters in teak veneer.',
    budgetPaise: 45000000,
  },
  {
    formKey: 'contract-work',
    name: 'DEV Arjun Rao',
    phone: '+91 98450 00001',
    city: 'Mysuru',
    pincode: '570001',
    message: 'DEV: Office reception desk and 12 workstations.',
    quantity: 12,
  },
  {
    formKey: 'home-interiors',
    name: 'DEV Kavya Nair',
    email: 'dev.kavya@example.test',
    city: 'Kochi',
    pincode: '682001',
    message: 'DEV: Full living room in sheesham, looking for a site visit.',
  },
  {
    formKey: 'home-interiors',
    name: 'DEV Rohan Mehta',
    email: 'dev.rohan@example.test',
    phone: '+91 98200 00002',
    city: 'Pune',
    pincode: '411001',
    message: 'DEV: Bedroom set with storage bed, king size.',
    budgetPaise: 18000000,
  },
  {
    formKey: 'contract-work',
    name: 'DEV Hotel Sagar',
    email: 'dev.sagar@example.test',
    city: 'Mangaluru',
    pincode: '575001',
    companyName: 'DEV Sagar Residency',
    message: 'DEV: 40 room refurbishment, beds and side tables.',
    quantity: 40,
  },
  {
    formKey: 'home-interiors',
    name: 'DEV Farah Khan',
    phone: '+91 99000 00003',
    city: 'Hyderabad',
    pincode: '500001',
    message: 'DEV: Dining table for 8 in walnut finish.',
  },
];

await call('POST', '/admin/auth/login', { ...SUPER, deviceLabel: 'local-stack dev-data' });

const existing = await call('GET', '/admin/users?search=dev.&limit=100');
const known = new Set((existing.data ?? []).map((user) => user.email));
for (const account of ACCOUNTS) {
  if (known.has(account.email)) {
    console.log(`account ${account.email}: exists`);
    continue;
  }
  await call('POST', '/admin/users', { ...account, password: DEV_PASSWORD });
  console.log(
    `account ${account.email}: created (${account.roleCodes.join(', ')}, must change password)`,
  );
}

const enquiries = await call('GET', '/admin/enquiries?q=DEV&limit=100');
const names = new Set((enquiries.data ?? []).map((row) => row.name));
for (const enquiry of ENQUIRIES) {
  if (names.has(enquiry.name)) continue;
  await call('POST', '/enquiries', enquiry, { auth: false });
  console.log(`enquiry ${enquiry.name}: submitted`);
}

await call('POST', '/admin/auth/logout', {});
console.log('DEV data is in place.');
