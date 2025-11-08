// Configuration
const margin = {top: 60, right: 40, bottom: 80, left: 80};
const width = 1200 - margin.left - margin.right;
const height = 600 - margin.top - margin.bottom;
const pixelSize = 4;

let currentMetric = 'coffee';
let currentCountry = 'all';
let data = [];

// Create SVG
const svg = d3.select('#chart')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

// Tooltip
const tooltip = d3.select('.tooltip');

// Color schemes for different metrics
const colorSchemes = {
    coffee: {
        low: '#DEB887',    // Burlywood (light brown)
        medium: '#A0522D', // Sienna (medium brown)
        high: '#654321',   // Dark brown
        theme: 'Coffee Theme'
    },
    sleep: {
        low: '#FFA07A',    // Light coral (less sleep = alert/tired)
        medium: '#9370DB', // Medium purple (moderate sleep)
        high: '#4169E1',   // Royal blue (well-rested)
        theme: 'Sleep Theme'
    },
    caffeine: {
        low: '#FFD700',    // Gold (low energy)
        medium: '#FF8C00', // Dark orange (moderate energy)
        high: '#DC143C',   // Crimson (high energy/alert)
        theme: 'Caffeine Theme'
    }
};

// Color scale function - now dynamic based on metric
function getColor(value, metric) {
    const thresholds = {
        coffee: [2, 4],
        sleep: [6, 7.5],
        caffeine: [200, 400]
    };
    const [low, high] = thresholds[metric];
    const colors = colorSchemes[metric];

    if (value < low) return colors.low;
    if (value < high) return colors.medium;
    return colors.high;
}

// Update legend colors based on current metric
function updateLegend() {
    const colors = colorSchemes[currentMetric];
    d3.selectAll('.legend-color')
        .transition()
        .duration(500)
        .style('background', function(d, i) {
            if (i === 0) return colors.low;
            if (i === 1) return colors.medium;
            return colors.high;
        });
}

// Group data by country
function groupByCountry(filteredData) {
    const grouped = d3.group(filteredData, d => d.country);
    return Array.from(grouped, ([country, values]) => ({
        country,
        values,
        count: values.length
    }));
}

// Group data by age ranges (for single country view)
function groupByAge(filteredData) {
    const ageRanges = [
        { label: '18-25', min: 18, max: 25 },
        { label: '26-35', min: 26, max: 35 },
        { label: '36-45', min: 36, max: 45 },
        { label: '46-55', min: 46, max: 55 },
        { label: '56+', min: 56, max: 100 }
    ];

    return ageRanges.map(range => {
        const values = filteredData.filter(d => d.age >= range.min && d.age <= range.max);
        return {
            group: range.label,
            values,
            count: values.length
        };
    }).filter(d => d.count > 0);
}

