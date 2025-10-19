// Load CSV data from file
d3.csv('data/synthetic_coffee_health_10000.csv').then(rawData => {
    const data = rawData.map(d => ({
        id: +d.ID,
        age: +d.Age,
        gender: d.Gender,
        country: d.Country,
        coffee: +d.Coffee_Intake,
        caffeine: +d.Caffeine_mg,
        sleep: +d.Sleep_Hours
    }));

    initializeVisualization(data);
}).catch(error => {
    console.error('Error loading CSV:', error);
    document.querySelector('.container').innerHTML = '<h2 style="color: red; text-align: center;">Error loading data. Please check the file path.</h2>';
});

function initializeVisualization(data) {
    // Configuration
    const margin = {top: 60, right: 40, bottom: 80, left: 80};
    const width = 1200 - margin.left - margin.right;
    const height = 600 - margin.top - margin.bottom;
    const pixelSize = 4;

    let currentMetric = 'coffee';
    let currentCountry = 'all';

    // Create SVG
    const svg = d3.select('#chart')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Tooltip
    const tooltip = d3.select('.tooltip');

    // Get unique countries and populate dropdown
    const countries = ['all', ...new Set(data.map(d => d.country))].sort();
    d3.select('#country-filter')
        .selectAll('option')
        .data(countries)
        .enter()
        .append('option')
        .attr('value', d => d)
        .text(d => d === 'all' ? 'All Countries' : d);

    // Color scale function
    function getColor(value, metric) {
        const thresholds = {
            coffee: [2, 4],
            sleep: [6, 7.5],
            caffeine: [200, 400]
        };
        const [low, high] = thresholds[metric];
        if (value < low) return '#DEB887'; // Burlywood (light brown)
        if (value < high) return '#A0522D'; // Sienna (medium brown)
        return '#654321'; // Dark brown
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

    // Update visualization
    function updateViz() {
        const filteredData = currentCountry === 'all'
            ? data
            : data.filter(d => d.country === currentCountry);

        const grouped = groupByCountry(filteredData);

        // Update stats
        const avg = d3.mean(filteredData, d => d[currentMetric]);
        const metricNames = {coffee: 'Coffee Intake', sleep: 'Sleep Hours', caffeine: 'Caffeine'};
        const units = {coffee: 'cups', sleep: 'hours', caffeine: 'mg'};
        d3.select('#stats').html(
            `Showing <strong>${filteredData.length}</strong> people | 
            Average ${metricNames[currentMetric]}: <strong>${avg.toFixed(2)} ${units[currentMetric]}</strong>`
        );

        // Scales
        const xScale = d3.scaleBand()
            .domain(grouped.map(d => d.country))
            .range([0, width])
            .padding(0.2);

        const maxCount = d3.max(grouped, d => d.count);
        const yScale = d3.scaleLinear()
            .domain([0, maxCount])
            .range([height, 0]);

        // Calculate pixel positions
        const pixels = [];
        grouped.forEach(group => {
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
                    .attr('r', pixelSize * 2);

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
                    .attr('r', pixelSize);
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
    }

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