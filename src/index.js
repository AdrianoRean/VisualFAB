import * as d3 from "d3";

export async function fetchDecklists(criteria) {
  const response = await fetch('http://localhost:3000/api/decklists/winrate', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(criteria)
  });
  return response.json();
}

export function drawViz(data) {
  d3.select("#viz").html(""); // Clear previous viz
  const width = 600, height = 300;
  const svg = d3.select("#viz").append("svg")
    .attr("width", width).attr("height", height);

  // Example: Bar chart of winrates by player
  const x = d3.scaleBand()
    .domain(data.map(d => d.name))
    .range([40, width-20])
    .padding(0.1);

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.winrate) || 1])
    .range([height-40, 20]);

  svg.selectAll("rect")
    .data(data)
    .enter()
    .append("rect")
    .attr("x", d => x(d.name))
    .attr("y", d => y(d.winrate))
    .attr("width", x.bandwidth())
    .attr("height", d => y(0) - y(d.winrate))
    .attr("fill", "steelblue");

  svg.append("g")
    .attr("transform", `translate(0,${height-40})`)
    .call(d3.axisBottom(x).tickFormat(d => d).tickSizeOuter(0))
    .selectAll("text")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end");

  svg.append("g")
    .attr("transform", `translate(40,0)`)
    .call(d3.axisLeft(y));
}

// Attach event listeners after DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('criteria-form').onsubmit = async function(e) {
    e.preventDefault();
    const form = e.target;
    let groups = form.Group.value.split(',').map(g => ({"name" : g.trim(), "filter": {"Hero" : {"precision": "IS-IN", "value": g.trim()}}}));
    let criteria = {
        "filter criteria": {
          Format: {"precision": "IS", "value": form.Format.value},
          Rank: {"precision": "RANGE", "min": Number(form.RankMin.value), "max": Number(form.RankMax.value)}
        },
        "group criteria": groups.length > 0 ? groups : {}
      };
    const data = await fetchDecklists(criteria);
    drawViz(data);
  };
});