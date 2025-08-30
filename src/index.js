import * as d3 from "d3";

export async function fetchDecklists(criteria) {
  console.log("Fetching decklists with criteria:", criteria);
  try {
    const response = await fetch('http://localhost:3000/api/decklists/calculate', {
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

// Add this once, outside drawViz
const tooltip = d3.select("body")
  .append("div")
  .attr("id", "d3-tooltip")
  .style("position", "absolute")
  .style("background", "#fff")
  .style("border", "1px solid #999")
  .style("padding", "4px 8px")
  .style("pointer-events", "none")
  .style("display", "none");


  var color;
  var group_names;

export function timeseriesGraph(name_of_element, data) {
  
  console.log("Drawing visualization with data:", data);

  d3.select(name_of_element).html(""); // Clear previous viz
  // set the dimensions and margins of the graph
  var margin = {top: 10, right: 30, bottom: 30, left: 60},
      width = 460 - margin.left - margin.right,
      height = 400 - margin.top - margin.bottom;

  // append the svg object to the body of the page
  var svg = d3.select(name_of_element)
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
      .call(d3.axisBottom(x).ticks(Math.round(width / 50)));

  const y = d3.scaleLinear()
    .domain([0, 100])
    .range([ height, 0 ]);
    svg.append("g")
      .call(d3.axisLeft(y));

  // Parse date strings into Date objects
  Object.values(data).forEach(groupData => {
    groupData.forEach(d => {
      d.date = new Date(d.date);
      d.winrate = parseFloat(d.winrate); // Ensure winrate is a number
    });
  });

  Object.entries(data).forEach(([group, group_data]) => {
  // Add the line
    svg.append("path")
      .attr("id", `timeseries-line-${group}`)
      .datum(group_data)
      .attr("fill", "none")
      .attr("stroke", color(group))
      .attr("stroke-width", 1.5)
      .attr("d", d3.line()
        .x(function(d) { return x(d.date); })
        .y(function(d) { return y(d.winrate); })
      );

    // Add hoverable points
    svg.selectAll(`timeseries-circle.group-${group}`)
      .data(group_data)
      .enter()
      .append("circle")
        .attr("class", `group-${group}`)
        .attr("cx", d => x(d.date))
        .attr("cy", d => y(d.winrate))
        .attr("r", 5)
        .attr("fill", color(group))
        .on("mouseover", function(event, d) {
          d3.select(this).attr("fill", "red");
          tooltip
            .style("display", "block")
            .html(`Date: ${d.date.toLocaleDateString()}<br>Winrate: ${d.winrate.toFixed(2)}%`)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mousemove", function(event) {
          tooltip
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
          d3.select(this).attr("fill", color(group));
          tooltip.style("display", "none");
        });
    }
  )

  console.log("Visualization drawn successfully.");
}

export function parallelCoordinatesGraph(name_of_element, data){
  console.log("Initializing parallel coordinates graph...");

  // set the dimensions and margins of the graph
  var margin = {top: 30, right: 10, bottom: 10, left: 0},
    width = 500 - margin.left - margin.right,
    height = 400 - margin.top - margin.bottom;

  console.log("Setting up SVG canvas...");
  // append the svg object to the body of the page
  var svg = d3.select(name_of_element)
  .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform",
          "translate(" + margin.left + "," + margin.top + ")");

  console.log("Extracting dimensions...");
  // Extract the list of dimensions we want to keep in the plot. Here I keep all except the column called Species
  const dimensions = data.Dimensions;
  delete data.Dimensions;
  console.log("Dimensions:", dimensions);

  console.log("Building scales for each dimension...");
  
  console.log("Setting up X scale...");
  // Build the X scale -> it finds the best position for each Y axis
  var x = d3.scalePoint()
    .range([0, width])
    .padding(1)
    .domain(dimensions);

  console.log("Setting up Y scales...");
  // For each dimension, I build a linear scale. I store all in a y object
  var y = {};
  for (let i in dimensions) {
    const name = dimensions[i];
    y[name] = d3.scaleLinear()
      .domain([0, 100])
      .range([height, 0]);
  }
  console.log("Y scales:", y);

  for (const [name, scale] of Object.entries(y)) {
    svg.append("g")
      .attr("class", `y-axis y-axis-${name}`)
      .attr("transform", `translate(${x(name)}, 0)`)
      .call(d3.axisLeft(scale));
  }

  console.log("Defining path function...");
  // The path function takes a row of the csv as input, and returns x and y coordinates of the line to draw for this row.
  function path(d) {
      return d3.line()(dimensions.map(function(p) { return [x(p), y[p](d[p])]; }));
  }

  console.log("Drawing lines and points for each group...");
  Object.entries(data).forEach(([group, group_data]) => {
    console.log(`Processing group: ${group}`);
    // Draw the lines
    svg.append("path")
      .attr("id", `parallel-graph-line-${group}`)
      .datum(group_data)
      .style("fill", "none")
      .style("stroke", color(group))
      .style("stroke-width", 1.5)
      .attr("d", d3.line()
        .x(function(d) { return x(d.hero); })
        .y(function(d) { return y[group](d.winrate); })
      );

    // Add hoverable points
    svg.selectAll(`parallel-circle.group-${group}`)
      .data(group_data)
      .enter()
      .append("circle")
        .attr("class", `group-${group}`)
        .attr("cx", d => x(d["hero"]))
        .attr("cy", d => y[group](d["winrate"]))
        .attr("r", 5)
        .attr("fill", color(group))
        .on("mouseover", function(event, d) {
          d3.select(this).attr("fill", "red");
          tooltip
            .style("display", "block")
            .html(`Matchup: ${d.hero}<br>Winrate: ${d.winrate.toFixed(2)}%`)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mousemove", function(event) {
          tooltip
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
          d3.select(this).attr("fill", color(group));
          tooltip.style("display", "none");
        });
  });

  console.log("Drawing axes...");
  // Draw the axis:
  svg.selectAll("myAxis")
    // For each dimension of the dataset I add a 'g' element:
    .data(dimensions).enter()
    .append("g")
    // I translate this element to its right position on the x axis
    .attr("transform", function(d) { return "translate(" + x(d) + ")"; })
    // And I build the axis with the call function
    .each(function(d) { d3.select(this).call(d3.axisLeft().scale(y[d])); })
    // Add axis title
    .append("text")
      .style("text-anchor", "middle")
      .attr("y", -9)
      .text(function(d) { return d; })
      .style("fill", "black");

  console.log("Parallel coordinates graph drawn successfully.");
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
      let matchups = form.Matchups.value.split(',').map(m => m.trim());
      let criteria = {
        "filters": {
          Format: {"precision": "IS", "value": form.Format.value},
          Rank: {"precision": "RANGE", "min": Number(form.RankMin.value), "max": Number(form.RankMax.value)}
        },
        "groups": groups.length > 0 ? groups : {},
        "graphs": {
          "timeseries_winrates": {
            "type": "timeseries"
          },
          "parallel_coordinates_matchups": {
            "type": "parallel_coordinates",
            "matchups": matchups
          }
        }
      };

      console.log("Criteria prepared:", criteria);

      const data = await fetchDecklists(criteria);
      if (data.length === 0) {
        console.warn("No data returned for the given criteria.");
      } else {
        
        // color palette
        group_names = Object.keys(data); // list of group names
        color = d3.scaleOrdinal()
          .domain(group_names)
          .range(['#377eb8','#4daf4a','#984ea3','#ff7f00','#ffff33','#a65628','#f781bf','#999999'])

        // Draw the graphs
        console.log("Drawing graphs...");
        timeseriesGraph("#timeseries_viz", data["timeseries_winrates"]);
        parallelCoordinatesGraph("#parallel_coordinates_viz", data["parallel_coordinates_matchups"]);
      }
    } catch (error) {
      console.error("Error processing form submission:", error);
    }
  };
});