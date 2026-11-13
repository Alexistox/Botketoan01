const axios = require('axios');

const AMOUNT_VND = 100_000_000;
const RESULT_COUNT = 10;
const FETCH_COUNT = RESULT_COUNT + 1; // +1 để bỏ qua thương nhân đầu
const TIMEOUT_MS = 12_000;

const HTTP_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
};

/**
 * Chuẩn hóa danh sách giá: bỏ thương nhân đầu, lấy tối đa 10 giá trị.
 * @param {Array<{price: number, nickName: string}>} items
 */
function skipFirstTakeTen(items) {
  return (items || []).slice(1, 1 + RESULT_COUNT);
}

function toNumber(value) {
  const n = parseFloat(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Binance P2P — cột Mua (tradeType BUY), lọc mức 100tr VND.
 */
async function fetchBinanceBuyPrices() {
  const payload = {
    page: 1,
    rows: FETCH_COUNT,
    asset: 'USDT',
    fiat: 'VND',
    tradeType: 'BUY',
    publisherType: null,
    merchantCheck: false,
    payTypes: [],
    countries: [],
    transAmount: String(AMOUNT_VND)
  };

  const { data } = await axios.post(
    'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
    payload,
    { headers: HTTP_HEADERS, timeout: TIMEOUT_MS }
  );

  if (data?.code && data.code !== '000000') {
    throw new Error(data.message || `Binance error ${data.code}`);
  }

  const ads = Array.isArray(data?.data) ? data.data : [];
  const items = ads
    .map((row) => {
      const price = toNumber(row?.adv?.price);
      if (price == null) return null;
      return {
        price,
        nickName: row?.advertiser?.nickName || ''
      };
    })
    .filter(Boolean);

  return skipFirstTakeTen(items);
}

/**
 * OKX P2P — cột Mua (side=sell = merchant bán USDT), lọc client-side mức 100tr VND.
 */
async function fetchOkxBuyPrices() {
  const { data } = await axios.get(
    'https://www.okx.com/v3/c2c/tradingOrders/books',
    {
      params: {
        quoteCurrency: 'VND',
        baseCurrency: 'USDT',
        side: 'sell',
        paymentMethod: 'all',
        userType: 'all'
      },
      headers: HTTP_HEADERS,
      timeout: TIMEOUT_MS
    }
  );

  if (data?.code !== 0 && data?.code !== '0' && Number(data?.code) !== 0) {
    throw new Error(data?.error_message || data?.msg || `OKX error ${data?.code}`);
  }

  const ads = Array.isArray(data?.data?.sell) ? data.data.sell : [];
  const items = ads
    .filter((row) => {
      const min = toNumber(row?.quoteMinAmountPerOrder) ?? 0;
      const max = toNumber(row?.quoteMaxAmountPerOrder) ?? Number.POSITIVE_INFINITY;
      return min <= AMOUNT_VND && AMOUNT_VND <= max;
    })
    .map((row) => {
      const price = toNumber(row?.price);
      if (price == null) return null;
      return {
        price,
        nickName: row?.nickName || ''
      };
    })
    .filter(Boolean);

  return skipFirstTakeTen(items);
}

/**
 * Bybit P2P — cột Mua (side "1" = user mua USDT), lọc mức 100tr VND.
 */
async function fetchBybitBuyPrices() {
  const payload = {
    userId: '',
    tokenId: 'USDT',
    currencyId: 'VND',
    payment: [],
    side: '1',
    size: String(FETCH_COUNT),
    page: '1',
    amount: String(AMOUNT_VND),
    authMaker: false,
    canTrade: false
  };

  const { data } = await axios.post(
    'https://api2.bybit.com/fiat/otc/item/online',
    payload,
    { headers: HTTP_HEADERS, timeout: TIMEOUT_MS }
  );

  if (data?.ret_code !== 0) {
    throw new Error(data?.ret_msg || `Bybit error ${data?.ret_code}`);
  }

  const ads = Array.isArray(data?.result?.items) ? data.result.items : [];
  const items = ads
    .map((row) => {
      const price = toNumber(row?.price);
      if (price == null) return null;
      return {
        price,
        nickName: row?.nickName || ''
      };
    })
    .filter(Boolean);

  return skipFirstTakeTen(items);
}

const EXCHANGES = {
  binance: {
    key: 'binance',
    label: 'Binance',
    command: '/z0',
    fetch: fetchBinanceBuyPrices
  },
  okx: {
    key: 'okx',
    label: 'OKX',
    command: '/z1',
    fetch: fetchOkxBuyPrices
  },
  bybit: {
    key: 'bybit',
    label: 'Bybit',
    command: '/z2',
    fetch: fetchBybitBuyPrices
  }
};

module.exports = {
  AMOUNT_VND,
  RESULT_COUNT,
  EXCHANGES,
  fetchBinanceBuyPrices,
  fetchOkxBuyPrices,
  fetchBybitBuyPrices,
  skipFirstTakeTen
};
