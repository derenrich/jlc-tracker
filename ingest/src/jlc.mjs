// Client for JLCPCB's parts-search endpoint (the same call the parts browser
// on jlcpcb.com makes). No authentication is required; the secretkey header is
// a fixed public value ("defaultKeyId" hex-encoded).

const API_URL =
  'https://jlcpcb.com/api/overseas-pcb-order/v1/shoppingCart/smtGood/selectSmtComponentList/v2';

const HEADERS = {
  accept: 'application/json, text/plain, */*',
  'content-type': 'application/json',
  origin: 'https://jlcpcb.com',
  referer: 'https://jlcpcb.com/parts/basic_parts',
  secretkey: '64656661756c744b65794964',
  'user-agent':
    'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36',
};

// componentLibraryType "base" with preferredComponentFlag true matches the set
// shown on jlcpcb.com/parts/basic_parts: basic parts plus preferred extended
// parts (~1.6k). The unfiltered library is >7M parts, which is neither useful
// to snapshot daily nor possible within Firestore's free quota.
export const DEFAULT_QUERY = {
  searchType: 2,
  keyword: null,
  componentLibraryType: 'base',
  presaleType: '',
  preferredComponentFlag: true,
  stockFlag: null,
  stockSort: null,
  firstSortName: null,
  secondSortName: null,
  componentBrand: null,
  componentSpecification: null,
  componentAttributes: [],
  searchSource: 'search',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchPage(query, currentPage, pageSize, { retries = 3 } = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ ...query, currentPage, pageSize }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      if (body.code !== 200 || !body.data?.componentPageInfo) {
        throw new Error(`unexpected response code ${body.code}: ${body.message ?? ''}`);
      }
      return body;
    } catch (err) {
      if (attempt >= retries) throw err;
      await sleep(2000 * attempt);
    }
  }
}

// Fetches every page of the query. Returns { pages, components } where pages
// holds the raw API responses (kept verbatim for the backup archive) and
// components is the flattened, de-duplicated part list.
export async function fetchAllComponents(query = DEFAULT_QUERY, { pageSize = 100, delayMs = 700, log = () => {} } = {}) {
  const pages = [];
  const byCode = new Map();

  const first = await fetchPage(query, 1, pageSize);
  pages.push(first);
  const { total, pages: pageCount } = first.data.componentPageInfo;
  log(`total=${total} pages=${pageCount}`);

  for (let page = 2; page <= pageCount; page++) {
    await sleep(delayMs);
    pages.push(await fetchPage(query, page, pageSize));
    log(`fetched page ${page}/${pageCount}`);
  }

  for (const page of pages) {
    for (const item of page.data.componentPageInfo.list) {
      byCode.set(item.componentCode, item);
    }
  }
  return { pages, components: [...byCode.values()] };
}

// Downloads a part thumbnail while its signed URL is still valid and returns
// a data URI, or null if unavailable. JLCPCB image URLs expire after ~30
// minutes, so images cannot be hot-linked and are stored at ingest time.
export async function fetchImageDataUri(url, { maxBytes = 80_000 } = {}) {
  if (!url) return null;
  try {
    const res = await fetch(url, { headers: { 'user-agent': HEADERS['user-agent'] } });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > maxBytes) return null;
    const type = url.split('?')[0].toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}
