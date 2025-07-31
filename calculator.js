// Constants
const INITIAL_ISSUANCE = 120000000; // 120M DOT
const INITIAL_SUPPLY = 1450000000; // 1.45B DOT (start of 2025)
const START_YEAR = 2025;
const END_YEAR = 2052;
const TREASURY_PERCENT = 0.15;
const STAKER_PERCENT = 0.85;
const INITIAL_USD_VALUE = 480000000; // $480M
const TARGET_USD_EXPENSES = 90000000; // $90M

// State
let chartInstance = null;
let currentData = [];
let currentModel = 'fixed';

// Utility functions
function formatNumber(num, decimals = 0) {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(num);
}

// Format number input for billions (e.g., 3.14 for 3.14B)
function formatNumberInput(value) {
    // Remove all non-numeric characters except decimal point
    const cleanValue = value.toString().replace(/[^0-9.]/g, '');
    
    // Don't format if empty
    if (!cleanValue) return '';
    
    // Ensure only one decimal point
    const parts = cleanValue.split('.');
    if (parts.length > 2) {
        return parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Limit decimal places to 3
    if (parts.length === 2 && parts[1].length > 3) {
        parts[1] = parts[1].substring(0, 3);
    }
    
    return parts.join('.');
}

// Parse billions format to actual DOT value
function parseBillionsToValue(value) {
    // Parse the decimal billions to actual value
    const billions = parseFloat(value) || 0;
    return billions * 1000000000; // Convert billions to actual DOT
}

// Convert actual value to billions format
function formatValueToBillions(value) {
    return (value / 1000000000).toFixed(3).replace(/\.?0+$/, '');
}

function formatDOT(num) {
    return formatNumber(num) + ' DOT';
}

function formatUSD(num) {
    return '$' + formatNumber(num);
}

function formatUSDCompact(num) {
    if (num >= 1e12) {
        return '$' + (num / 1e12).toFixed(2) + 'T';
    } else if (num >= 1e9) {
        return '$' + (num / 1e9).toFixed(2) + 'B';
    } else if (num >= 1e6) {
        return '$' + (num / 1e6).toFixed(2) + 'M';
    }
    return formatUSD(num);
}

// Model 1: Fixed Step Reduction
function calculateModel1(reductionStep, inflationPeriod) {
    const data = [];
    let currentIssuance = INITIAL_ISSUANCE;
    let totalSupply = INITIAL_SUPPLY;
    let totalSupplyFixed = INITIAL_SUPPLY; // For fixed inflation comparison
    let yearsSinceStart = 0;
    
    for (let year = START_YEAR; year <= END_YEAR; year++) {
        // First reduction happens in 2026 (first day of 2026)
        if (yearsSinceStart === 1) {
            // First reduction in 2026
            currentIssuance = currentIssuance * (1 - reductionStep / 100);
        } else if (yearsSinceStart > 1) {
            // Check if it's time for subsequent reductions based on inflation period
            const yearsSinceFirstReduction = yearsSinceStart - 1;
            if (yearsSinceFirstReduction > 0 && yearsSinceFirstReduction % inflationPeriod === 0) {
                currentIssuance = currentIssuance * (1 - reductionStep / 100);
            }
        }
        
        // Calculate inflation rate BEFORE adding new issuance
        const inflationRate = (currentIssuance / totalSupply) * 100;
        
        // Calculate yearly values
        const treasuryIncome = currentIssuance * TREASURY_PERCENT;
        const stakersIncome = currentIssuance * STAKER_PERCENT;
        
        // Calculate staking rewards rate using START of year supply
        // Staking Rate = (Yearly Issuance × 0.85) / (Total Supply × 0.5)
        const stakingRate = (currentIssuance * STAKER_PERCENT) / (totalSupply * 0.5) * 100;
        
        // Store data with supply at START of year
        data.push({
            year,
            yearlyIssuance: currentIssuance,
            totalSupply,  // This is the supply at START of year
            totalSupplyFixed,  // This is the fixed supply at START of year
            yearlyTreasuryIncome: treasuryIncome,
            yearlyStakersIncome: stakersIncome,
            mcToSustain: totalSupply * (INITIAL_USD_VALUE / currentIssuance),
            mcTo90M: totalSupply * (TARGET_USD_EXPENSES / currentIssuance),
            inflationRate,
            stakingRate,
            step: reductionStep,
            inflationPeriod
        });
        
        // Add issuance to supply AFTER storing the data
        totalSupply += currentIssuance;
        totalSupplyFixed += INITIAL_ISSUANCE;
        
        yearsSinceStart++;
    }
    
    return data;
}

// Model 2: Target Supply Model
function calculateModel2(targetMaxSupply, reductionRate, period) {
    const data = [];
    let totalSupply = INITIAL_SUPPLY;
    let totalSupplyFixed = INITIAL_SUPPLY;
    let yearsSincePeriod = 0;
    let currentYearlyIssuance = INITIAL_ISSUANCE;
    
    // targetMaxSupply is already in DOT units (not millions)
    const targetSupply = targetMaxSupply;
    
    for (let year = START_YEAR; year <= END_YEAR; year++) {
        // For 2025, use full 120M issuance
        if (year === START_YEAR) {
            currentYearlyIssuance = INITIAL_ISSUANCE;
        } else {
            // Recalculate issuance at the start of each period (starting from 2026)
            if (yearsSincePeriod === 0) {
                const remainingInflation = targetSupply - totalSupply;
                const periodIssuance = remainingInflation * (reductionRate / 100);
                currentYearlyIssuance = periodIssuance / period;
            }
        }
        
        // Ensure we don't exceed target supply
        if (totalSupply + currentYearlyIssuance > targetSupply) {
            currentYearlyIssuance = Math.max(0, targetSupply - totalSupply);
        }
        
        // Calculate inflation rate BEFORE adding new issuance
        const inflationRate = (currentYearlyIssuance / totalSupply) * 100;
        
        // Calculate yearly values
        const treasuryIncome = currentYearlyIssuance * TREASURY_PERCENT;
        const stakersIncome = currentYearlyIssuance * STAKER_PERCENT;
        
        // Calculate staking rewards rate using START of year supply
        // Staking Rate = (Yearly Issuance × 0.85) / (Total Supply × 0.5)
        const stakingRate = (currentYearlyIssuance * STAKER_PERCENT) / (totalSupply * 0.5) * 100;
        
        // Market cap calculations using START of year supply
        const mcToSustain = currentYearlyIssuance > 0 ? totalSupply * (INITIAL_USD_VALUE / currentYearlyIssuance) : 0;
        const mcTo90M = currentYearlyIssuance > 0 ? totalSupply * (TARGET_USD_EXPENSES / currentYearlyIssuance) : 0;
        
        // Store data with supply at START of year
        data.push({
            year,
            yearlyIssuance: currentYearlyIssuance,
            totalSupply,  // This is the supply at START of year
            totalSupplyFixed,  // This is the fixed supply at START of year
            yearlyTreasuryIncome: treasuryIncome,
            yearlyStakersIncome: stakersIncome,
            mcToSustain,
            mcTo90M,
            inflationRate,
            stakingRate,
            reductionRate: reductionRate,
            period: period
        });
        
        // Add issuance to supply AFTER storing the data
        totalSupply += currentYearlyIssuance;
        totalSupplyFixed += INITIAL_ISSUANCE;
        
        // Only start counting periods from 2026
        if (year >= START_YEAR + 1) {
            yearsSincePeriod++;
            if (yearsSincePeriod >= period) {
                yearsSincePeriod = 0;
            }
        }
    }
    
    return data;
}

// Table generation
function generateTable(data) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    
    data.forEach(row => {
        const tr = document.createElement('tr');
        const paramValue = currentModel === 'fixed' ? `${row.step}%` : `${row.reductionRate}%`;
        const periodValue = currentModel === 'fixed' ? row.inflationPeriod : row.period;
        
        tr.innerHTML = `
            <td>${row.year}</td>
            <td>${formatNumber(row.yearlyIssuance)}</td>
            <td>${formatNumber(row.totalSupply)}</td>
            <td>${formatNumber(row.yearlyTreasuryIncome)}</td>
            <td>${formatNumber(row.yearlyStakersIncome)}</td>
            <td>${formatUSDCompact(row.mcToSustain)}</td>
            <td>${formatUSDCompact(row.mcTo90M)}</td>
            <td>${paramValue}</td>
            <td>${periodValue}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Chart creation and update
function updateChart(data, showMCLines = false, showStakingRate = false, logScale = false) {
    const ctx = document.getElementById('inflationChart').getContext('2d');
    
    const years = data.map(d => d.year);
    const issuance = data.map(d => d.yearlyIssuance);
    const supply = data.map(d => d.totalSupply);
    const supplyFixed = data.map(d => d.totalSupplyFixed);
    const baseline = Array(data.length).fill(INITIAL_ISSUANCE);
    
    const datasets = [
        {
            label: 'Yearly Issuance (DOT)',
            data: issuance,
            borderColor: '#2196F3',
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            yAxisID: 'y-issuance',
            tension: 0.1
        },
        {
            label: 'Total Supply (DOT)',
            data: supply,
            borderColor: '#4CAF50',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            yAxisID: 'y-supply',
            tension: 0.1
        },
        {
            label: 'Total Supply (Fixed 120M/year)',
            data: supplyFixed,
            borderColor: '#607D8B',
            borderDash: [10, 5],
            backgroundColor: 'transparent',
            yAxisID: 'y-supply',
            tension: 0.1,
            pointRadius: 0
        },
        {
            label: 'Baseline Issuance (120M DOT)',
            data: baseline,
            borderColor: '#FF9800',
            borderDash: [5, 5],
            backgroundColor: 'transparent',
            yAxisID: 'y-issuance',
            pointRadius: 0
        }
    ];
    
    if (showMCLines) {
        datasets.push({
            label: 'MC to Sustain (USD)',
            data: data.map(d => d.mcToSustain),
            borderColor: '#9C27B0',
            backgroundColor: 'rgba(156, 39, 176, 0.1)',
            yAxisID: 'y-usd',
            tension: 0.1
        });
        datasets.push({
            label: 'MC to $90M (USD)',
            data: data.map(d => d.mcTo90M),
            borderColor: '#F44336',
            backgroundColor: 'rgba(244, 67, 54, 0.1)',
            yAxisID: 'y-usd',
            tension: 0.1
        });
    }
    
    if (showStakingRate) {
        datasets.push({
            label: 'Staking Rewards Rate (%)',
            data: data.map(d => d.stakingRate),
            borderColor: '#FF5722',
            backgroundColor: 'rgba(255, 87, 34, 0.1)',
            yAxisID: 'y-staking',
            tension: 0.1
        });
    }
    
    const config = {
        type: 'line',
        data: {
            labels: years,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                title: {
                    display: true,
                    text: currentModel === 'fixed' ? 
                        'Polkadot Issuance and Supply Over Time - Fixed Step Reduction' : 
                        'Polkadot Issuance and Supply Over Time - Target Supply Model'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (label.includes('USD')) {
                                label += formatUSD(context.parsed.y);
                            } else if (label.includes('Staking Rewards Rate')) {
                                label += formatNumber(context.parsed.y, 2) + '%';
                            } else {
                                label += formatNumber(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Year'
                    }
                },
                'y-issuance': {
                    type: logScale ? 'logarithmic' : 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Yearly Issuance (DOT)'
                    },
                    ticks: {
                        callback: function(value) {
                            return formatNumber(value / 1000000) + 'M';
                        }
                    }
                },
                'y-supply': {
                    type: logScale ? 'logarithmic' : 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Total Supply (DOT)'
                    },
                    ticks: {
                        callback: function(value) {
                            return formatNumber(value / 1000000000, 2) + 'B';
                        }
                    },
                    grid: {
                        drawOnChartArea: false,
                    }
                }
            }
        }
    };
    
    if (showMCLines) {
        config.options.scales['y-usd'] = {
            type: logScale ? 'logarithmic' : 'linear',
            display: true,
            position: 'right',
            title: {
                display: true,
                text: 'Market Cap (USD)'
            },
            ticks: {
                callback: function(value) {
                    return formatUSDCompact(value);
                }
            },
            grid: {
                drawOnChartArea: false,
            }
        };
    }
    
    if (showStakingRate) {
        config.options.scales['y-staking'] = {
            type: logScale ? 'logarithmic' : 'linear',
            display: true,
            position: 'right',
            title: {
                display: true,
                text: 'Staking Rewards Rate (%)'
            },
            ticks: {
                callback: function(value) {
                    return value.toFixed(1) + '%';
                }
            },
            grid: {
                drawOnChartArea: false,
            }
        };
    }
    
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    chartInstance = new Chart(ctx, config);
}

// Update summary metrics
function updateSummary(data, param1, param2) {
    const currentData = data[0]; // 2024 data
    const tenYearData = data.find(d => d.year === 2034) || data[10];
    const finalData = data[data.length - 1];
    
    // Supply difference vs fixed inflation
    const supplyDifference = finalData.totalSupplyFixed - finalData.totalSupply;
    
    if (currentModel === 'fixed') {
        document.getElementById('summaryStep').textContent = param1;
        document.getElementById('summaryPeriod').textContent = param2;
    } else {
        // For Model 2, update the target summary
        const targetSupplyBillions = parseFloat(document.getElementById('targetSupply').value) || 0;
        document.getElementById('summaryTarget').textContent = targetSupplyBillions.toFixed(2);
        document.getElementById('summaryRate').textContent = param1;
        document.getElementById('summaryTargetPeriod').textContent = param2;
    }
    
    document.getElementById('currentInflation').textContent = formatNumber(currentData.inflationRate, 2);
    document.getElementById('tenYearInflation').textContent = formatNumber(tenYearData.inflationRate, 2);
    document.getElementById('supplyDifference').textContent = formatNumber(supplyDifference);
}

// Main update function
function updateCalculations() {
    if (currentModel === 'fixed') {
        const reductionStep = parseInt(document.getElementById('reductionStep').value);
        const inflationPeriod = parseInt(document.getElementById('inflationPeriod').value);
        
        // Update display values
        document.getElementById('reductionStepValue').textContent = reductionStep;
        document.getElementById('inflationPeriodValue').textContent = inflationPeriod;
        
        // Calculate data
        currentData = calculateModel1(reductionStep, inflationPeriod);
        
        // Update all visualizations
        updateSummary(currentData, reductionStep, inflationPeriod);
    } else {
        const targetSupplyInput = document.getElementById('targetSupply');
        const targetSupplyBillions = parseFloat(targetSupplyInput.value) || 0;
        const targetSupply = parseBillionsToValue(targetSupplyBillions);
        const reductionRate = parseInt(document.getElementById('reductionRate').value);
        const period = parseInt(document.getElementById('targetPeriod').value);
        
        // Validate target supply (1.57B minimum after 2025 issuance)
        const errorDiv = document.getElementById('targetSupplyError');
        if (targetSupplyBillions < 1.57) {
            errorDiv.style.display = 'block';
            targetSupplyInput.classList.add('invalid');
            return;
        } else {
            errorDiv.style.display = 'none';
            targetSupplyInput.classList.remove('invalid');
        }
        
        // Update display values
        document.getElementById('reductionRateValue').textContent = reductionRate;
        document.getElementById('targetPeriodValue').textContent = period;
        
        // Calculate data
        currentData = calculateModel2(targetSupply, reductionRate, period);
        
        // Update all visualizations
        updateSummary(currentData, reductionRate, period);
    }
    
    generateTable(currentData);
    updateChart(currentData, document.getElementById('showMCLines').checked, document.getElementById('showStakingRate').checked, document.getElementById('logScale').checked);
}

// Export to CSV
function exportToCSV() {
    const headers = [
        'Year',
        'Yearly Issuance (DOT)',
        'Total Supply (DOT)',
        'Total Supply Fixed (DOT)',
        'Inflation Rate %',
        'Yearly Treasury Income (DOT)',
        'Yearly Stakers Income (DOT)',
        'Staking Rewards Rate %',
        'MC Needed to Sustain (USD)',
        'MC Needed to $90M (USD)',
        'Step %',
        'Inflation Period'
    ];
    
    let csv = headers.join(',') + '\n';
    
    currentData.forEach(row => {
        const values = [
            row.year,
            row.yearlyIssuance,
            row.totalSupply,
            row.totalSupplyFixed,
            row.inflationRate.toFixed(4),
            row.yearlyTreasuryIncome,
            row.yearlyStakersIncome,
            row.stakingRate.toFixed(4),
            row.mcToSustain,
            row.mcTo90M,
            currentModel === 'fixed' ? row.step : row.reductionRate,
            currentModel === 'fixed' ? row.inflationPeriod : row.period
        ];
        csv += values.join(',') + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'polkadot_inflation_data.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Debounce function for performance
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize event listeners
document.addEventListener('DOMContentLoaded', () => {
    const debouncedUpdate = debounce(updateCalculations, 150);
    
    // Model selection listeners
    document.getElementById('modelFixed').addEventListener('change', () => {
        currentModel = 'fixed';
        document.getElementById('model1Params').style.display = 'grid';
        document.getElementById('model2Params').style.display = 'none';
        document.getElementById('model1Summary').style.display = 'block';
        document.getElementById('model2Summary').style.display = 'none';
        updateCalculations();
    });
    
    document.getElementById('modelTarget').addEventListener('change', () => {
        currentModel = 'target';
        document.getElementById('model1Params').style.display = 'none';
        document.getElementById('model2Params').style.display = 'grid';
        document.getElementById('model1Summary').style.display = 'none';
        document.getElementById('model2Summary').style.display = 'block';
        updateCalculations();
    });
    
    // Model 1 parameter listeners
    document.getElementById('reductionStep').addEventListener('input', debouncedUpdate);
    document.getElementById('inflationPeriod').addEventListener('input', debouncedUpdate);
    
    // Model 2 parameter listeners
    const targetSupplyInput = document.getElementById('targetSupply');
    
    // Format number as user types (billions format)
    targetSupplyInput.addEventListener('input', (e) => {
        const cursorPos = e.target.selectionStart;
        const oldValue = e.target.value;
        
        // Format the input value
        const formattedValue = formatNumberInput(oldValue);
        e.target.value = formattedValue;
        
        // Try to maintain cursor position
        const newCursorPos = Math.min(cursorPos, formattedValue.length);
        e.target.setSelectionRange(newCursorPos, newCursorPos);
        
        // Trigger update calculation
        debouncedUpdate();
    });
    
    // Handle paste events
    targetSupplyInput.addEventListener('paste', (e) => {
        e.preventDefault();
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        e.target.value = formatNumberInput(pastedText);
        debouncedUpdate();
    });
    
    document.getElementById('reductionRate').addEventListener('input', debouncedUpdate);
    document.getElementById('targetPeriod').addEventListener('input', debouncedUpdate);
    
    // Chart toggle listeners
    document.getElementById('showMCLines').addEventListener('change', () => {
        updateChart(currentData, document.getElementById('showMCLines').checked, document.getElementById('showStakingRate').checked, document.getElementById('logScale').checked);
    });
    
    document.getElementById('showStakingRate').addEventListener('change', () => {
        updateChart(currentData, document.getElementById('showMCLines').checked, document.getElementById('showStakingRate').checked, document.getElementById('logScale').checked);
    });
    
    document.getElementById('logScale').addEventListener('change', () => {
        updateChart(currentData, document.getElementById('showMCLines').checked, document.getElementById('showStakingRate').checked, document.getElementById('logScale').checked);
    });
    
    // Reset button
    document.getElementById('resetButton').addEventListener('click', () => {
        if (currentModel === 'fixed') {
            document.getElementById('reductionStep').value = 50;
            document.getElementById('inflationPeriod').value = 2;
        } else {
            document.getElementById('targetSupply').value = '3.14';
            document.getElementById('reductionRate').value = 25;
            document.getElementById('targetPeriod').value = 2;
        }
        updateCalculations();
    });
    
    // Export button
    document.getElementById('exportCSV').addEventListener('click', exportToCSV);
    
    // Format initial target supply value
    document.getElementById('targetSupply').value = '3.14';
    
    // Initial calculation
    updateCalculations();
});