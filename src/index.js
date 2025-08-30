import * as d3 from "d3";

export async function fetchDecklists(criteria) {
  console.log("Fetching decklists with criteria:", criteria);
  try {
    const response = await fetch('http://localhost:3000/api/decklists/winrate', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(criteria)
    });

    if (!response.ok) {
      console.error("Failed to fetch decklists. Status:", response.status, response.statusText);
      return [];
    }

    const data = await response.json();
    console.log("Fetched decklists successfully:", data);
    return data;
  } catch (error) {
    console.error("Error fetching decklists:", error);
    return [];
  }
}

export function drawViz(data) {
  console.log("Drawing visualization with data:", data);

  d3.select("#viz").html(""); // Clear previous viz
  // set the dimensions and margins of the graph
  var margin = {top: 10, right: 30, bottom: 30, left: 60},
      width = 460 - margin.left - margin.right,
      height = 400 - margin.top - margin.bottom;

  // append the svg object to the body of the page
  var svg = d3.select("#viz")
    .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
    .append("g")
      .attr("transform",
            "translate(" + margin.left + "," + margin.top + ")");
  
  const metadata = data.Metadata;
  delete data.Metadata;
    
  const x = d3.scaleTime()
    .domain([new Date(metadata.min_date), new Date(metadata.max_date)])
    .range([ 0, width ]);
    svg.append("g")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x));

  const y = d3.scaleLinear()
    .domain([0, 100])
    .range([ height, 0 ]);
    svg.append("g")
      .call(d3.axisLeft(y));

    // color palette
  var res = Object.keys(data); // list of group names
  var color = d3.scaleOrdinal()
    .domain(res)
    .range(['#e41a1c','#377eb8','#4daf4a','#984ea3','#ff7f00','#ffff33','#a65628','#f781bf','#999999'])
  
  var cindra = data['Cindra'];
  console.log("Cindra data:", cindra);

  if (!cindra || cindra.length === 0) {
    console.warn("No data available for 'Cindra'.");
    return;
  }

  // Parse date strings into Date objects
  cindra.forEach(d => {
    d.date = new Date(d.date);
  });

  // Add the line
  svg.append("path")
    .datum(cindra)
    .attr("fill", "none")
    .attr("stroke", "steelblue")
    .attr("stroke-width", 1.5)
    .attr("d", d3.line()
      .x(function(d) { return x(d.date); })
      .y(function(d) { return y(d.winrate); })
    );

    console.log("I'm here!");

  console.log("Visualization drawn successfully.");
}

// Attach event listeners after DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  console.log("DOM fully loaded. Attaching event listeners.");

  document.getElementById('criteria-form').onsubmit = async function(e) {
    e.preventDefault();
    console.log("Form submitted. Processing criteria...");

    try {
      const form = e.target;
      let groups = form.Group.value.split(',').map(g => ({"name" : g.trim(), "filter": {"Hero" : {"precision": "IS-IN", "value": g.trim()}}}));
      let criteria = {
        "filter criteria": {
          Format: {"precision": "IS", "value": form.Format.value},
          Rank: {"precision": "RANGE", "min": Number(form.RankMin.value), "max": Number(form.RankMax.value)}
        },
        "group criteria": groups.length > 0 ? groups : {}
      };

      console.log("Criteria prepared:", criteria);

      const data = await fetchDecklists(criteria);
      if (data.length === 0) {
        console.warn("No data returned for the given criteria.");
      } else {
        drawViz(data);
      }
    } catch (error) {
      console.error("Error processing form submission:", error);
    }
  };
});