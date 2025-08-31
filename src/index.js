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

export function setLegend(group_names){
  // Remove existing legend if any
  d3.select("#legend").remove();

  // Create a new legend
  const legend = d3.select("body").append("div")
    .attr("id", "legend")
    .style("position", "absolute")
    .style("top", "10px")
    .style("right", "10px")
    .style("background", "#fff")
    .style("border", "1px solid #999")
    .style("padding", "10px")
    .style("box-shadow", "0px 4px 6px rgba(0, 0, 0, 0.1)");

  // Add legend items
  group_names.forEach(name => {
    legend.append("div")
      .attr("class", "legend-item")
      .style("color", color(name))
      .text(name);
  });
}

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
            .html(`Group: ${group}<br>Date: ${d.date.toLocaleDateString()}<br>Winrate: ${d.winrate.toFixed(2)}%`)
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

export function parallelCoordinatesGraph(name_of_element, data, this_graph_filters){
  console.log("Initializing parallel coordinates graph...");

  console.log("Extracting dimensions...");
  // Extract the list of dimensions we want to keep in the plot. Here I keep all except the column called Species
  const dimensions = data.Dimensions;
  delete data.Dimensions;
  console.log("Dimensions:", dimensions);

  // set the dimensions and margins of the graph
  var margin = {top: 30, right: 0, bottom: 10, left: 0},
    width = 150 * dimensions.length - margin.left - margin.right,
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

  console.log("data:", data);

  console.log("Building scales for each dimension...");
  
  console.log("Setting up X scale...");
  // Build the X scale -> it finds the best position for each Y axis
  var x = d3.scalePoint()
    .range([0, width])
    .padding(0.5)
    .domain(dimensions);

  console.log("Setting up Y scales...");
  // For each dimension, I build a linear scale. I store all in a y object
  var y = d3.scaleLinear()
      .domain([0, 100])
      .range([height, 0]);

  console.log("Y scale:", y);

  /*
  for (const name of dimensions) {
    svg.append("g")
      .attr("class", `y-axis y-axis-${name}`)
      .attr("transform", `translate(${x(name)}, 0)`)
      .call(d3.axisLeft(y));
  }
      */

  // Reorder group_data to match the order of dimensions
  Object.entries(data).forEach(([group, group_data]) => {
    console.log(`Reordering data for group: ${group}`);
    //console.log("Original group data:", group_data);
    const correct_order = [];
    dimensions.forEach(d => {
      const found = group_data.find(g => g.hero === d);
      if (found) {
        correct_order.push(found);
      }
    });
    data[group] = correct_order; // Update the original data object
    //console.log("Reordered group data:", data[group]);
  });

  //console.log("Reordered data for each group:", data);

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
        .y(function(d) { return y(d.winrate); })
      );

    // Add hoverable points
    svg.selectAll(`parallel-circle.group-${group}`)
      .data(group_data)
      .enter()
      .append("circle")
        .attr("class", `group-${group}`)
        .attr("cx", d => x(d["hero"]))
        .attr("cy", d => y(d["winrate"]))
        .attr("r", 5)
        .attr("fill", color(group))
        .on("mouseover", function(event, d) {
          d3.select(this).attr("fill", "red");
          tooltip
            .style("display", "block")
            .html(`Group: ${group}<br>Matchup: ${d.hero}<br>Winrate: ${d.winrate.toFixed(2)}%`)
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
    .each(function(d) { d3.select(this).call(d3.axisLeft().scale(y)); })
    // Add axis title
    .append("text")
      .style("text-anchor", "middle")
      .attr("y", -9)
      .text(function(d) { return d; })
      .style("fill", "black");

    // Add movable point for filters
    dimensions.forEach(dim => {
      this_graph_filters[dim] = { min: 0, max: 100 }; // Initialize filter for this dimension
      // Initial positions: bottom (min) and top (max)
      const yMin = y.range()[0];
      const yMax = y.range()[1];

      // Initial values: min and max of the axis domain
      const minValue = y.invert(yMin);
      const maxValue = y.invert(yMax);

      // Group for the axis
      const axisGroup = svg.append("g").attr("class", `filter-squares-${dim}`);

      // Top square (max)
      axisGroup.append("rect")
        .attr("class", `filter-square filter-square-top axis-${dim}`)
        .attr("x", x(dim) - 4)
        .attr("y", y(maxValue) - 4)
        .attr("width", 8)
        .attr("height", 8)
        .attr("fill", "#ff7f0e")
        .call(
          d3.drag()
            .on("drag", function(event) {
              let newY = Math.max(y.range()[1], Math.min(y.range()[0], event.y));
              // Prevent crossing the bottom square
              const bottomY = +axisGroup.select(".filter-square-bottom").attr("y");
              newY = Math.min(newY, bottomY - 10);
              d3.select(this).attr("y", newY);
              const newMax = y.invert(newY);
              this_graph_filters[dim].max = newMax;
            })
            .on("end", function() {
              Object.entries(data).forEach(([group, group_data]) => {
                let group_filter = all_criterias["groups"][group];
                if (!group_filter["Matchups Winrate"]) {
                  group_filter["Matchups Winrate"] = {
                    "precision": "COMPOUND",
                    "value": {}
                  };
                }
                if (!group_filter["Matchups Winrate"]["value"][dim]) {
                  group_filter["Matchups Winrate"]["value"][dim] = {
                    min: this_graph_filters[dim].min,
                    max: this_graph_filters[dim].max
                  };
                }
                group_filter["Matchups Winrate"]["value"][dim] = this_graph_filters[dim];
              });
              console.log("This graph's filters:", this_graph_filters);
            })
        );

      // Bottom square (min)
      axisGroup.append("rect")
        .attr("class", `filter-square filter-square-bottom axis-${dim}`)
        .attr("x", x(dim) - 4)
        .attr("y", y(minValue) - 4)
        .attr("width", 8)
        .attr("height", 8)
        .attr("fill", "#1f77b4")
        .call(
          d3.drag()
            .on("drag", function(event) {
              let newY = Math.max(y.range()[1], Math.min(y.range()[0], event.y));
              // Prevent crossing the top square
              const topY = +axisGroup.select(".filter-square-top").attr("y");
              newY = Math.max(newY, topY + 10);
              d3.select(this).attr("y", newY);
              const newMin = y.invert(newY);
              this_graph_filters[dim].min = newMin;
            })
            .on("end", function() {
              console.log("This graph's filters:", this_graph_filters);
            })
        );
      });

  console.log("Parallel coordinates graph drawn successfully.");
}

const graphs_filters = {};
const all_criterias = {
  "filters": {},
  "groups": {},
  "graphs": {}
};

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
        group_names = form.Group.value.split(',').map(g => g.trim()); // list of group names
        color = d3.scaleOrdinal()
          .domain(group_names)
          .range(['#377eb8','#4daf4a','#984ea3','#ff7f00','#ffff33','#a65628','#f781bf','#999999'])
        setLegend(group_names);
        // Draw the graphs
        console.log("Drawing graphs...");
        d3.select("#timeseries_viz").html(""); // Clear previous timeseries visualization if present
        timeseriesGraph("#timeseries_viz", data["timeseries_winrates"]);
        d3.select("#parallel_coordinates_viz").html(""); // Clear previous parallel coordinates visualization if present
        graphs_filters["parallel_coordinates_matchups"] = {};
        parallelCoordinatesGraph("#parallel_coordinates_viz", data["parallel_coordinates_matchups"], graphs_filters["parallel_coordinates_matchups"]);
        // Store the criteria and filters for future use
        all_criterias["filters"] = criteria.filters;
        all_criterias["groups"] = criteria.groups;
        all_criterias["graphs"] = criteria.graphs;
      }
    } catch (error) {
      console.error("Error processing form submission:", error);
    }
  };
});