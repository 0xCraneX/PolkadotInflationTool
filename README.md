# Polkadot Inflation Tool

A comprehensive dashboard for analyzing Polkadot network economics, treasury spending, and inflation metrics.

## Features

- **DOT Price & Governance Spending**: Historical price data with governance spending overlay
- **Total Issuance Growth**: Track DOT supply growth over time
- **Validator & Nominator Rewards**: Monthly reward distributions in USD
- **Governance Spending Analysis**: DOT vs Stablecoin spending breakdown
- **Monthly Distribution Charts**: Both absolute and normalized (100%) views
- **Treasury Revenue Metrics**: Additional revenue sources for the treasury

## Data Overview

- **Time Period**: August 19, 2020 - July 30, 2025
- **Total DOT Supply**: 1.59B
- **Total Governance Spent**: 32.0M DOT + 46.1M USDC/T
- **USD Value of DOT Spent**: $205.3M
- **Total Inflation Distributed**: $6.6B

## Setup

1. Clone this repository
2. Open `polkadot_dashboard.html` in a web browser
3. Ensure `dot_usd_max.csv` is in the same directory

## Local Development

To run locally with a web server:

```bash
python -m http.server 8000
```

Then navigate to http://localhost:8000/polkadot_dashboard.html

## Data Sources

- Treasury spend data: Polkadot Subscan API
- Price data: Historical tracking from August 2020
- Issuance data: Subscan token statistics

## Treasury Revenue Sources

- **Hydration 1M DOT Lending**: 19,100 DOT earned
- **Bifrost Lend**: 35,000 DOT earned
- **aDOT Money Market**: 170,000 DOT (annualized)
- **Network Fees**: 778,840 DOT collected

## License

MIT