// Update visualization
function updateViz() {
    const filteredData = currentCountry === 'all'
        ? data
        : data.filter(d => d.country === currentCountry);

    // Decide grouping based on filter
    const grouped = currentCountry === 'all'
        ? groupByCountry(filteredData)
        : groupByAge(filteredData);

    // Update stats
    const avg = d3.mean(filteredData, d => d[currentMetric]);
    const metricNames = {coffee: 'Coffee Intake', sleep: 'Sleep Hours', caffeine: 'Caffeine'};
    const units = {coffee: 'cups', sleep: 'hours', caffeine: 'mg'};

    const viewType = currentCountry === 'all' ? 'All Countries' : `${currentCountry} by Age Group`;
    d3.select('#stats').html(
        `<strong>${viewType}</strong> | Showing <strong>${filteredData.length}</strong> people | 
        Average ${metricNames[currentMetric]}: <strong>${avg.toFixed(2)} ${units[currentMetric]}</strong>`
    );

    // Update legend colors
    updateLegend();

    // Scales - different orientation based on view
    let xScale, yScale;

    if (currentCountry === 'all') {
        // HORIZONTAL bars (countries side by side)
        xScale = d3.scaleBand()
            .domain(grouped.map(d => d.country))
            .range([0, width])
            .padding(0.2);

        const maxCount = d3.max(grouped, d => d.count);
        yScale = d3.scaleLinear()
            .domain([0, maxCount])
            .range([height, 0]);
    } else {
        // VERTICAL bars (age groups stacked vertically)
        const maxCount = d3.max(grouped, d => d.count);
        xScale = d3.scaleLinear()
            .domain([0, maxCount])
            .range([0, width]);

        yScale = d3.scaleBand()
            .domain(grouped.map(d => d.group))
            .range([0, height])
            .padding(0.2);
    }

    // Calculate pixel positions
    const pixels = [];
    grouped.forEach(group => {
        if (currentCountry === 'all') {
            // HORIZONTAL layout (bottom to top)
            const barWidth = xScale.bandwidth();
            const pixelsPerRow = Math.floor(barWidth / (pixelSize * 1.5));

            group.values.forEach((person, i) => {
                const row = Math.floor(i / pixelsPerRow);
                const col = i % pixelsPerRow;
                pixels.push({
                    ...person,
                    x: xScale(group.country) + col * pixelSize * 1.5 + pixelSize,
                    y: height - row * pixelSize * 1.5 - pixelSize
                });
            });
        } else {
            // VERTICAL layout (left to right)
            const barHeight = yScale.bandwidth();
            const pixelsPerCol = Math.floor(barHeight / (pixelSize * 1.5));

            group.values.forEach((person, i) => {
                const col = Math.floor(i / pixelsPerCol);
                const row = i % pixelsPerCol;
                pixels.push({
                    ...person,
                    x: col * pixelSize * 1.5 + pixelSize,
                    y: yScale(group.group) + row * pixelSize * 1.5 + pixelSize
                });
            });
        }
    });

    // Bind data
    const circles = svg.selectAll('circle')
        .data(pixels, d => d.id);

    // Enter
    circles.enter()
        .append('circle')
        .attr('r', 0)
        .attr('cx', width / 2)
        .attr('cy', height / 2)
        .merge(circles)
        .on('mouseover', function(event, d) {
            d3.select(this)
                .transition()
                .duration(200)
                .attr('r', pixelSize * 2)
                .attr('stroke', '#000')
                .attr('stroke-width', 1);

            tooltip
                .style('opacity', 1)
                .html(`
                    <strong>${d.country}</strong><br>
                    Age: ${d.age}<br>
                    Gender: ${d.gender}<br>
                    Coffee: ${d.coffee} cups<br>
                    Sleep: ${d.sleep} hours<br>
                    Caffeine: ${d.caffeine} mg
                `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function() {
            d3.select(this)
                .transition()
                .duration(200)
                .attr('r', pixelSize)
                .attr('stroke', 'none');
            tooltip.style('opacity', 0);
        })
        .transition()
        .duration(1000)
        .delay((d, i) => i * 2)
        .attr('cx', d => d.x)
        .attr('cy', d => d.y)
        .attr('r', pixelSize)
        .attr('fill', d => getColor(d[currentMetric], currentMetric))
        .attr('opacity', 0.8);

    // Exit
    circles.exit()
        .transition()
        .duration(500)
        .attr('r', 0)
        .attr('opacity', 0)
        .remove();

    // Update axes
    svg.selectAll('.x-axis').remove();
    svg.selectAll('.y-axis').remove();
    svg.selectAll('.axis-label').remove();

    if (currentCountry === 'all') {
        // Horizontal bars - country labels on bottom
        svg.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale))
            .selectAll('text')
            .attr('transform', 'rotate(-45)')
            .style('text-anchor', 'end')
            .style('font-size', '12px');

        svg.append('g')
            .attr('class', 'y-axis')
            .call(d3.axisLeft(yScale).ticks(5));

        svg.append('text')
            .attr('class', 'axis-label')
            .attr('x', width / 2)
            .attr('y', height + 70)
            .attr('text-anchor', 'middle')
            .text('Country');

        svg.append('text')
            .attr('class', 'axis-label')
            .attr('transform', 'rotate(-90)')
            .attr('x', -height / 2)
            .attr('y', -60)
            .attr('text-anchor', 'middle')
            .text('Number of People');
    } else {
        // Vertical bars - age labels on left
        svg.append('g')
            .attr('class', 'y-axis')
            .call(d3.axisLeft(yScale))
            .selectAll('text')
            .style('font-size', '12px');

        svg.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale).ticks(5));

        svg.append('text')
            .attr('class', 'axis-label')
            .attr('x', width / 2)
            .attr('y', height + 50)
            .attr('text-anchor', 'middle')
            .text('Number of People');

        svg.append('text')
            .attr('class', 'axis-label')
            .attr('transform', 'rotate(-90)')
            .attr('x', -height / 2)
            .attr('y', -60)
            .attr('text-anchor', 'middle')
            .text('Age Group');
    }
}

// Initialize visualization after data loads
function initializeVisualization(loadedData) {
    data = loadedData;

    // Get unique countries and populate dropdown
    const countries = ['all', ...new Set(data.map(d => d.country))].sort();
    d3.select('#country-filter')
        .selectAll('option')
        .data(countries)
        .enter()
        .append('option')
        .attr('value', d => d)
        .text(d => d === 'all' ? 'All Countries' : d);

    // Event listeners
    d3.selectAll('.metric-btn').on('click', function() {
        d3.selectAll('.metric-btn').classed('active', false);
        d3.select(this).classed('active', true);
        currentMetric = this.dataset.metric;
        updateViz();
    });

    d3.select('#country-filter').on('change', function() {
        currentCountry = this.value;
        updateViz();
    });

    // Initial render
    updateViz();
}

// Load data from CSV file in data folder
d3.csv('data/synthetic_coffee_health_10000.csv').then(loadedData => {
    const processedData = loadedData.map(d => ({
        id: +d.ID,
        age: +d.Age,
        gender: d.Gender,
        country: d.Country,
        coffee: +d.Coffee_Intake || +d.Coffee_IntakeCaffeine_mg || 0,
        caffeine: +d.Caffeine_mg,
        sleep: +d.Sleep_Hours
    }));

    initializeVisualization(processedData);
}).catch(error => {
    console.error('Error loading the CSV file:', error);
    d3.select('#chart').html('<p style="color: red; text-align: center;">Error loading data. Please check the file path.</p>');
});