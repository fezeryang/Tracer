import axios from 'axios';
import {
  getPolygonCompatibleBaseUrl,
  getPolygonCompatibleKey,
  getPolygonCompatibleProviderName,
} from './marketDataKeys.js';
import { cachedMarketDataGet } from './marketDataRequestCache.js';
import { findCikByTicker, normalizeTicker } from './secService.js';
import { isDeepSeekConfigured, reviewOfficialSourceAuthority } from './deepseekReviewService.js';

const OFFICIAL_SOURCE_CACHE_MS = 20 * 60 * 1000;
const officialSourceCache = new Map();

const REGISTRY = {
  AAPL: {
    companyName: 'Apple Inc.',
    sources: [
      { type: 'official_website', name: 'Apple', url: 'https://www.apple.com' },
      { type: 'investor_relations', name: 'Apple Investor Relations', url: 'https://investor.apple.com' },
      { type: 'newsroom', name: 'Apple Newsroom', url: 'https://www.apple.com/newsroom/' },
    ],
  },
  MSFT: {
    companyName: 'Microsoft Corporation',
    sources: [
      { type: 'official_website', name: 'Microsoft', url: 'https://www.microsoft.com' },
      { type: 'investor_relations', name: 'Microsoft Investor Relations', url: 'https://www.microsoft.com/en-us/investor' },
      { type: 'newsroom', name: 'Microsoft News', url: 'https://news.microsoft.com' },
    ],
  },
  NVDA: {
    companyName: 'NVIDIA Corporation',
    sources: [
      { type: 'official_website', name: 'NVIDIA', url: 'https://www.nvidia.com' },
      { type: 'investor_relations', name: 'NVIDIA Investor Relations', url: 'https://investor.nvidia.com' },
      { type: 'newsroom', name: 'NVIDIA Newsroom', url: 'https://nvidianews.nvidia.com' },
    ],
  },
  TSLA: {
    companyName: 'Tesla, Inc.',
    sources: [
      { type: 'official_website', name: 'Tesla', url: 'https://www.tesla.com' },
      { type: 'investor_relations', name: 'Tesla Investor Relations', url: 'https://ir.tesla.com' },
    ],
  },
  GOOGL: {
    companyName: 'Alphabet Inc.',
    sources: [
      { type: 'official_website', name: 'Alphabet', url: 'https://www.abc.xyz' },
      { type: 'investor_relations', name: 'Alphabet Investor Relations', url: 'https://abc.xyz/investor/' },
      { type: 'press_release', name: 'Google Press Corner', url: 'https://blog.google/press/' },
    ],
  },
  META: {
    companyName: 'Meta Platforms, Inc.',
    sources: [
      { type: 'official_website', name: 'Meta', url: 'https://about.meta.com' },
      { type: 'investor_relations', name: 'Meta Investor Relations', url: 'https://investor.atmeta.com' },
      { type: 'newsroom', name: 'Meta Newsroom', url: 'https://about.fb.com/news/' },
    ],
  },
  AMZN: {
    companyName: 'Amazon.com, Inc.',
    sources: [
      { type: 'official_website', name: 'Amazon', url: 'https://www.amazon.com' },
      { type: 'investor_relations', name: 'Amazon Investor Relations', url: 'https://ir.aboutamazon.com' },
      { type: 'newsroom', name: 'Amazon News', url: 'https://www.aboutamazon.com/news' },
    ],
  },
  AMD: {
    companyName: 'Advanced Micro Devices, Inc.',
    sources: [
      { type: 'official_website', name: 'AMD', url: 'https://www.amd.com' },
      { type: 'investor_relations', name: 'AMD Investor Relations', url: 'https://ir.amd.com' },
      { type: 'newsroom', name: 'AMD Newsroom', url: 'https://www.amd.com/en/newsroom' },
    ],
  },
  NFLX: {
    companyName: 'Netflix, Inc.',
    sources: [
      { type: 'official_website', name: 'Netflix', url: 'https://about.netflix.com' },
      { type: 'investor_relations', name: 'Netflix Investor Relations', url: 'https://ir.netflix.net' },
      { type: 'newsroom', name: 'Netflix Newsroom', url: 'https://about.netflix.com/en/newsroom' },
    ],
  },
  JPM: {
    companyName: 'JPMorgan Chase & Co.',
    sources: [
      { type: 'official_website', name: 'JPMorgan Chase', url: 'https://www.jpmorganchase.com' },
      { type: 'investor_relations', name: 'JPMorgan Chase Investor Relations', url: 'https://www.jpmorganchase.com/ir' },
      { type: 'newsroom', name: 'JPMorgan Chase News', url: 'https://www.jpmorganchase.com/news-stories' },
    ],
  },
  BAC: {
    companyName: 'Bank of America Corporation',
    sources: [
      { type: 'official_website', name: 'Bank of America', url: 'https://www.bankofamerica.com' },
      { type: 'investor_relations', name: 'Bank of America Investor Relations', url: 'https://investor.bankofamerica.com' },
      { type: 'newsroom', name: 'Bank of America Newsroom', url: 'https://newsroom.bankofamerica.com' },
    ],
  },
  XOM: {
    companyName: 'Exxon Mobil Corporation',
    sources: [
      { type: 'official_website', name: 'ExxonMobil', url: 'https://corporate.exxonmobil.com' },
      { type: 'investor_relations', name: 'ExxonMobil Investor Relations', url: 'https://investor.exxonmobil.com' },
      { type: 'newsroom', name: 'ExxonMobil News', url: 'https://corporate.exxonmobil.com/news' },
    ],
  },
  UNH: {
    companyName: 'UnitedHealth Group Incorporated',
    sources: [
      { type: 'official_website', name: 'UnitedHealth Group', url: 'https://www.unitedhealthgroup.com' },
      { type: 'investor_relations', name: 'UnitedHealth Group Investor Relations', url: 'https://www.unitedhealthgroup.com/investors.html' },
      { type: 'newsroom', name: 'UnitedHealth Group News', url: 'https://www.unitedhealthgroup.com/newsroom' },
    ],
  },
  WMT: {
    companyName: 'Walmart Inc.',
    sources: [
      { type: 'official_website', name: 'Walmart', url: 'https://www.walmart.com' },
      { type: 'investor_relations', name: 'Walmart Investor Relations', url: 'https://stock.walmart.com' },
      { type: 'newsroom', name: 'Walmart News', url: 'https://corporate.walmart.com/news' },
    ],
  },
  V: {
    companyName: 'Visa Inc.',
    sources: [
      { type: 'official_website', name: 'Visa', url: 'https://www.visa.com' },
      { type: 'investor_relations', name: 'Visa Investor Relations', url: 'https://investor.visa.com' },
      { type: 'newsroom', name: 'Visa News', url: 'https://usa.visa.com/about-visa/newsroom.html' },
    ],
  },
  MA: {
    companyName: 'Mastercard Incorporated',
    sources: [
      { type: 'official_website', name: 'Mastercard', url: 'https://www.mastercard.com' },
      { type: 'investor_relations', name: 'Mastercard Investor Relations', url: 'https://investor.mastercard.com' },
      { type: 'newsroom', name: 'Mastercard News', url: 'https://www.mastercard.com/newsroom.html' },
    ],
  },
  KO: {
    companyName: 'The Coca-Cola Company',
    sources: [
      { type: 'official_website', name: 'Coca-Cola', url: 'https://www.coca-colacompany.com' },
      { type: 'investor_relations', name: 'Coca-Cola Investor Relations', url: 'https://investors.coca-colacompany.com' },
    ],
  },
  PEP: {
    companyName: 'PepsiCo, Inc.',
    sources: [
      { type: 'official_website', name: 'PepsiCo', url: 'https://www.pepsico.com' },
      { type: 'investor_relations', name: 'PepsiCo Investor Relations', url: 'https://www.pepsico.com/investors' },
      { type: 'newsroom', name: 'PepsiCo News', url: 'https://www.pepsico.com/newsroom' },
    ],
  },
  DIS: {
    companyName: 'The Walt Disney Company',
    sources: [
      { type: 'official_website', name: 'Disney', url: 'https://www.thewaltdisneycompany.com' },
      { type: 'investor_relations', name: 'Disney Investor Relations', url: 'https://thewaltdisneycompany.com/investors' },
    ],
  },
  HD: {
    companyName: 'The Home Depot, Inc.',
    sources: [
      { type: 'official_website', name: 'Home Depot', url: 'https://www.homedepot.com' },
      { type: 'investor_relations', name: 'Home Depot Investor Relations', url: 'https://ir.homedepot.com' },
    ],
  },
  JNJ: {
    companyName: 'Johnson & Johnson',
    sources: [
      { type: 'official_website', name: 'Johnson & Johnson', url: 'https://www.jnj.com' },
      { type: 'investor_relations', name: 'Johnson & Johnson Investor Relations', url: 'https://www.investor.jnj.com' },
    ],
  },
  PFE: {
    companyName: 'Pfizer Inc.',
    sources: [
      { type: 'official_website', name: 'Pfizer', url: 'https://www.pfizer.com' },
      { type: 'investor_relations', name: 'Pfizer Investor Relations', url: 'https://investors.pfizer.com' },
      { type: 'newsroom', name: 'Pfizer News', url: 'https://www.pfizer.com/news' },
    ],
  },
  CVX: {
    companyName: 'Chevron Corporation',
    sources: [
      { type: 'official_website', name: 'Chevron', url: 'https://www.chevron.com' },
      { type: 'investor_relations', name: 'Chevron Investor Relations', url: 'https://www.chevron.com/investors' },
    ],
  },
  CRM: {
    companyName: 'Salesforce, Inc.',
    sources: [
      { type: 'official_website', name: 'Salesforce', url: 'https://www.salesforce.com' },
      { type: 'investor_relations', name: 'Salesforce Investor Relations', url: 'https://investor.salesforce.com' },
      { type: 'newsroom', name: 'Salesforce News', url: 'https://www.salesforce.com/news' },
    ],
  },
  ORCL: {
    companyName: 'Oracle Corporation',
    sources: [
      { type: 'official_website', name: 'Oracle', url: 'https://www.oracle.com' },
      { type: 'investor_relations', name: 'Oracle Investor Relations', url: 'https://investor.oracle.com' },
    ],
  },
  ADBE: {
    companyName: 'Adobe Inc.',
    sources: [
      { type: 'official_website', name: 'Adobe', url: 'https://www.adobe.com' },
      { type: 'investor_relations', name: 'Adobe Investor Relations', url: 'https://www.adobe.com/investor-relations.html' },
    ],
  },
  INTC: {
    companyName: 'Intel Corporation',
    sources: [
      { type: 'official_website', name: 'Intel', url: 'https://www.intel.com' },
      { type: 'investor_relations', name: 'Intel Investor Relations', url: 'https://www.intc.com' },
    ],
  },
  ABBV: {
    companyName: 'AbbVie Inc.',
    sources: [
      { type: 'official_website', name: 'AbbVie', url: 'https://www.abbvie.com' },
      { type: 'investor_relations', name: 'AbbVie Investor Relations', url: 'https://investors.abbvie.com' },
    ],
  },
  CSCO: {
    companyName: 'Cisco Systems, Inc.',
    sources: [
      { type: 'official_website', name: 'Cisco', url: 'https://www.cisco.com' },
      { type: 'investor_relations', name: 'Cisco Investor Relations', url: 'https://investor.cisco.com' },
    ],
  },
  QCOM: {
    companyName: 'QUALCOMM Incorporated',
    sources: [
      { type: 'official_website', name: 'Qualcomm', url: 'https://www.qualcomm.com' },
      { type: 'investor_relations', name: 'Qualcomm Investor Relations', url: 'https://investor.qualcomm.com' },
    ],
  },
  INTU: {
    companyName: 'Intuit Inc.',
    sources: [
      { type: 'official_website', name: 'Intuit', url: 'https://www.intuit.com' },
      { type: 'investor_relations', name: 'Intuit Investor Relations', url: 'https://investors.intuit.com' },
    ],
  },
  TMUS: {
    companyName: 'T-Mobile US, Inc.',
    sources: [
      { type: 'official_website', name: 'T-Mobile', url: 'https://www.t-mobile.com' },
      { type: 'investor_relations', name: 'T-Mobile Investor Relations', url: 'https://investor.t-mobile.com' },
    ],
  },
  VZ: {
    companyName: 'Verizon Communications Inc.',
    sources: [
      { type: 'official_website', name: 'Verizon', url: 'https://www.verizon.com' },
      { type: 'investor_relations', name: 'Verizon Investor Relations', url: 'https://www.verizon.com/about/investors' },
    ],
  },
  AXP: {
    companyName: 'American Express Company',
    sources: [
      { type: 'official_website', name: 'American Express', url: 'https://www.americanexpress.com' },
      { type: 'investor_relations', name: 'American Express Investor Relations', url: 'https://ir.americanexpress.com' },
    ],
  },
  GS: {
    companyName: 'The Goldman Sachs Group, Inc.',
    sources: [
      { type: 'official_website', name: 'Goldman Sachs', url: 'https://www.goldmansachs.com' },
      { type: 'investor_relations', name: 'Goldman Sachs Investor Relations', url: 'https://www.goldmansachs.com/investor-relations' },
    ],
  },
  MS: {
    companyName: 'Morgan Stanley',
    sources: [
      { type: 'official_website', name: 'Morgan Stanley', url: 'https://www.morganstanley.com' },
      { type: 'investor_relations', name: 'Morgan Stanley Investor Relations', url: 'https://www.morganstanley.com/about-us-ir' },
    ],
  },
  BLK: {
    companyName: 'BlackRock, Inc.',
    sources: [
      { type: 'official_website', name: 'BlackRock', url: 'https://www.blackrock.com' },
      { type: 'investor_relations', name: 'BlackRock Investor Relations', url: 'https://ir.blackrock.com' },
    ],
  },
  UBER: {
    companyName: 'Uber Technologies, Inc.',
    sources: [
      { type: 'official_website', name: 'Uber', url: 'https://www.uber.com' },
      { type: 'investor_relations', name: 'Uber Investor Relations', url: 'https://investor.uber.com' },
    ],
  },
  SPOT: {
    companyName: 'Spotify Technology S.A.',
    sources: [
      { type: 'official_website', name: 'Spotify', url: 'https://www.spotify.com' },
      { type: 'investor_relations', name: 'Spotify Investor Relations', url: 'https://investors.spotify.com' },
    ],
  },
  PLTR: {
    companyName: 'Palantir Technologies Inc.',
    sources: [
      { type: 'official_website', name: 'Palantir', url: 'https://www.palantir.com' },
      { type: 'investor_relations', name: 'Palantir Investor Relations', url: 'https://investors.palantir.com' },
    ],
  },
  COIN: {
    companyName: 'Coinbase Global, Inc.',
    sources: [
      { type: 'official_website', name: 'Coinbase', url: 'https://www.coinbase.com' },
      { type: 'investor_relations', name: 'Coinbase Investor Relations', url: 'https://investor.coinbase.com' },
    ],
  },
  SQ: {
    companyName: 'Block, Inc.',
    sources: [
      { type: 'official_website', name: 'Block', url: 'https://block.xyz' },
      { type: 'investor_relations', name: 'Block Investor Relations', url: 'https://investors.block.xyz' },
    ],
  },
  RBLX: {
    companyName: 'Roblox Corporation',
    sources: [
      { type: 'official_website', name: 'Roblox', url: 'https://www.roblox.com' },
      { type: 'investor_relations', name: 'Roblox Investor Relations', url: 'https://ir.roblox.com' },
    ],
  },
  SNOW: {
    companyName: 'Snowflake Inc.',
    sources: [
      { type: 'official_website', name: 'Snowflake', url: 'https://www.snowflake.com' },
      { type: 'investor_relations', name: 'Snowflake Investor Relations', url: 'https://investors.snowflake.com' },
    ],
  },
  DASH: {
    companyName: 'DoorDash, Inc.',
    sources: [
      { type: 'official_website', name: 'DoorDash', url: 'https://www.doordash.com' },
      { type: 'investor_relations', name: 'DoorDash Investor Relations', url: 'https://ir.doordash.com' },
    ],
  },
  CMG: {
    companyName: 'Chipotle Mexican Grill, Inc.',
    sources: [
      { type: 'official_website', name: 'Chipotle', url: 'https://www.chipotle.com' },
      { type: 'investor_relations', name: 'Chipotle Investor Relations', url: 'https://ir.chipotle.com' },
    ],
  },
  SBUX: {
    companyName: 'Starbucks Corporation',
    sources: [
      { type: 'official_website', name: 'Starbucks', url: 'https://www.starbucks.com' },
      { type: 'investor_relations', name: 'Starbucks Investor Relations', url: 'https://investor.starbucks.com' },
    ],
  },
  NKE: {
    companyName: 'NIKE, Inc.',
    sources: [
      { type: 'official_website', name: 'Nike', url: 'https://www.nike.com' },
      { type: 'investor_relations', name: 'Nike Investor Relations', url: 'https://investors.nike.com' },
    ],
  },
  COST: {
    companyName: 'Costco Wholesale Corporation',
    sources: [
      { type: 'official_website', name: 'Costco', url: 'https://www.costco.com' },
      { type: 'investor_relations', name: 'Costco Investor Relations', url: 'https://investor.costco.com' },
    ],
  },
  TGT: {
    companyName: 'Target Corporation',
    sources: [
      { type: 'official_website', name: 'Target', url: 'https://www.target.com' },
      { type: 'investor_relations', name: 'Target Investor Relations', url: 'https://corporate.target.com/investor-relations' },
    ],
  },
  WFC: {
    companyName: 'Wells Fargo & Company',
    sources: [
      { type: 'official_website', name: 'Wells Fargo', url: 'https://www.wellsfargo.com' },
      { type: 'investor_relations', name: 'Wells Fargo Investor Relations', url: 'https://www.wellsfargo.com/about/investor-relations' },
    ],
  },
  C: {
    companyName: 'Citigroup Inc.',
    sources: [
      { type: 'official_website', name: 'Citigroup', url: 'https://www.citigroup.com' },
      { type: 'investor_relations', name: 'Citigroup Investor Relations', url: 'https://www.citigroup.com/global/investors' },
    ],
  },
  GE: {
    companyName: 'General Electric Company',
    sources: [
      { type: 'official_website', name: 'GE', url: 'https://www.ge.com' },
      { type: 'investor_relations', name: 'GE Investor Relations', url: 'https://www.ge.com/investor-relations' },
    ],
  },
  IBM: {
    companyName: 'International Business Machines Corporation',
    sources: [
      { type: 'official_website', name: 'IBM', url: 'https://www.ibm.com' },
      { type: 'investor_relations', name: 'IBM Investor Relations', url: 'https://www.ibm.com/investor' },
    ],
  },
  BA: {
    companyName: 'The Boeing Company',
    sources: [
      { type: 'official_website', name: 'Boeing', url: 'https://www.boeing.com' },
      { type: 'investor_relations', name: 'Boeing Investor Relations', url: 'https://investors.boeing.com' },
    ],
  },
  CAT: {
    companyName: 'Caterpillar Inc.',
    sources: [
      { type: 'official_website', name: 'Caterpillar', url: 'https://www.caterpillar.com' },
      { type: 'investor_relations', name: 'Caterpillar Investor Relations', url: 'https://investors.caterpillar.com' },
    ],
  },
  LMT: {
    companyName: 'Lockheed Martin Corporation',
    sources: [
      { type: 'official_website', name: 'Lockheed Martin', url: 'https://www.lockheedmartin.com' },
      { type: 'investor_relations', name: 'Lockheed Martin Investor Relations', url: 'https://investors.lockheedmartin.com' },
    ],
  },
  MMM: {
    companyName: '3M Company',
    sources: [
      { type: 'official_website', name: '3M', url: 'https://www.3m.com' },
      { type: 'investor_relations', name: '3M Investor Relations', url: 'https://investors.3m.com' },
    ],
  },
  DE: {
    companyName: 'Deere & Company',
    sources: [
      { type: 'official_website', name: 'John Deere', url: 'https://www.deere.com' },
      { type: 'investor_relations', name: 'John Deere Investor Relations', url: 'https://investor.deere.com' },
    ],
  },
  PYPL: {
    companyName: 'PayPal Holdings, Inc.',
    sources: [
      { type: 'official_website', name: 'PayPal', url: 'https://www.paypal.com' },
      { type: 'investor_relations', name: 'PayPal Investor Relations', url: 'https://investor.pypl.com' },
    ],
  },
  MAR: {
    companyName: 'Marriott International, Inc.',
    sources: [
      { type: 'official_website', name: 'Marriott', url: 'https://www.marriott.com' },
      { type: 'investor_relations', name: 'Marriott Investor Relations', url: 'https://www.marriott.com/investor' },
    ],
  },
  MCD: {
    companyName: "McDonald's Corporation",
    sources: [
      { type: 'official_website', name: "McDonald's", url: 'https://www.mcdonalds.com' },
      { type: 'investor_relations', name: "McDonald's Investor Relations", url: 'https://corporate.mcdonalds.com/corpmcd/investors.html' },
    ],
  },
  PG: {
    companyName: 'The Procter & Gamble Company',
    sources: [
      { type: 'official_website', name: 'P&G', url: 'https://us.pg.com' },
      { type: 'investor_relations', name: 'P&G Investor Relations', url: 'https://www.pginvestor.com' },
    ],
  },
  TSM: {
    companyName: 'Taiwan Semiconductor Manufacturing Company Limited',
    sources: [
      { type: 'official_website', name: 'TSMC', url: 'https://www.tsmc.com' },
      { type: 'investor_relations', name: 'TSMC Investor Relations', url: 'https://investor.tsmc.com' },
    ],
  },
  BABA: {
    companyName: 'Alibaba Group Holding Limited',
    sources: [
      { type: 'official_website', name: 'Alibaba Group', url: 'https://www.alibabagroup.com' },
      { type: 'investor_relations', name: 'Alibaba Investor Relations', url: 'https://www.alibabagroup.com/en/ir' },
    ],
  },
  SHOP: {
    companyName: 'Shopify Inc.',
    sources: [
      { type: 'official_website', name: 'Shopify', url: 'https://www.shopify.com' },
      { type: 'investor_relations', name: 'Shopify Investor Relations', url: 'https://investors.shopify.com' },
    ],
  },
  ABNB: {
    companyName: 'Airbnb, Inc.',
    sources: [
      { type: 'official_website', name: 'Airbnb', url: 'https://www.airbnb.com' },
      { type: 'investor_relations', name: 'Airbnb Investor Relations', url: 'https://investors.airbnb.com' },
    ],
  },
  HOOD: {
    companyName: 'Robinhood Markets, Inc.',
    sources: [
      { type: 'official_website', name: 'Robinhood', url: 'https://www.robinhood.com' },
      { type: 'investor_relations', name: 'Robinhood Investor Relations', url: 'https://investors.robinhood.com' },
    ],
  },
  SNAP: {
    companyName: 'Snap Inc.',
    sources: [
      { type: 'official_website', name: 'Snap Inc.', url: 'https://www.snap.com' },
      { type: 'investor_relations', name: 'Snap Investor Relations', url: 'https://investor.snap.com' },
    ],
  },
  PINS: {
    companyName: 'Pinterest, Inc.',
    sources: [
      { type: 'official_website', name: 'Pinterest', url: 'https://www.pinterest.com' },
      { type: 'investor_relations', name: 'Pinterest Investor Relations', url: 'https://investors.pinterestinc.com' },
    ],
  },
  SOFI: {
    companyName: 'SoFi Technologies, Inc.',
    sources: [
      { type: 'official_website', name: 'SoFi', url: 'https://www.sofi.com' },
      { type: 'investor_relations', name: 'SoFi Investor Relations', url: 'https://investors.sofi.com' },
    ],
  },
  MRNA: {
    companyName: 'Moderna, Inc.',
    sources: [
      { type: 'official_website', name: 'Moderna', url: 'https://www.modernatx.com' },
      { type: 'investor_relations', name: 'Moderna Investor Relations', url: 'https://investors.modernatx.com' },
    ],
  },
  CVNA: {
    companyName: 'Carvana Co.',
    sources: [
      { type: 'official_website', name: 'Carvana', url: 'https://www.carvana.com' },
      { type: 'investor_relations', name: 'Carvana Investor Relations', url: 'https://investors.carvana.com' },
    ],
  },
  ZM: {
    companyName: 'Zoom Video Communications, Inc.',
    sources: [
      { type: 'official_website', name: 'Zoom', url: 'https://www.zoom.com' },
      { type: 'investor_relations', name: 'Zoom Investor Relations', url: 'https://investors.zoom.us' },
    ],
  },
  MSTR: {
    companyName: 'MicroStrategy Incorporated',
    sources: [
      { type: 'official_website', name: 'MicroStrategy', url: 'https://www.microstrategy.com' },
      { type: 'investor_relations', name: 'MicroStrategy Investor Relations', url: 'https://ir.microstrategy.com' },
    ],
  },
  DKNG: {
    companyName: 'DraftKings Inc.',
    sources: [
      { type: 'official_website', name: 'DraftKings', url: 'https://www.draftkings.com' },
      { type: 'investor_relations', name: 'DraftKings Investor Relations', url: 'https://ir.draftkings.com' },
    ],
  },
  TWLO: {
    companyName: 'Twilio Inc.',
    sources: [
      { type: 'official_website', name: 'Twilio', url: 'https://www.twilio.com' },
      { type: 'investor_relations', name: 'Twilio Investor Relations', url: 'https://investors.twilio.com' },
    ],
  },
  ROKU: {
    companyName: 'Roku, Inc.',
    sources: [
      { type: 'official_website', name: 'Roku', url: 'https://www.roku.com' },
      { type: 'investor_relations', name: 'Roku Investor Relations', url: 'https://ir.roku.com' },
    ],
  },
  GME: {
    companyName: 'GameStop Corp.',
    sources: [
      { type: 'official_website', name: 'GameStop', url: 'https://www.gamestop.com' },
      { type: 'investor_relations', name: 'GameStop Investor Relations', url: 'https://investor.gamestop.com' },
    ],
  },
  AMC: {
    companyName: 'AMC Entertainment Holdings, Inc.',
    sources: [
      { type: 'official_website', name: 'AMC', url: 'https://www.amctheatres.com' },
      { type: 'investor_relations', name: 'AMC Investor Relations', url: 'https://investor.amctheatres.com' },
    ],
  },
  LCID: {
    companyName: 'Lucid Group, Inc.',
    sources: [
      { type: 'official_website', name: 'Lucid Motors', url: 'https://www.lucidmotors.com' },
      { type: 'investor_relations', name: 'Lucid Investor Relations', url: 'https://ir.lucidmotors.com' },
    ],
  },
  RIVN: {
    companyName: 'Rivian Automotive, Inc.',
    sources: [
      { type: 'official_website', name: 'Rivian', url: 'https://www.rivian.com' },
      { type: 'investor_relations', name: 'Rivian Investor Relations', url: 'https://rivian.com/investors' },
    ],
  },
  NIO: {
    companyName: 'NIO Inc.',
    sources: [
      { type: 'official_website', name: 'NIO', url: 'https://www.nio.com' },
      { type: 'investor_relations', name: 'NIO Investor Relations', url: 'https://ir.nio.com' },
    ],
  },
  PDD: {
    companyName: 'PDD Holdings Inc.',
    sources: [
      { type: 'official_website', name: 'Pinduoduo', url: 'https://www.pddholdings.com' },
      { type: 'investor_relations', name: 'PDD Investor Relations', url: 'https://investor.pddholdings.com' },
    ],
  },
  ENPH: {
    companyName: 'Enphase Energy, Inc.',
    sources: [
      { type: 'official_website', name: 'Enphase Energy', url: 'https://www.enphase.com' },
      { type: 'investor_relations', name: 'Enphase Energy Investor Relations', url: 'https://investor.enphase.com' },
    ],
  },
  DAL: {
    companyName: 'Delta Air Lines, Inc.',
    sources: [
      { type: 'official_website', name: 'Delta', url: 'https://www.delta.com' },
      { type: 'investor_relations', name: 'Delta Investor Relations', url: 'https://ir.delta.com' },
    ],
  },
  T: {
    companyName: 'AT&T Inc.',
    sources: [
      { type: 'official_website', name: 'AT&T', url: 'https://www.att.com' },
      { type: 'investor_relations', name: 'AT&T Investor Relations', url: 'https://investors.att.com' },
    ],
  },
  XPEV: {
    companyName: 'XPeng Inc.',
    sources: [
      { type: 'official_website', name: 'XPeng', url: 'https://www.xiaopeng.com' },
      { type: 'investor_relations', name: 'XPeng Investor Relations', url: 'https://ir.xiaopeng.com' },
    ],
  },
  DELL: {
    companyName: 'Dell Technologies Inc.',
    sources: [
      { type: 'official_website', name: 'Dell', url: 'https://www.dell.com' },
      { type: 'investor_relations', name: 'Dell Investor Relations', url: 'https://investors.delltechnologies.com' },
    ],
  },
  LI: {
    companyName: 'Li Auto Inc.',
    sources: [
      { type: 'official_website', name: 'Li Auto', url: 'https://www.lixiang.com' },
      { type: 'investor_relations', name: 'Li Auto Investor Relations', url: 'https://ir.lixiang.com' },
    ],
  },
};

