import * as d3 from "d3";

let form_heroes, form_formats;

const all_criterias = {
  "filters": {},
  "group_form_names": {},
  "groups": {},
  "graphs": {},
  "matchups": {}
};

export async function getFormData(){
  try {
    const response = await fetch('http://localhost:3000/api/formData',{
      method: 'GET',
      headers: {'Content-Type': 'application/json'}
  });
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const formData = await response.json();
    console.log("Form data fetched successfully:", formData);
    form_heroes = formData.heroes;
    form_formats = formData.formats;
  } catch (error) {
    console.error("Error fetching form data:", error);
    form_heroes = [];
    form_formats = [];
  }
  console.log("Available heroes:", form_heroes);
  console.log("Available formats:", form_formats);
}

await getFormData();

const formsContainer = document.getElementById('forms-container');
const addFormBtn = document.getElementById('add-form');
const submitAllBtn = document.getElementById('submit-all');

// Funzione per creare un nuovo form dinamico
let group_index = 0;

export function createForm() {
  group_index++;
  all_criterias["group_form_names"][group_index - 1] = `Group_${group_index}`;
  const formDiv = document.createElement('form');
  formDiv.id = `group-form-${group_index}`;
  formDiv.style.border = "1px solid black";
  formDiv.style.margin = "10px";
  formDiv.classList.add('form-container');

  formDiv.innerHTML = `
    <fieldset>
    <legend>Decklist Group_${group_index}
      <button type="button" class="toggle-form">🔽 Hide</button>
    </legend>
    <div class="form-content-container" style="display: flex; gap: 20px;">
      <div class="form-section">
        <label>Group Name:</label><br>
        <input type="text" name="group-name" value="Group_${group_index}" required>
        <label>
          <input type="checkbox" name="dynamic-group-name" checked>
          Dynamic
        </label>
        <br><br>
        <label>Search Heroes:</label><br>
        <input type="text" class="hero-search" placeholder="Search heroes..." style="width: 250px;"><br><br>
      </div>
      
      <div class="form-section">
        <label>Heroes:</label><br>
        <div style="width: 250px; height: 100px; overflow-y: scroll; border: 1px solid #ccc; padding: 5px;">
        ${form_heroes.map(hero => `
          <label class="hero-label">
          <input type="checkbox" name="heroes" value="${hero}">
          ${hero}
          </label><br>
        `).join('')}
        </div>
        <br>
      </div>
      <div class="form-section">
        <label>Format:</label><br>
        ${form_formats.map(format => `
        <label>
        <input type="radio" name="format" value="${format}" ${format === 'Classic Constructed' ? 'checked' : ''} required>
        ${format}
        </label><br>
        `).join('')}
        <br>
        <label>Date Range:</label><br>
        <input type="datetime-local" name="start-date" value="2019-01-01T00:00" required> to
        <br>
        <input type="datetime-local" name="end-date" value="${new Date().toISOString().slice(0, 16)}" required>
        <br><br>
        <button type="button" class="remove-form">❌ Remove Decklist Group</button>
      </div>
    </div>
    </fieldset>
  `;

  // Add listeners to update all_criterias when values change
  const groupNameInput = formDiv.querySelector('input[name="group-name"]');
  groupNameInput.addEventListener('input', () => {
    formDiv.querySelector('input[name="dynamic-group-name"]').checked = false;
    const formId = formDiv.id.split('-').pop(); // Extract the group index from the form ID
    const old_name = all_criterias.group_form_names[formId - 1];
    all_criterias.group_form_names[formId - 1] = groupNameInput.value; // Update the corresponding value
    if (old_name !== groupNameInput.value) {
      all_criterias.groups[groupNameInput.value] = all_criterias.groups[old_name];
      delete all_criterias.groups[old_name];
    }
    getDataAndUpdateViz();
  });

  const heroCheckboxes = formDiv.querySelectorAll('input[name="heroes"]');
  heroCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const formId = formDiv.id.split('-').pop(); // Extract the group index from the form ID
      //Change name if name is standard
      if (formDiv.querySelector('input[name="dynamic-group-name"]').checked) {
        const selectedHeroes = Array.from(heroCheckboxes)
          .filter(cb => cb.checked)
          .map(cb => cb.value);

        const new_name = selectedHeroes.length === 1
          ? selectedHeroes[0]
          : selectedHeroes.map(hero => hero.slice(0, 3)).join("-");

        const old_name = all_criterias.group_form_names[formId - 1];
        groupNameInput.value = new_name;
        all_criterias.group_form_names[formId - 1] = groupNameInput.value; // Update the corresponding value
        if (old_name !== groupNameInput.value) {
          all_criterias.groups[groupNameInput.value] = all_criterias.groups[old_name];
          delete all_criterias.groups[old_name];
        }
      }

      const selectedHeroes = Array.from(heroCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
      all_criterias.groups[all_criterias.group_form_names[formId - 1]] = all_criterias.groups[all_criterias.group_form_names[formId - 1]] || {"filter": {}};
      all_criterias.groups[all_criterias.group_form_names[formId - 1]].filter.Hero = { precision: "IS-IN", value: selectedHeroes };
      console.log("Changing!");
      getDataAndUpdateViz();
    });
  });

  const formatRadios = formDiv.querySelectorAll('input[name="format"]');
  formatRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      const formId = formDiv.id.split('-').pop(); // Extract the group index from the form ID
      const selectedFormat = formDiv.querySelector('input[name="format"]:checked').value;
      all_criterias.groups[all_criterias.group_form_names[formId - 1]] = all_criterias.groups[all_criterias.group_form_names[formId - 1]] || {};
      all_criterias.groups[all_criterias.group_form_names[formId - 1]].Format = {
        filter: { Format: { precision: "IS", value: selectedFormat } }
      };
      getDataAndUpdateViz();
    });
  });

  const startDateInput = formDiv.querySelector('input[name="start-date"]');
  const endDateInput = formDiv.querySelector('input[name="end-date"]');
  [startDateInput, endDateInput].forEach(input => {
    input.addEventListener('change', () => {
      const formId = formDiv.id.split('-').pop(); // Extract the group index from the form ID
      const startDate = startDateInput.value;
      const endDate = endDateInput.value;
      all_criterias.groups[all_criterias.group_form_names[formId - 1]] = all_criterias.groups[all_criterias.group_form_names[formId - 1]] || {};
      all_criterias.groups[all_criterias.group_form_names[formId - 1]]["Start Date"] = {
        filter: { "Start Date": { precision: "DATE", value: { min: startDate, max: endDate } } }
      };
    getDataAndUpdateViz();
    });
  });

  // Add toggle functionality for hiding/showing the form content
  const toggleButton = formDiv.querySelector('.toggle-form');
  const formContent = formDiv.querySelector('.form-content-container');
  toggleButton.addEventListener('click', () => {
    const isHidden = formContent.style.display === 'none';
    formContent.style.display = isHidden ? 'flex' : 'none';
    toggleButton.textContent = isHidden ? '🔽 Hide' : '🔼 Show';
  });

  // Add search functionality for heroes
  const searchInput = formDiv.querySelector('.hero-search');
  const heroLabels = Array.from(formDiv.querySelectorAll('.hero-label'));

  searchInput.addEventListener('input', () => {
    const searchTerm = searchInput.value.toLowerCase();
    heroLabels.forEach(label => {
      const heroName = label.textContent.trim().toLowerCase();
      const brElement = label.nextSibling; // Assuming <br> is the next sibling of the label
      if (heroName.includes(searchTerm)) {
        label.style.display = 'inline';
        if (brElement && brElement.nodeName === 'BR') {
          brElement.style.display = 'inline';
        }
      } else {
        label.style.display = 'none';
        if (brElement && brElement.nodeName === 'BR') {
          brElement.style.display = 'none';
        }
      }
    });
  });

  // Add listener to the remove button
  formDiv.querySelector('.remove-form').addEventListener('click', () => {
    formDiv.remove();
  });

  formsContainer.appendChild(formDiv);
}

