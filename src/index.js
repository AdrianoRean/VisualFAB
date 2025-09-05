import * as d3 from "d3";

let form_heroes, form_formats;

let all_criterias = {
  "filters": {},
  "group_form_names": {},
  "groups": {},
  "graphs": {},
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

export function createForm(existingGroupName = null) {
  let groupName;
  let g_index;
  if (existingGroupName !== null){
    groupName = existingGroupName;
    g_index = Object.keys(all_criterias.group_form_names).find(key => all_criterias.group_form_names[key] === existingGroupName);
  } else {
    groupName = `Group_${group_index}`;
    all_criterias["group_form_names"][group_index] = groupName;
    g_index = group_index;
  }
  const formDiv = document.createElement('form');
  formDiv.id = `group-form-${g_index}`;
  formDiv.style.border = "1px solid black";
  formDiv.style.margin = "10px";
  formDiv.classList.add('form-container');

  formDiv.innerHTML = `
    <fieldset>
    <legend>${groupName}
      <button type="button" class="toggle-form">🔽 Hide</button>
    </legend>
    <div class="form-content-container" style="display: flex; gap: 20px;">
      <div class="form-section">
        <label>Group Name:</label><br>
        <input type="text" name="group-name" value="Group_${g_index}" required>
        <label>
          <br><input type="checkbox" name="dynamic-group-name" checked>
          Dynamic
        </label>
        <br><br>
        <label>Rank Range: <span id="rank-help-span" title="Rank 513 means that the player has dropped the tournament">ℹ️</span></label><br>
          <input type="number" name="rank-min" min="1" max="513" value="1" style="width: 60px;" oninput="this.nextElementSibling.value = this.value"> 
          <input type="range" name="rank-min" min="1" max="513" value="1" style="width: 120px;" oninput="this.previousElementSibling.value = this.value"> 
          <br>to<br>
          <input type="number" name="rank-max" min="1" max="513" value="512" style="width: 60px;" oninput="this.nextElementSibling.value = this.value"> 
          <input type="range" name="rank-max" min="1" max="513" value="512" style="width: 120px;" oninput="this.previousElementSibling.value = this.value"> 
        <br><br>
      </div>
      
      <div class="form-section">
        <label>Search Heroes:</label><br>
        <input type="text" class="hero-search" placeholder="Search heroes..." style="width: 250px;"><br><br>
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
        <div id="decklists-analyzed-count-group-${g_index}">n/d</div>
        <button type="button" class="remove-form">❌ Remove Decklist Group</button>
      </div>
    </div>
    </fieldset>
  `;

  // Add hover tooltip
  const rankHelpSpan = formDiv.querySelector('#rank-help-span');
  rankHelpSpan.addEventListener('mouseover', (event) => {
    tooltip
      .style("display", "block")
      .html(`Rank 513 means that the player has dropped the tournament`)
      .style("left", (event.pageX + 10) + "px")
      .style("top", (event.pageY - 28) + "px");
  });
  rankHelpSpan.addEventListener("mousemove", function(event) {
        tooltip
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
  rankHelpSpan.addEventListener("mouseout", function() {
        tooltip.style("display", "none")
      });

  // Add listeners to update all_criterias when values change
  const groupNameInput = formDiv.querySelector('input[name="group-name"]');
  function updateGroupName() {
    formDiv.querySelector('input[name="dynamic-group-name"]').checked = false;
    const formId = formDiv.id.split('-').pop(); // Extract the group index from the form ID
    let newGroupName = groupNameInput.value.trim().replace(",", ' ').replace(/[^a-zA-Z0-9-_]/g, ''); // Sanitize input by trimming whitespace and removing special characters
    console.log("New Group Name:", newGroupName, "<formId>", formId);

    // Check for duplicates in all_criterias.groups
    if (Object.keys(all_criterias.groups).includes(newGroupName)) {
      const randomSuffix = Math.random().toString(36).substring(2, 6); // Generate a random short string
      newGroupName = `${newGroupName}_${randomSuffix}`;
      groupNameInput.value = newGroupName; // Update the input field with the new unique name
    }

    const old_name = all_criterias.group_form_names[formId];
    all_criterias.group_form_names[formId] = newGroupName; // Update the corresponding value

    if (old_name !== newGroupName) {
      all_criterias.groups[newGroupName] = all_criterias.groups[old_name];
      delete all_criterias.groups[old_name];
    }

    return newGroupName;
  }
  groupNameInput.addEventListener('input', async () => {
    formDiv.querySelector('input[name="dynamic-group-name"]').checked = false;
    const newGroupName = updateGroupName();
    formDiv.querySelector('input[name="group-name"]').value = newGroupName;
     await getDataAndUpdateViz();  
    });

  const rankInputs = formDiv.querySelectorAll('input[name="rank-min"], input[name="rank-max"]');
  function updateRankRange() {
    const formId = formDiv.id.split('-').pop(); // Extract the group index from the form ID
    const rankMin = formDiv.querySelector('input[name="rank-min"]').value;
    const rankMax = formDiv.querySelector('input[name="rank-max"]').value;
    all_criterias.groups[all_criterias.group_form_names[formId]] = all_criterias.groups[all_criterias.group_form_names[formId]] || { filter: {} };
    all_criterias.groups[all_criterias.group_form_names[formId]].filter.Rank = { precision: "RANGE", value: { min: rankMin, max: rankMax } };
  }
  rankInputs.forEach(input => {
    input.addEventListener('input', async () => {
      updateRankRange();
       await getDataAndUpdateViz();    
      });
  });

  const heroCheckboxes = formDiv.querySelectorAll('input[name="heroes"]');
  function updateHeroSelection(){
    const formId = formDiv.id.split('-').pop(); // Extract the group index from the form ID
      //Change name if name is standard
      if (formDiv.querySelector('input[name="dynamic-group-name"]').checked) {
        const selectedHeroes = Array.from(heroCheckboxes)
          .filter(cb => cb.checked)
          .map(cb => cb.value);

        const new_name = selectedHeroes.length === 1
          ? selectedHeroes[0]
          : selectedHeroes.map(hero => hero.slice(0, 3)).join("-");

        let newGroupName = new_name.trim().replace(/[^a-zA-Z0-9-_ ]/g, ''); // Sanitize input by removing special characters but keep whitespaces
        // Check for duplicates in all_criterias.groups
        if (Object.keys(all_criterias.groups).includes(newGroupName)) {
          const randomSuffix = Math.random().toString(36).substring(2, 6); // Generate a random short string
          newGroupName = `${newGroupName}_${randomSuffix}`;
        }
        console.log("New Group Name:", newGroupName, "Would be name:", new_name);
        formDiv.querySelector('input[name="group-name"]').value = newGroupName;

        const old_name = all_criterias.group_form_names[formId];
        groupNameInput.value = newGroupName;
        all_criterias.group_form_names[formId] = groupNameInput.value; // Update the corresponding value
        if (old_name !== groupNameInput.value) {
          all_criterias.groups[groupNameInput.value] = all_criterias.groups[old_name];
          delete all_criterias.groups[old_name];
        }
      }

      const selectedHeroes = Array.from(heroCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
      all_criterias.groups[all_criterias.group_form_names[formId]] = all_criterias.groups[all_criterias.group_form_names[formId]] || {"filter": {}};
      all_criterias.groups[all_criterias.group_form_names[formId]].filter.Hero = { precision: "IS-IN", value: selectedHeroes };
      console.log("Changing!");
  }
  heroCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', async () => {
      updateHeroSelection();
       await getDataAndUpdateViz();    
      });
  });

  const formatRadios = formDiv.querySelectorAll('input[name="format"]');
  function updateFormatSelection() {
      const formId = formDiv.id.split('-').pop(); // Extract the group index from the form ID
      const selectedFormat = formDiv.querySelector('input[name="format"]:checked').value;
      all_criterias.groups[all_criterias.group_form_names[formId]] = all_criterias.groups[all_criterias.group_form_names[formId]] || {filter : {}};
      all_criterias.groups[all_criterias.group_form_names[formId]].filter.Format = { precision: "IS", value: selectedFormat };
  }
  formatRadios.forEach(radio => {
    radio.addEventListener('change', async () => {
      updateFormatSelection();
       await getDataAndUpdateViz();    
      });
  });

  const startDateInput = formDiv.querySelector('input[name="start-date"]');
  const endDateInput = formDiv.querySelector('input[name="end-date"]');
  function updateDateRange() {
    const formId = formDiv.id.split('-').pop(); // Extract the group index from the form ID
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    all_criterias.groups[all_criterias.group_form_names[formId]] = all_criterias.groups[all_criterias.group_form_names[formId]] || {filter : {}};
    all_criterias.groups[all_criterias.group_form_names[formId]].filter.Date = { precision: "DATE", value: { min: startDate, max: endDate } }
  };
  [startDateInput, endDateInput].forEach(input => {
    input.addEventListener('change', async () => {
      updateDateRange();
       await getDataAndUpdateViz();    
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

  // Update form
  /*
  if (existingGroupName) {
    updateGroupName();
    updateRankRange();
    updateHeroSelection();
    updateFormatSelection();
    updateDateRange();
  }
    */

  formsContainer.appendChild(formDiv);

  // Adjust group filtering
  //all_criterias.groups[all_criterias.group_form_names[g_index]] = all_criterias.groups[all_criterias.group_form_names[g_index - 1]] || {filter : {}};
  //updateGroupName();
  //updateHeroSelection();
  //updateFormatSelection(); 
  //updateDateRange();
  // If there are matchups in all_criterias, add them to the new group
  if (all_criterias.graphs["parallel_coordinates_matchups"]?.matchups) {
    all_criterias.groups[all_criterias.group_form_names[formId]].filter["Matchups Winrate"] = {
      precision: "COMPOUND",
      value: all_criterias.graphs["parallel_coordinates_matchups"].matchups.reduce((acc, matchup) => {
      acc[matchup.name] = { min: matchup.range.min, max: matchup.range.max };
      return acc;
      }, {})
    };
  }
  // await getDataAndUpdateViz();  
  group_index++;
}

export function addAndUpdateForms(){
  // Clear existing forms
  formsContainer.innerHTML = "";
  Object.keys(all_criterias.group_form_names).forEach((groupIndex) => {
    const numericGroupIndex = parseInt(groupIndex, 10); // Ensure groupIndex is treated as a number
    console.log("Re-adding form for group index:", numericGroupIndex, "with name:", all_criterias.group_form_names[numericGroupIndex]);
    const groupName = all_criterias.group_form_names[numericGroupIndex];
    createForm(groupName);
    // After creating the form, update its fields based on all_criterias
    const formDiv = document.getElementById(`group-form-${numericGroupIndex}`);
    if (formDiv) {
      // Update the form fields based on all_criterias
      const groupNameInput = formDiv.querySelector('input[name="group-name"]');
      groupNameInput.value = groupName;
      const rankInputs = formDiv.querySelectorAll('input[name="rank-min"], input[name="rank-max"]');
      if (all_criterias.groups[groupName]?.filter?.Rank) {
        rankInputs[0].value = all_criterias.groups[groupName].filter.Rank.value.min;
        rankInputs[1].value = all_criterias.groups[groupName].filter.Rank.value.max;
      }
      const heroCheckboxes = formDiv.querySelectorAll('input[name="heroes"]');
      heroCheckboxes.forEach(checkbox => {
        if (all_criterias.groups[groupName]?.filter?.Hero?.precision === "IS-IN") {
          checkbox.checked = all_criterias.groups[groupName]?.filter?.Hero?.value?.includes(checkbox.value) || false;
        } else if (all_criterias.groups[groupName]?.filter?.Hero?.precision === "IS") {
          checkbox.checked = all_criterias.groups[groupName]?.filter?.Hero?.value === checkbox.value;
        }
      });
      const formatRadios = formDiv.querySelectorAll('input[name="format"]');
      formatRadios.forEach(radio => {
        radio.checked = all_criterias.groups[groupName]?.filter?.Format?.value === radio.value;
      });
      const startDateInput = formDiv.querySelector('input[name="start-date"]');
      if (all_criterias.groups[groupName]?.filter?.Date?.value?.start) {
        startDateInput.value = all_criterias.groups[groupName].filter.Date.value.start;
      }
      const endDateInput = formDiv.querySelector('input[name="end-date"]');
      if (all_criterias.groups[groupName]?.filter?.Date?.value?.end) {
        endDateInput.value = all_criterias.groups[groupName].filter.Date.value.end;
      }
    }
  });
  console.log("All criterias after re-adding forms:", JSON.parse(JSON.stringify(all_criterias)));
}

// Listener per aggiungere un nuovo form
addFormBtn.addEventListener('click', () => createForm());

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

export function setLegend(group_names) {
  console.log("Setting legend with group names:", group_names);
  console.log("Current group names:", all_criterias.group_form_names);
  // Remove existing legend if any
  d3.select("#legend").remove();

  // Create a new legend
  const legend = d3.select("body").append("div")
    .attr("id", "legend")
    .style("position", "absolute")
    .style("top", "20px")
    .style("right", "20px")
    .style("background", "rgba(230, 230, 230, 0.9)")
    .style("border", "2px solid #333")
    .style("border-radius", "8px")
    .style("padding", "20px")
    .style("box-shadow", "0px 4px 8px rgba(0, 0, 0, 0.2)")
    .style("font-family", "Arial, sans-serif")
    .style("font-size", "16px")
    .style("color", "#333");

  legend.append("div")
    .style("font-weight", "bold")
    .style("margin-bottom", "12px")
    .text("Legend");

  group_names.forEach(name => {
    const item = legend.append("div")
      .attr("class", "legend-item")
      .style("display", "flex")
      .style("align-items", "center")
      .style("margin-bottom", "8px");

    item.append("span")
      .style("display", "inline-block")
      .style("width", "14px")
      .style("height", "14px")
      .style("margin-right", "10px")
      .style("background-color", color(name))
      .style("border", "1px solid #333")
      .style("border-radius", "50%");

    item.append("span")
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
      .attr("id", `timeseries-line-${group.replaceAll(" ", "")}`)
      .datum(group_data)
      .attr("fill", "none")
      .attr("stroke", color(group))
      .attr("stroke-width", 1.5)
      .attr("d", d3.line()
        .x(function(d) { return x(d.date); })
        .y(function(d) { return y(d.winrate.winrate); })
      );

    // Add hoverable points
    svg.selectAll(`timeseries-circle.group-${group.replaceAll(" ", "")}`)
      .data(group_data)
      .enter()
      .append("circle")
        .attr("class", `group-${group.replaceAll(" ", "")}`)
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

  // Ensure all groups have the matchup filter with current graph filters
  Object.keys(this_graph_filters).forEach(dim => {
    const existingMatchup = all_criterias.graphs["parallel_coordinates_matchups"].matchups.find(matchup => matchup.name === dim);
    if (existingMatchup) {
      existingMatchup.range = this_graph_filters[dim];
    } else {
      all_criterias.graphs["parallel_coordinates_matchups"].matchups.push({
        name: dim,
        range: this_graph_filters[dim]
      });
    }
  });

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

let selected_matchups = [];

export function parallelCoordinatesGraph(name_of_element, data, this_graph_filters){
  console.log("Initializing parallel coordinates graph...");
  
  const button_height = 30;
  const button_margin = 10;

  function createMatchupPopup(form_heroes, all_criterias, name_of_element) {

    // Check if the button already exists to avoid duplicates
    console.log("Creating matchup pop-up...");
    // Add a button to open the pop-up menu
    const addMatchupBtn = document.createElement('button');
    addMatchupBtn.className = 'manage-matchup-btn';
    addMatchupBtn.textContent = 'Manage Matchups';
    addMatchupBtn.style.height = `${button_height}px`;
    addMatchupBtn.style.margin = `${button_margin}px`;
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
      console.log("Selected matchups:", selected_matchups);
      matchupPopup.style.display = 'block';
      // Set checkboxes to checked for existing matchups
      const matchupCheckboxes = matchupPopup.querySelectorAll('.matchup-checkbox');
      matchupCheckboxes.forEach(checkbox => {
        if (selected_matchups.includes(checkbox.value)) {
          checkbox.checked = true;
        }
      });
    });

    matchupPopup.querySelector('#matchup-popup-cancel').addEventListener('click', () => {
      matchupPopup.style.display = 'none';
    });

    matchupPopup.querySelector('#matchup-popup-submit').addEventListener('click', async () => {
      selected_matchups = Array.from(matchupPopup.querySelectorAll('.matchup-checkbox:checked'))
        .map(checkbox => checkbox.value);

      if (selected_matchups.length > 0) {
        if (!all_criterias.graphs["parallel_coordinates_matchups"]) {
          all_criterias.graphs["parallel_coordinates_matchups"] = {
            "type": "parallel_coordinates",
            "matchups": undefined
          };
        }

        // Remove matchups that are no longer selected
        if (all_criterias.graphs["parallel_coordinates_matchups"].matchups) {
          all_criterias.graphs["parallel_coordinates_matchups"].matchups = all_criterias.graphs["parallel_coordinates_matchups"].matchups.filter(matchup =>
            selected_matchups.includes(matchup.name)
          );
        }

        // Cleanup filters in all_criterias.groups that are no longer in selected_matchups
        Object.keys(all_criterias.groups).forEach(group => {
          let matchupsFilter = all_criterias.groups[group].filter;
          matchupsFilter = matchupsFilter["Matchups Winrate"] ? matchupsFilter["Matchups Winrate"] : undefined;
          if (matchupsFilter && matchupsFilter.precision === "COMPOUND") {
            Object.keys(matchupsFilter.value).forEach(matchup => {
              if (!selected_matchups.includes(matchup)) {
          delete matchupsFilter.value[matchup];
              }
            });
          }
        });

        // Add new matchups for selected heroes
        selected_matchups.forEach(hero => {
          if (!all_criterias.graphs["parallel_coordinates_matchups"].matchups) {
            all_criterias.graphs["parallel_coordinates_matchups"].matchups = [];
          }
          if (!all_criterias.graphs["parallel_coordinates_matchups"].matchups.some(matchup => matchup.name === hero)) {
            all_criterias.graphs["parallel_coordinates_matchups"].matchups.push({ name: hero, range: { min: 0, max: 100 } });
          }
        });

        console.log('Matchups added:', selected_matchups);
         await getDataAndUpdateViz();      }

      matchupPopup.style.display = 'none';
    });
  }

  // Call the helper function
  const element = document.querySelector(name_of_element);
  if (!element.querySelector('button.manage-matchup-btn')) {
    createMatchupPopup(form_heroes, all_criterias, element);
  }

  console.log("Extracting dimensions...");
  // Extract the list of dimensions we want to keep in the plot. Here I keep all except the column called Species
  const dimensions = data.Dimensions;
  delete data.Dimensions;
  console.log("Dimensions:", dimensions);

  var margin = {top: 10, right: 0, bottom: 30, left: 0},
      width, height;

  if (dimensions.length === 0) {
    width = 150 - margin.left - margin.right;
  } else {
    width = 150 * dimensions.length - margin.left - margin.right;
  }
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
    .attr("height", height + margin.top + margin.bottom - button_height - button_margin * 2)
  .append("g")
    .attr("transform",
          "translate(" + margin.left + "," + (margin.top + button_margin) + ")");

  console.log("data:", data);

  console.log("Building scales for each dimension...");
  
  console.log("Setting up X scale...");
  // Build the X scale -> it finds the best position for each Y axis
  var x = d3.scalePoint()
    .range([0, width])
    .padding(0.5)
    .domain(dimensions);

  const y_height = height - button_height - button_margin * 2;

  console.log("Setting up Y scales...");
  // For each dimension, I build a linear scale. I store all in a y object
  var y = d3.scaleLinear()
      .domain([0, 100])
      .range([y_height, 0]);

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
      .attr("id", `parallel-graph-line-${group.replaceAll(" ", "")}`)
      .datum(group_data)
      .style("fill", "none")
      .style("stroke", color(group))
      .style("stroke-width", 1.5)
      .attr("d", d3.line()
        .x(function(d) { return x(d.hero); })
        .y(function(d) { return y(d.winrate); })
      );

    // Add hoverable points
    svg.selectAll(`parallel-circle.group-${group.replaceAll(" ", "")}`)
      .data(group_data)
      .enter()
      .append("circle")
        .attr("class", `group-${group.replaceAll(" ", "")}`)
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
      const axisGroup = svg.append("g").attr("class", `filter-squares-${dim.replaceAll(" ", "")}`);

      // Top square (max)
      axisGroup.append("rect")
        .attr("class", `filter-square filter-square-top axis-${dim.replaceAll(" ", "")}`)
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
            .on("end", async function() {
              adjustGroupFilters(data, dim, this_graph_filters);
               await getDataAndUpdateViz();            })
        );

      // Bottom square (min)
      axisGroup.append("rect")
        .attr("class", `filter-square filter-square-bottom axis-${dim.replaceAll(" ", "")}`)
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
            .on("end", async function() {
              adjustGroupFilters(data, dim, this_graph_filters);
               await getDataAndUpdateViz();            })
        );
      });

  console.log("Parallel coordinates graph drawn successfully.");
}

let scatter_updated = false;

export function scatterPlotGraph(name_of_element, graph_data, active = true) {
  console.log("Drawing scatter plot with data:", graph_data);

  let scatterPlotDiv = document.querySelector(name_of_element);
  let warningText;
  let fetchScatterPlotBtn;

  const button_height = 20;
  const button_margin = 5;

  // Set the dimensions and margins of the graph
  const margin = {top: 10, right: 0, bottom: 30, left: 0},
    width = 550 - margin.left - margin.right,
    height = 550 + button_height + button_margin*2 - margin.top - margin.bottom;

  // Set the dimensions of the div container
  scatterPlotDiv.style.width = `${width + margin.left + margin.right}px`;
  scatterPlotDiv.style.height = `${height + margin.top + margin.bottom}px`;

  if (!scatterPlotDiv.querySelector(`#update-scatter-plot-btn`)) {
    console.log("Setting fetch button for scatter plot...");
    // Set the height and ensure alignment of the HTML element
    d3.select(name_of_element)
        .style("height", `${height + margin.top + margin.bottom}px`)
        .style("display", "inline-block")
        .style("vertical-align", "top");

    // Add a button to fetch scatter plot data
    fetchScatterPlotBtn = document.createElement('button');
    fetchScatterPlotBtn.textContent = 'Update Scatter Plot Data';
    fetchScatterPlotBtn.style.height = `${button_height}px`;
    fetchScatterPlotBtn.style.margin = `${button_margin}px`;
    fetchScatterPlotBtn.id = 'update-scatter-plot-btn';
    fetchScatterPlotBtn.style.display = 'inline-block';
    fetchScatterPlotBtn.style.backgroundColor = scatter_updated ? 'green' : 'red';

    // Add hover tooltip
    fetchScatterPlotBtn.addEventListener('mouseover', (event) => {
      tooltip
        .style("display", "block")
        .html(`Heavy calculations, may need several seconds`)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px")
        .style("background-color", "yellow");
    });
    fetchScatterPlotBtn.addEventListener("mousemove", function(event) {
          tooltip
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
    fetchScatterPlotBtn.addEventListener("mouseout", function() {
          tooltip.style("display", "none")
          .style("background-color", "#fff");
        });
    scatterPlotDiv.appendChild(fetchScatterPlotBtn);

    warningText = document.createElement('div');
    warningText.style.display = scatter_updated ? 'none' : 'inline-block';
    warningText.textContent = 'PLOT NOT REFLECTING ACTUAL SELECTIONS';
    warningText.style.color = 'red';
    warningText.style.fontWeight = 'bold';
    warningText.style.marginTop = '5px';
    warningText.id = 'scatter-plot-warning';
    scatterPlotDiv.appendChild(warningText);

    // Add fetch button listener
    fetchScatterPlotBtn.addEventListener('click', async () => {
      try {
        console.log("Fetching scatter plot data...");
        const json_body = {
          filters: all_criterias.filters,
          groups: all_criterias.groups,
          graphs: {
            scatter_plot_card_presence: { "type": "scatter_plot" }
          }
        };
        console.log("Sending request with body:", json_body);

        // Helper function to show a rotating loading indicator
        function showLoadingIndicator(parentElement) {
          const loadingIndicator = document.createElement('div');
          loadingIndicator.className = 'loading-indicator';
          loadingIndicator.style.border = '4px solid #f3f3f3';
          loadingIndicator.style.borderTop = '4px solid #3498db';
          loadingIndicator.style.borderRadius = '50%';
          loadingIndicator.style.width = '30px';
          loadingIndicator.style.height = '30px';
          loadingIndicator.style.animation = 'spin 1s linear infinite';
          loadingIndicator.style.position = 'absolute';
          loadingIndicator.style.top = '50%';
          loadingIndicator.style.left = '50%';
          loadingIndicator.style.transform = 'translate(-50%, -50%)';
          loadingIndicator.style.display = 'block';
          parentElement.style.position = 'relative'; // Ensure parent has relative positioning
          parentElement.appendChild(loadingIndicator);

          // Add CSS for the spinning animation if not already added
          if (!document.querySelector('style#loading-indicator-style')) {
            const style = document.createElement('style');
            style.id = 'loading-indicator-style';
            style.innerHTML = `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
            `;
            document.head.appendChild(style);
          }

          return loadingIndicator;
        }

        // Show loading indicator
        const loadingIndicator = showLoadingIndicator(document.querySelector(name_of_element));
        let response = null;
        let scatterData = null;
        try {
          response = await fetch('http://localhost:3000/api/decklists/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(json_body)
          });

          if (!response.ok) {
            throw new Error(`Failed to fetch scatter plot data. Status: ${response.status}, Status Text: ${response.statusText}`);
          }

          scatterData = await response.json();
          console.log("Fetched scatter plot data successfully:", scatterData);

          // Clear previous scatter plot visualization
          d3.select(name_of_element).html("");

          // Redraw scatter plot with the new data
          scatterPlotGraph(name_of_element, scatterData["scatter_plot_card_presence"]);
        } catch (error) {
          console.error("Error fetching scatter plot data:", error);
        } finally {
          // Remove the loading indicator
          loadingIndicator.remove();
        }
        // Clear previous scatter plot visualization
        d3.select(name_of_element).html("");

        // Redraw scatter plot with the new data
        scatterPlotGraph(name_of_element, scatterData["scatter_plot_card_presence"]);
      } catch (error) {
        console.error("Error fetching scatter plot data:", error);
      }
    });
  }

  if (!scatter_updated) {
    console.log("Scatter plot not updated.");
    warningText = d3.select(`#scatter-plot-warning`);
    warningText.text('PLOT NOT REFLECTING ACTUAL SELECTIONS')
      .style('color', 'red')
      .style('font-weight', 'bold')
      .style('margin-top', '5px')
      .style('display', 'inline-block');

    fetchScatterPlotBtn = d3.select(`#update-scatter-plot-btn`);
    fetchScatterPlotBtn.style('background-color', 'red');
  }else{
    console.log("Scatter plot updated successfully.");
    warningText = d3.select(`#scatter-plot-warning`);
    warningText.style('display', 'none');

    fetchScatterPlotBtn = d3.select(`#update-scatter-plot-btn`);
    fetchScatterPlotBtn.style('background-color', 'green');
  }

  if (active) {

    // Append the svg object to the specified element
    const svg_height = height + margin.top + margin.bottom - button_height - button_margin * 2;
    const svg = d3.select(name_of_element)
      .append("svg")
      .attr("width", width - margin.left - margin.right)
      .attr("height", svg_height)
      .style("display", "block") // Ensure it appears as a block element
      //.style("margin-top", `${button_height + button_margin}px`); // Add margin to appear below the button and warning text

    scatter_updated = true;

    // Extract metadata and remove it from the data object
    const metadata = graph_data.Metadata;
    //delete data.Metadata;
    const data = graph_data.data;

    const graph_margins = 5;

    // Set up the X axis
    const x = d3.scaleLinear()
      .domain([metadata.min_x, metadata.max_x])
      .range([graph_margins * 2, width - margin.right - margin.left - graph_margins*2]);
    svg.append("g")
      .attr("transform", `translate(${0},${svg_height - graph_margins})`)
      .call(d3.axisBottom(x)
      .tickSize(0)
      .tickFormat(''));
      /*
      .append("text")
      .attr("x", width / 2)
      .attr("y", 40)
      .attr("fill", "black")
      .style("text-anchor", "middle")
      .text(metadata.x_label);
      */

    // Set up the Y axis
    const y = d3.scaleLinear()
      .domain([metadata.min_y, metadata.max_y])
      .range([svg_height - graph_margins * 4, 0]);
    svg.append("g")
      .attr("transform", `translate(${graph_margins*2},${graph_margins*3})`)
      .call(d3.axisLeft(y)
      .tickSize(0)
      .tickFormat(''));
      /*
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -svg_height / 2)
      .attr("y", -40)
      .attr("fill", "black")
      .style("text-anchor", "middle")
      .text(metadata.y_label);
      */

    // Add points
    svg.selectAll(`scatter-circle`)
    .data(data, d => d[2].id) // Use d[2].id as the key
    .enter()
    .append("circle")
    .attr("cx", d => x(d[0]))
    .attr("cy", d => y(d[1]))
    .attr("r", 5)
    .attr("transform", `translate(0,${graph_margins*3})`)
    .attr("class", d => `scatter-circle group-${d[2].group.replaceAll(" ", "")}`)
    .attr("fill", d => color(d[2].group))
    .on("mouseover", function (event, d) {
      d3.select(this).attr("fill", "red");
      tooltip
      .style("display", "block")
      .html(`Group: ${d[2].group}<br>Rank: ${d[2].rank}<br>Event: ${d[2].event}<br>Hero: ${d[2].hero}<br>ID: ${d[2].id}`)
      .style("left", (event.pageX + 10) + "px")
      .style("top", (event.pageY - 28) + "px");
    })
    .on("mousemove", function (event) {
      tooltip
      .style("left", (event.pageX + 10) + "px")
      .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function (event, d) {
      d3.select(this).attr("fill", color(d[2].group));
      tooltip.style("display", "none");
    });
  }

    console.log("Scatter plot children are: ", scatterPlotDiv.children);
  console.log("Scatter plot drawn successfully.");
}

const graphs_filters = {};

export async function getDataAndUpdateViz(){
  scatter_updated = false;
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
      // adjust count display
      console.log("data is:", JSON.parse(JSON.stringify(data)));
      console.log("all criteria:", JSON.parse(JSON.stringify(all_criterias)));
      data.grouped_decklists_count.forEach( ([group, count]) => {
        const groupIndex = Object.keys(all_criterias["group_form_names"]).find(key => all_criterias["group_form_names"][key] === group);
        console.log(`Updating count for group ${group}, index ${parseInt(groupIndex[0])}, ${count}`);
        const countElement = document.getElementById(`decklists-analyzed-count-group-${parseInt(groupIndex[0])}`);
        if (countElement) {
          countElement.textContent = `Decklists Analyzed: ${count}`;
        }
      });

      // Draw the graphs
      console.log("Drawing graphs...");
      d3.select("#timeseries_viz").html(""); // Clear previous timeseries visualization if present
      timeseriesGraph("#timeseries_viz", data["timeseries_winrates"]);
      d3.select("#parallel_coordinates_viz").html(""); // Clear previous parallel coordinates visualization if present
      if (graphs_filters["parallel_coordinates_matchups"] === undefined) {
        graphs_filters["parallel_coordinates_matchups"] = {};
      }
      parallelCoordinatesGraph("#parallel_coordinates_viz", data["parallel_coordinates_matchups"], graphs_filters["parallel_coordinates_matchups"]);
      if (data["scatter_plot_card_presence"]) {
        d3.select("#scatter_plot_viz").html(""); // Clear previous scatter plot visualization if present
        scatterPlotGraph("#scatter_plot_viz", data["scatter_plot_card_presence"]);
      } else {
        scatterPlotGraph("#scatter_plot_viz", null, false);
      }
    }
  } catch (error) {
    console.error("Error processing form submission:", error);
  }
}

export async function restartViz(){
  console.log("Form submitted. Processing criteria...");
  const allForms = formsContainer.querySelectorAll('.form-container');
  const groups = {};
  allForms.forEach(form => {
    const formData = new FormData(form);
    console.log("Processing form:", formData);
    const group = {};
    const group_name = formData.get('group-name').trim();

    const heroes = Array.from(form.querySelectorAll('input[name="heroes"]:checked')).map(input => input.value);
    if (heroes.length > 0) {
      group["Hero"] = { "precision": "IS-IN", "value": heroes };
    }
    const format = form.querySelector('input[name="format"]:checked')?.value;
    if (format) {
      group["Format"] = {"precision": "IS", "value": format};
    }
    const startDate = formData.get('start-date');
    const endDate = formData.get('end-date');
    if (startDate && endDate) {
      group["Date"] = {"precision": "DATE", "value": { "min": startDate, "max": endDate }};
    }
    const rankMin = formData.get('rank-min');
    const rankMax = formData.get('rank-max');
    if (rankMin && rankMax) {
      group["Rank"] = { "precision": "RANGE", "value": { "min": parseInt(rankMin, 10), "max": parseInt(rankMax, 10) } };
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
        /*
        ,
        "scatter_plot_card_presence": {
          "type": "scatter_plot"
        }
        */
      }
    };

  console.log("Criteria prepared:", JSON.parse(JSON.stringify(criteria)));
  // Store the criteria and filters for future use
  all_criterias["filters"] = criteria.filters;
  all_criterias["groups"] = criteria.groups;
  all_criterias["graphs"] = criteria.graphs;

    
  try {
    await getDataAndUpdateViz();
  } catch (error) {
    console.error("Error processing form submission:", error);
  }
}

submitAllBtn.addEventListener('click', async () => {
  restartViz();
});

// Load search listener
const searchList = document.getElementById('search-list');

async function loadSearchNames() {
  try {
    const response = await fetch('http://localhost:3000/api/decklists/search/names', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch search names. Status: ${response.status}, ${response.statusText}`);
    }

    const searchNames = await response.json();
    console.log("Fetched search names successfully:", searchNames);

    // Populate the search list dropdown
    searchList.innerHTML = searchNames.map(name => `<option value="${name}">${name}</option>`).join('');
  } catch (error) {
    console.error("Error fetching search names:", error);
    alert("Failed to fetch search names. Check the console for more details.");
  }
}

loadSearchNames();

export function setupLoadSearchListener() {
  const loadSearchBtn = document.getElementById('load-search');

  loadSearchBtn.addEventListener('click', async () => {
    const searchName = document.getElementById('search-list').value;
    if (!searchName) {
      alert("Search name cannot be empty.");
      return;
    }

    try {
      const response = await fetch(`http://localhost:3000/api/decklists/search/load?search_name=${encodeURIComponent(searchName)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Failed to load search. Status: ${response.status}, ${response.statusText}`);
      }

      const loadedSearch = await response.json();
      console.log("Loaded search successfully:", JSON.parse(JSON.stringify(loadedSearch)));

      // Update all_criterias with the loaded search data
      all_criterias.group_form_names = loadedSearch.all_criterias.group_form_names || {};
      all_criterias.filters = loadedSearch.all_criterias.filters || {};
      all_criterias.groups = loadedSearch.all_criterias.groups || {};
      all_criterias.graphs = loadedSearch.all_criterias.graphs || {};

      console.log("Updated all_criterias:", JSON.parse(JSON.stringify(all_criterias)));

      addAndUpdateForms();
      await getDataAndUpdateViz();    
      } catch (error) {
      console.error("Error loading search:", error);
      alert("Failed to load the search. Check the console for more details.");
    }
  });
}

setupLoadSearchListener();

function setupSaveSearchListener() {
  const saveSearchBtn = document.getElementById('save-search');

  saveSearchBtn.addEventListener('click', async () => {
    const searchName = document.getElementById('search-name').value.trim();
    if (!searchName) {
      alert("Search name cannot be empty.");
      return;
    }

    try {
      const response = await fetch('http://localhost:3000/api/decklists/search/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ search_name: searchName, all_criterias })
      });

      if (!response.ok) {
        let responseBody;
        try {
          responseBody = await response.json();
        } catch (error) {
          responseBody = { error: "Failed to parse error response" };
        }
        alert(`Failed to save search. Status: ${response.status}, ${response.statusText}. Error: ${responseBody.error}`);
        throw new Error(`Failed to save search. Status: ${response.status}, ${response.statusText}, ${responseBody.error}`);
      }

      const result = await response.json();
      console.log("Search saved successfully:", result);
      alert("Search saved successfully.");
    } catch (error) {
      console.error("Error saving search:", error);
    }
  });
}

setupSaveSearchListener();

// Aggiungi il primo form all'avvio
if (Object.keys(all_criterias.group_form_names).length === 0) {
  createForm();
}

restartViz();