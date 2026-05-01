
import { AlpacaAccount, AlpacaOrder } from '../types';

export const fetchAlpacaAccount = async (): Promise<AlpacaAccount> => {
    const response = await fetch('/api/trading/account');
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch account');
    }
    return response.json();
};

export const fetchAlpacaClock = async (): Promise<{ is_open: boolean, timestamp: string, next_open: string, next_close: string }> => {
    const response = await fetch('/api/trading/clock');
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch clock');
    }
    return response.json();
};

export const placeAlpacaOrder = async (order: {
    symbol: string;
    qty: number;
    side: 'buy' | 'sell';
    type: 'market' | 'limit';
    time_in_force: 'day' | 'gtc';
    extended_hours?: boolean;
}): Promise<AlpacaOrder> => {
    const response = await fetch('/api/trading/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to place order');
    }
    return response.json();
};

export const fetchAlpacaPositions = async (): Promise<any[]> => {
    const response = await fetch('/api/trading/positions');
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch positions');
    }
    return response.json();
};