// Aggiungi il primo form all'avvio
createForm();

// Listener per aggiungere un nuovo form
addFormBtn.addEventListener('click', createForm);

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

var color;
var group_names;

export function setLegend(group_names){
  console.log("Setting legend with group names:", group_names);
  console.log("Current group names:", all_criterias.group_form_names);
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
      d.winrate.winrate = parseFloat(d.winrate.winrate); // Ensure winrate is a number
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
        .y(function(d) { return y(d.winrate.winrate); })
      );

    // Add hoverable points
    svg.selectAll(`timeseries-circle.group-${group}`)
      .data(group_data)
      .enter()
      .append("circle")
        .attr("class", `group-${group}`)
        .attr("cx", d => x(d.date))
        .attr("cy", d => y(d.winrate.winrate))
        .attr("r", 5)
        .attr("fill", color(group))
        .on("mouseover", function(event, d) {
          d3.select(this).attr("fill", "red");
          tooltip
            .style("display", "block")
            .html(`Group: ${group}<br>Date: ${d.date.toLocaleDateString()}<br>Played Rounds: ${d.winrate.playedRounds}<br>Winrate: ${d.winrate.winrate.toFixed(2)}%`)
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

export function adjustGroupFilters(data, dim, this_graph_filters){
  Object.entries(data).forEach(([group, group_data]) => {
    let group_filter = all_criterias["groups"][group];
    if (group_filter["filter"]["Matchups Winrate"] === undefined) {
      group_filter["filter"]["Matchups Winrate"] = {
      "precision": "COMPOUND",
      "value": {}
      };
    }
    if (group_filter["filter"]["Matchups Winrate"]["value"][dim] === undefined) {
      group_filter["filter"]["Matchups Winrate"]["value"][dim] = {
        min: this_graph_filters[dim].min,
        max: this_graph_filters[dim].max
      };
    }
    group_filter["filter"]["Matchups Winrate"]["value"][dim] = this_graph_filters[dim];
  });
}

export function parallelCoordinatesGraph(name_of_element, data, this_graph_filters){
  console.log("Initializing parallel coordinates graph...");

  // set the dimensions and margins of the graph
  var margin = {top: 30, right: 0, bottom: 10, left: 0},
    width = 150 - margin.left - margin.right,
    height = 400 - margin.top - margin.bottom;
  
  // Set the size of the HTML element
  d3.select(name_of_element)
    .style("width", `${width + margin.left + margin.right}px`)
    .style("height", `${height + margin.top + margin.bottom}px`);

  function createMatchupPopup(form_heroes, all_criterias, name_of_element) {
    // Add a button to open the pop-up menu
    const addMatchupBtn = document.createElement('button');
    addMatchupBtn.textContent = 'Add Matchups';
    addMatchupBtn.style.margin = '10px';
    name_of_element.appendChild(addMatchupBtn);

    // Create the pop-up menu
    const matchupPopup = document.createElement('div');
    matchupPopup.style.position = 'fixed';
    matchupPopup.style.top = '50%';
    matchupPopup.style.left = '50%';
    matchupPopup.style.transform = 'translate(-50%, -50%)';
    matchupPopup.style.background = '#fff';
    matchupPopup.style.border = '1px solid #ccc';
    matchupPopup.style.padding = '20px';
    matchupPopup.style.boxShadow = '0px 4px 6px rgba(0, 0, 0, 0.1)';
    matchupPopup.style.display = 'none';
    matchupPopup.style.zIndex = '1000';
    document.body.appendChild(matchupPopup);

    // Add content to the pop-up menu
    matchupPopup.innerHTML = `
      <h3>Add Matchups</h3>
      <div style="max-height: 300px; overflow-y: auto; border: 1px solid #ccc; padding: 10px;">
        ${form_heroes.map(hero => `
          <label>
            <input type="checkbox" class="matchup-checkbox" value="${hero}">
            ${hero}
          </label><br>
        `).join('')}
        ${Object.values(all_criterias.group_form_names).map(group => `
          <label>
            <input type="checkbox" class="matchup-checkbox" value="${group}">
            ${group}
          </label><br>
        `).join('')}
      </div>
      <br>
      <button id="matchup-popup-submit">Submit</button>
      <button id="matchup-popup-cancel">Cancel</button>
    `;

    // Add event listeners for the pop-up menu
    addMatchupBtn.addEventListener('click', () => {
      matchupPopup.style.display = 'block';
    });

    document.getElementById('matchup-popup-cancel').addEventListener('click', () => {
      matchupPopup.style.display = 'none';
    });

    document.getElementById('matchup-popup-submit').addEventListener('click', () => {
      const selectedMatchups = Array.from(matchupPopup.querySelectorAll('.matchup-checkbox:checked'))
        .map(checkbox => checkbox.value);

      if (selectedMatchups.length > 0) {
        all_criterias.matchups = selectedMatchups;
        console.log('Matchups added:', selectedMatchups);
        getDataAndUpdateViz();
      }

      matchupPopup.style.display = 'none';
    });
  }

  // Call the helper function
  const element = document.querySelector(name_of_element);
  createMatchupPopup(form_heroes, all_criterias, element);

  console.log("Extracting dimensions...");
  // Extract the list of dimensions we want to keep in the plot. Here I keep all except the column called Species
  const dimensions = data.Dimensions;
  delete data.Dimensions;
  console.log("Dimensions:", dimensions);

  margin = {top: 30, right: 0, bottom: 10, left: 0},
  width = 150 - margin.left - margin.right,
  height = 400 - margin.top - margin.bottom;
  
  // Set the size of the HTML element
  d3.select(name_of_element)
    .style("width", `${width + margin.left + margin.right}px`)
    .style("height", `${height + margin.top + margin.bottom}px`);

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
        .attr("cy", d => y(d.winrate))
        .attr("r", 5)
        .attr("fill", color(group))
        .on("mouseover", function(event, d) {
          d3.select(this).attr("fill", "red");
          tooltip
            .style("display", "block")
            .html(`Group: ${group}<br>Matchup: ${d.hero}<br>Played Rounds: ${d.playedRounds}<br>Winrate: ${d.winrate.toFixed(2)}%`)
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
    let yMin, yMax;
    dimensions.forEach(dim => {
      if (this_graph_filters[dim] === undefined) {
        this_graph_filters[dim] = { min: 0, max: 100 }; // Initialize filter for this dimension
        // Initial positions: bottom (min) and top (max)
        yMin = y.range()[0];
        yMax = y.range()[1];

      } else {
        // Use existing filter values
        const { min, max } = this_graph_filters[dim];
        yMin = y(min);
        yMax = y(max);
      }

      // Group for the axis
      const axisGroup = svg.append("g").attr("class", `filter-squares-${dim}`);

      // Top square (max)
      axisGroup.append("rect")
        .attr("class", `filter-square filter-square-top axis-${dim}`)
        .attr("x", x(dim) - 4)
        .attr("y", yMax)
        .attr("width", 8)
        .attr("height", 8)
        .attr("fill", "#ff7f0e")
        .call(
          d3.drag()
            .on("drag", function(event) {
              let newY = Math.max(y.range()[1], Math.min(y.range()[0], event.y));
              // Prevent crossing the bottom square
              const bottomY = +axisGroup.select(".filter-square-bottom").attr("y");
              newY = Math.min(newY, bottomY);
              d3.select(this).attr("y", newY);
              const newMax = y.invert(newY);
              this_graph_filters[dim].max = newMax;
            })
            .on("end", function() {
              adjustGroupFilters(data, dim, this_graph_filters);
              getDataAndUpdateViz();
            })
        );

      // Bottom square (min)
      axisGroup.append("rect")
        .attr("class", `filter-square filter-square-bottom axis-${dim}`)
        .attr("x", x(dim) - 4)
        .attr("y", yMin)
        .attr("width", 8)
        .attr("height", 8)
        .attr("fill", "#1f77b4")
        .call(
          d3.drag()
            .on("drag", function(event) {
              let newY = Math.max(y.range()[1], Math.min(y.range()[0], event.y));
              // Prevent crossing the top square
              const topY = +axisGroup.select(".filter-square-top").attr("y");
              newY = Math.max(newY, topY);
              d3.select(this).attr("y", newY);
              const newMin = y.invert(newY);
              this_graph_filters[dim].min = newMin;
            })
            .on("end", function() {
              adjustGroupFilters(data, dim, this_graph_filters);
              getDataAndUpdateViz();
            })
        );
      });

  console.log("Parallel coordinates graph drawn successfully.");
}

const graphs_filters = {};

export async function getDataAndUpdateViz(){
  try{  
    const data = await fetchDecklists(all_criterias);
    if (data.length === 0) {
      console.warn("No data returned for the given criteria.");
    } else {

      // color palette
      color = d3.scaleOrdinal()
        .domain(Object.values(all_criterias["group_form_names"]))
        .range(['#377eb8','#4daf4a','#984ea3','#ff7f00','#ffff33','#a65628','#f781bf','#999999'])
      setLegend(Object.values(all_criterias["group_form_names"]));
      // Draw the graphs
      console.log("Drawing graphs...");
      d3.select("#timeseries_viz").html(""); // Clear previous timeseries visualization if present
      timeseriesGraph("#timeseries_viz", data["timeseries_winrates"]);
      d3.select("#parallel_coordinates_viz").html(""); // Clear previous parallel coordinates visualization if present
      if (graphs_filters["parallel_coordinates_matchups"] === undefined) {
        graphs_filters["parallel_coordinates_matchups"] = {};
      }
      parallelCoordinatesGraph("#parallel_coordinates_viz", data["parallel_coordinates_matchups"], graphs_filters["parallel_coordinates_matchups"]);
    }
  } catch (error) {
    console.error("Error processing form submission:", error);
  }
}

submitAllBtn.addEventListener('click', async () => {
  console.log("Form submitted. Processing criteria...");
  const allForms = formsContainer.querySelectorAll('.form-container');
  const groups = {};

  allForms.forEach(form => {
    const formData = new FormData(form);
    console.log("Processing form:", formData);
    const group = {};
    const group_name = formData.get('group-name').trim();

    const heroes = formData.getAll('heroes');
    if (heroes.length > 0){
      group["Hero"] = {"precision": "IS-IN", "value": heroes};
    }
    const format = formData.get('format');
    if (format) {
      group["Format"] = {"precision": "IS", "value": format};
    }
    const startDate = formData.get('start-date');
    const endDate = formData.get('end-date');
    if (startDate && endDate) {
      group["Date"] = {"precision": "DATE", "value": { "min": startDate, "max": endDate }};
    }
    const rank = formData.get('rank');
    if (rank) {
      group["Rank"] = {"precision": "RANGE", "value": { "min": rank.min, "max": rank.max }};
    }
    if (Object.keys(group).length > 0) {
      groups[group_name] = {"filter" : group};
    }
  });

  let criteria = {
      "filters": {
      },
      "groups": Object.values(groups).length > 0 ? groups : {},
      "graphs": {
        "timeseries_winrates": {
          "type": "timeseries"
        },
        "parallel_coordinates_matchups": {
          "type": "parallel_coordinates",
          "matchups": all_criterias["matchups"]
        }
      }
    };
  
  console.log("Criteria prepared:", criteria);  
  // Store the criteria and filters for future use
  all_criterias["filters"] = criteria.filters;
  all_criterias["groups"] = criteria.groups;
  all_criterias["graphs"] = criteria.graphs;

    
  try {
    await getDataAndUpdateViz();
  } catch (error) {
    console.error("Error processing form submission:", error);
  }
});