const getDomain = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
};

const classifyTier = (type) => {
  if (type === 'sec') return 'official';
  if (['investor_relations', 'press_release', 'newsroom', 'official_website', 'exchange'].includes(type)) return 'official_channel';
  if (type === 'major_media') return 'major_media';
  if (type === 'aggregator') return 'aggregator';
  return 'unknown';
};

const scoreSource = (source) => {
  const tier = classifyTier(source.type);
  const base = {
    official: 88,
    official_channel: 78,
    major_media: 58,
    aggregator: 38,
    unknown: 25,
  }[tier];

  let score = base;
  if (source.type === 'investor_relations') score += 8;
  if (source.type === 'sec') score += 7;
  if (source.type === 'official_website') score += 4;
  if (source.domain && !source.domain.includes('google.com/search')) score += 3;

  return Math.max(0, Math.min(100, score));
};

const makeSource = (ticker, companyName, source, notes = []) => {
  const domain = getDomain(source.url);
  const sourceTier = classifyTier(source.type);

  return {
    ticker,
    companyName,
    type: source.type,
    name: source.name,
    url: source.url,
    domain,
    sourceTier,
    authorityScore: scoreSource({ ...source, domain }),
    warnings: [],
    notes,
  };
};

const dedupeSources = (sources) => {
  const seen = new Set();
  return sources.filter((source) => {
    const key = source.url.replace(/\/$/, '').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const fetchFundamentalsWebsite = async (ticker) => {
  const polygonKey = getPolygonCompatibleKey();
  if (!polygonKey) return null;

  try {
    const baseUrl = getPolygonCompatibleBaseUrl();
    const provider = getPolygonCompatibleProviderName();
    const url = new URL(`/v3/reference/tickers/${ticker}`, baseUrl);
    url.searchParams.set('apiKey', polygonKey);
    const { data } = await cachedMarketDataGet({
      cacheKey: `${provider}:fundamentals:${ticker}`,
      ttlMs: 12 * 60 * 60 * 1000,
      url: url.toString(),
      timeout: 5000,
    });
    const result = data?.results;
    if (!result?.homepage_url) return null;

    return {
      companyName: result.name,
      website: result.homepage_url,
    };
  } catch (error) {
    console.warn(`[OfficialSources] Fundamentals website lookup skipped for ${ticker}: ${error.message}`);
    return null;
  }
};

const buildSecSource = async (ticker, companyName) => {
  try {
    const cik = await findCikByTicker(ticker);
    if (!cik) return null;

    return makeSource(
      ticker,
      companyName,
      {
        type: 'sec',
        name: 'SEC EDGAR Company Filings',
        url: `https://www.sec.gov/edgar/browse/?CIK=${encodeURIComponent(cik)}&owner=exclude`,
      },
      ['CIK was resolved from SEC company ticker data.']
    );
  } catch (error) {
    console.warn(`[OfficialSources] SEC source lookup skipped for ${ticker}: ${error.message}`);
    return null;
  }
};

const generateIrCandidateUrls = (ticker, companyName, websiteUrl) => {
  const candidates = [];
  const websiteDomain = websiteUrl ? getDomain(websiteUrl) : null;

  // Common IR URL patterns
  const patterns = [];
  if (websiteDomain) {
    patterns.push(
      { url: `https://investor.${websiteDomain}`, pattern: 'investor.{domain}' },
      { url: `https://ir.${websiteDomain}`, pattern: 'ir.{domain}' },
      { url: `https://${websiteDomain}/investors`, pattern: '{domain}/investors' },
      { url: `https://${websiteDomain}/investor-relations`, pattern: '{domain}/investor-relations' },
      { url: `https://${websiteDomain}/ir`, pattern: '{domain}/ir' },
    );
  }

  // Without site knowledge, fall back to ticker-based guesses
  if (!websiteDomain) {
    const tickerLower = ticker.toLowerCase();
    patterns.push(
      { url: `https://investor.${tickerLower}.com`, pattern: 'investor.{ticker}.com' },
      { url: `https://ir.${tickerLower}.com`, pattern: 'ir.{ticker}.com' },
      { url: `https://${tickerLower}.com/investors`, pattern: '{ticker}.com/investors' },
    );
  }

  for (const pat of patterns) {
    try {
      new URL(pat.url);
    } catch {
      continue;
    }
    candidates.push(
      makeSource(
        ticker,
        companyName,
        { type: 'investor_relations', name: `${companyName || ticker} Investor Relations (Candidate)`, url: pat.url },
        [`Auto-generated — requires manual confirmation (pattern: ${pat.pattern})`]
      )
    );
  }

  return candidates;
};

const applyDeepSeekReviews = async (sources) => {
  if (!isDeepSeekConfigured() || sources.length === 0) return sources;

  return Promise.all(
    sources.map(async (source) => {
      const review = await reviewOfficialSourceAuthority(source);
      if (!review) return source;

      return {
        ...source,
        aiReviewed: true,
        aiAssessment: review.assessment,
        aiConfidence: review.confidence,
        aiReasoning: review.reasoning,
        warnings: [...(source.warnings || []), ...review.warnings],
      };
    })
  );
};

export const getOfficialSourcesForTicker = async (tickerInput) => {
  const ticker = normalizeTicker(tickerInput);
  const mode = isDeepSeekConfigured() ? 'rule_plus_ai' : 'rule_only';
  const cached = officialSourceCache.get(`${ticker}:${mode}`);

  if (cached && Date.now() - cached.cachedAt < OFFICIAL_SOURCE_CACHE_MS) {
    return cached.value;
  }

  try {
    if (!ticker) {
      return {
        ticker,
        generatedAt: new Date().toISOString(),
        status: 'unsupported',
        sources: [],
        notes: ['Ticker is required.'],
        mode,
      };
    }

    const registryEntry = REGISTRY[ticker];
    const fundamentals = await fetchFundamentalsWebsite(ticker);
    const companyName = registryEntry?.companyName || fundamentals?.companyName || ticker;
    const registrySources = (registryEntry?.sources || []).map((source) =>
      makeSource(ticker, companyName, source, ['Loaded from the built-in official source registry.'])
    );
    const secSource = await buildSecSource(ticker, companyName);
    const websiteSource =
      fundamentals?.website
        ? makeSource(
            ticker,
            companyName,
            { type: 'official_website', name: `${companyName || ticker} Website`, url: fundamentals.website },
            ['Loaded from Polygon company profile metadata.']
          )
        : null;

    const hasRegistry = registrySources.length > 0;
    const ruleSources = dedupeSources([...registrySources, secSource, websiteSource].filter(Boolean));

    // Dynamic IR URL generation for non-registry tickers with few sources
    let irCandidates = [];
    if (!hasRegistry && ruleSources.length <= 2) {
      irCandidates = generateIrCandidateUrls(ticker, companyName, fundamentals?.website || null);
      if (irCandidates.length > 0) {
        console.log(`[OfficialSources] Generated ${irCandidates.length} IR URL candidates for ${ticker} (auto-generated, needs manual confirmation)`);
      }
    }
    const allRuleSources = dedupeSources([...ruleSources, ...irCandidates]);

    const sources = await applyDeepSeekReviews(allRuleSources);
    const status = sources.length === 0 ? 'not_found' : hasRegistry || sources.some((source) => source.type === 'sec') ? 'available' : 'partial';
    const notes = [];
    if (sources.length > 0) {
      notes.push('Official source candidates are derived from registry, SEC, and company metadata signals.');
    } else {
      notes.push('No official source candidates were found. No URLs were generated.');
    }
    if (irCandidates.length > 0) {
      notes.push(`${irCandidates.length} investor relations URL(s) were auto-generated as candidates and require manual confirmation.`);
    }

    const value = {
      ticker,
      companyName,
      generatedAt: new Date().toISOString(),
      status,
      sources,
      notes,
      mode,
    };

    officialSourceCache.set(`${ticker}:${mode}`, { cachedAt: Date.now(), value });
    return value;
  } catch (error) {
    console.warn(`[OfficialSources] Failed to resolve official sources for ${ticker}: ${error.message}`);
    return {
      ticker,
      generatedAt: new Date().toISOString(),
      status: 'error',
      sources: [],
      notes: ['Official source discovery is currently unavailable.'],
      mode,
    };
  }
};
