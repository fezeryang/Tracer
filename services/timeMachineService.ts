
import { MarketEvent } from '../types';

export const EVENTS: MarketEvent[] = [
  {
    id: 'covid-crash',
    title: 'The COVID Crash',
    ticker: 'SPY',
    description: 'March 2020. The fastest 30% drop in history. Volatility exploded to levels never seen since 2008.',
    frames: [
       { date: '2020-02-19', price: 338, volatility: 14, news: "S&P 500 hits all-time high.", commentary: "Markets are euphoric. VIX is low (14). Calls are cheap. 'Stonks only go up' is the vibe." },
       { date: '2020-02-24', price: 322, volatility: 25, news: "Cases surge in Italy.", commentary: "First shock. S&P drops 5%. Volatility spikes to 25. Puts start printing massive returns." },
       { date: '2020-02-27', price: 297, volatility: 39, news: "Correction territory entered.", commentary: "Panic sets in. We broke below $300. IV Crush hurts long positions if not deep ITM." },
       { date: '2020-03-09', price: 274, volatility: 54, news: "Oil prices collapse. Circuit breakers hit.", commentary: "Black Monday. Absolute capitulation. Short Puts are wiped out. Cash is king." },
       { date: '2020-03-12', price: 248, volatility: 75, news: "Fed injects $1.5T liquidity.", commentary: "The bottom falls out. VIX hits 75. Options premiums are insane. 10% daily moves are normal." },
       { date: '2020-03-16', price: 239, volatility: 82, news: "Total lockdowns announced.", commentary: "Peak fear. Selling volatility (Iron Condors) is dangerous but profitable if you survive the swings." },
       { date: '2020-03-23', price: 223, volatility: 61, news: "Fed announces unlimited QE.", commentary: "The bottom. 'Don't fight the Fed' era begins. Long Calls from here make fortunes." },
       { date: '2020-03-26', price: 263, volatility: 61, news: "Jobless claims hit record 3M.", commentary: "Market ignores bad news. The V-shape recovery starts. Bears get trapped." },
    ]
  },
  {
    id: 'gme-squeeze',
    title: 'The Meme Stock Revolution',
    ticker: 'GME',
    description: 'Jan 2021. Retail vs Wall Street. The biggest short squeeze in decades.',
    frames: [
       { date: '2021-01-11', price: 19, volatility: 80, news: "Ryan Cohen joins board.", commentary: "The catalyst. WSB starts buying OTM calls. Price is $19." },
       { date: '2021-01-13', price: 31, volatility: 110, news: "Volume explodes.", commentary: "Gamma squeeze initiates. Market makers forced to hedge. IV hits 110%." },
       { date: '2021-01-22', price: 65, volatility: 250, news: "Short sellers trapped.", commentary: "Parabolic move to $65. IV is 250%. Option prices are detached from reality." },
       { date: '2021-01-26', price: 147, volatility: 400, news: "Elon Musk tweets 'Gamestonk'.", commentary: "Hyper-volatility. GME hits $147. You can sell a Put for 50% ROI in a day due to insane premiums." },
       { date: '2021-01-27', price: 347, volatility: 600, news: "Melvin Capital closes shorts.", commentary: "Peak mania. $347. Brokers struggling to clear trades. VIX on GME is 600%." },
       { date: '2021-01-28', price: 193, volatility: 550, news: "Buy button turned off.", commentary: "The crash. Liquidity vanishes. Long Calls decimated instantly. Price halves." },
    ]
  },
  {
    id: 'nvda-boom',
    title: 'The AI Boom',
    ticker: 'NVDA',
    description: '2023-2024. The rise of Generative AI fuels a trillion-dollar run.',
    frames: [
       { date: '2022-10-14', price: 112, volatility: 45, news: "Crypto winter hits GPU demand.", commentary: "NVDA bottoms at $112. Sentiment is awful. P/E looks high." },
       { date: '2023-01-30', price: 195, volatility: 35, news: "ChatGPT launches.", commentary: "The spark. AI narrative begins. Tech stocks rally." },
       { date: '2023-05-24', price: 305, volatility: 50, news: "Earnings Guidance shocker.", commentary: "The gap up. NVDA forecasts massive demand. Stock jumps 25% overnight." },
       { date: '2023-05-25', price: 379, volatility: 40, news: "Market Cap hits $1 Trillion.", commentary: "Momentum unleashed. Short sellers are crushed. Calls paying 10x." },
       { date: '2024-02-21', price: 674, volatility: 38, news: "Earnings beat expectations again.", commentary: "Unstoppable. Any dip is bought instantly. Covered Calls print free money." },
       { date: '2024-03-08', price: 875, volatility: 42, news: "GTC Conference hype.", commentary: "Peak euphoria. Retail piling in. Time for protective puts?" },
    ]
  }
];

export const getMarketEvents = () => EVENTS;
