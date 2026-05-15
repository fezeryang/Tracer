import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ChartBlock from '../ChartBlock';

const points = [
  { label: '2026-01-01', value: 100 },
  { label: '2026-01-02', value: 104, secondary: 99 },
];

const renderChart = (props: React.ComponentProps<typeof ChartBlock>) => (
  renderToString(React.createElement(ChartBlock, props))
);

describe('ChartBlock', () => {
  it.each(['line', 'bar', 'area', 'pie'] as const)('renders %s chart data without crashing', (type) => {
    const html = renderChart({
      language: 'en',
      title: 'AAPL Price Trend',
      data: points,
      type,
      source: 'Market Data',
      dataQuality: 'available',
      xAxisLabel: 'Date',
      yAxisLabel: 'Price',
    });

    expect(html).toContain('AAPL Price Trend');
    expect(html).toContain('Market Data');
    expect(html).toContain('Available');
  });

  it('renders empty state for invalid data without raw JSON', () => {
    const html = renderChart({
      language: 'en',
      title: 'Invalid Chart',
      data: [{ label: 'bad', value: Number.NaN }],
      type: 'line',
      source: 'Market Data',
    });

    expect(html).toContain('Invalid Chart');
    expect(html).toContain('No reusable chart data is available.');
    expect(html).not.toContain('"value"');
  });

  it('keeps source and dataQuality optional for backward compatibility', () => {
    const html = renderChart({
      language: 'en',
      title: 'Legacy Chart',
      data: points,
      type: 'line',
    });

    expect(html).toContain('Legacy Chart');
    expect(html).toContain('Charts are for educational research only');
  });
});
