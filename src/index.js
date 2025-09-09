import * as d3 from 'd3';

let form_heroes, form_formats;
let selections_names = [];
let selections = {};
let allDecklists = [];
let special_decklists = {};
const noGroupColor = '#44AA99';
let zoomActive = false;
let brushActive = false;
let brush;
let isEdited = false;

const waitConst = 300; // milliseconds

// Set the dimensions and margins of the graphs
const general_margin = { top: 10, right: 0, bottom: 30, left: 0 },
  general_width = 300 - general_margin.left - general_margin.right,
  general_height = 250 - general_margin.top - general_margin.bottom;

let all_criterias = {
  filters: {},
  group_form_names: {},
  groups: {},
  graphs: {},
  selections: [],
};

var color;
const range_of_colors = [
  '#E69F00',
  '#56B4E9',
  '#009E73',
  '#F0E442',
  '#0072B2',
  '#D55E00',
  '#CC79A7',
  '#999999',
  '#88CCEE',
];

const formsContainer = document.getElementById('forms-container');
const addFormBtn = document.getElementById('add-form');
const submitAllBtn = document.getElementById('submit-all');
const tableContainer = document.getElementById('table-container');
const filterAndHead = document.getElementById('filters-and-head');

let group_index = 0;

let selected_matchups = [];
let scatter_updated = false;
const graphs_filters = {};

function sanitizeId(str) {
  return String(str)
    .trim()
    .replace(/[^a-zA-Z0-9\-_]/g, '_'); // Replace non-safe chars with underscore
}

function getGradient(groups) {
  const n = groups.length;
  const percent = 100 / n;
  let stops = [];
  for (let i = 0; i < n; i++) {
    const start = i * percent;
    const end = (i + 1) * percent;
    stops.push(`${color(groups[i])} ${start}%`, `${color(groups[i])} ${end}%`);
  }
  const gradient = `linear-gradient(0deg, ${stops.join(', ')})`;
  return gradient;
}

function ensureSVGGradient(svg, groups, colorFn) {
  const sanitizedGroups = groups.map((group) => group.replace(/\s+/g, '-')); // Replace spaces with hyphens
  const gradientId = 'group-gradient-' + sanitizedGroups.join('-');
  // Check if gradient already exists
  if (!svg.select(`#${gradientId}`).node()) {
    const defs = svg.select('defs').empty() ? svg.append('defs') : svg.select('defs');
    const linearGradient = defs
      .append('linearGradient')
      .attr('id', gradientId)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%'); // vertical

    const n = groups.length;
    for (let i = 0; i < n; i++) {
      const start = (i / n) * 100;
      const end = ((i + 1) / n) * 100;
      linearGradient
        .append('stop')
        .attr('offset', `${start}%`)
        .attr('stop-color', colorFn(groups[i]));
      linearGradient
        .append('stop')
        .attr('offset', `${end}%`)
        .attr('stop-color', colorFn(groups[i]));
    }
  }
  return `url(#${gradientId})`;
}

function debounce(func, wait = waitConst) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Listener per aggiungere un nuovo form
addFormBtn.addEventListener('click', () => {
  createForm();
  getDataAndUpdateViz();
});

// Add this once, outside drawViz
const tooltipColor = '#e1e1e1ff';
const tooltip = d3
  .select('body')
  .append('div')
  .attr('id', 'd3-tooltip')
  .style('z-index', '1001')
  .style('position', 'absolute')
  .style('background', tooltipColor)
  .style('border', '1px solid #999')
  .style('padding', '4px 8px')
  .style('pointer-events', 'none')
  .style('display', 'none');

const deleteButton = document.getElementById('delete-selection');
const refreshBtn = document.getElementById('refresh-viz');

export async function getFormData() {
  try {
    const response = await fetch('http://localhost:3000/api/formData', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const formData = await response.json();
    console.log('Form data fetched successfully:', formData);
    form_heroes = formData.heroes;
    form_formats = formData.formats;
  } catch (error) {
    console.error('Error fetching form data:', error);
    form_heroes = [];
    form_formats = [];
  }
  console.log('Available heroes:', form_heroes);
  console.log('Available formats:', form_formats);
}

await getFormData();

// Funzione per creare un nuovo form dinamico

export function createForm(existingGroupName = null) {
  let moniker;
  let groupName;
  let g_index;
  if (existingGroupName !== null) {
    groupName = existingGroupName;
    g_index = Object.keys(all_criterias.group_form_names).find(
      (key) => all_criterias.group_form_names[key] === existingGroupName
    );
    moniker = existingGroupName;
  } else {
    groupName = `Group_${group_index}`;
    moniker = Math.random().toString(36).substring(2, 8); // Generate a random string
    all_criterias['group_form_names'][group_index] = moniker;
    g_index = group_index;
  }
  const formDiv = document.createElement('form');
  formDiv.id = `group-form-${g_index}`;
  formDiv.style.border = '1px solid black';
  formDiv.style.margin = '5px';
  formDiv.classList.add('form-container');
  formDiv.style.fontSize = '8px';
  formDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';

  formDiv.innerHTML = `
    <fieldset style="font-size: 8px;">
    <legend>${groupName}
      <button type="button" class="toggle-form" style="font-size: 8px; background-color: rgba(255, 255, 0, 0.296);">🔽 Hide</button>
    </legend>
    <div class="form-content-container" style="display: flex; gap: 5px; font-size: 8px;">
      <div class="form-section" style="font-size: 8px;">
        <label>Group Name:</label><br>
        <input type="text" name="group-name" value="${moniker}" required style="font-size: 8px;">
        <label>
          <br><input type="checkbox" name="dynamic-group-name" checked style="font-size: 8px;">
          Dynamic
        </label>
        <br><br>
        <label>Rank Range: <span id="rank-help-span" title="Rank 513 means that the player has dropped the tournament">ℹ️</span></label><br>
          <input type="number" name="rank-min" min="1" max="513" value="1" style="width: 30px; font-size: 8px;" oninput="this.nextElementSibling.value = this.value"> 
          <input type="range" name="rank-min" min="1" max="513" value="1" style="width: 60px;" oninput="this.previousElementSibling.value = this.value"> 
          <br>to<br>
          <input type="number" name="rank-max" min="1" max="513" value="512" style="width: 30px; font-size: 8px;" oninput="this.nextElementSibling.value = this.value"> 
          <input type="range" name="rank-max" min="1" max="513" value="512" style="width: 60px;" oninput="this.previousElementSibling.value = this.value"> 
        <br><br>
      </div>
      
      <div class="form-section" style="font-size: 8px;">
        <label>Search Heroes:</label><br>
        <input type="text" class="hero-search" placeholder="Search heroes..." style="width: 120px; font-size: 8px;"><br><br>
        <label>Heroes:</label><br>
        <div style="width: 120px; height: 50px; overflow-y: scroll; border: 1px solid #ccc; padding: 5px; font-size: 8px;">
        ${form_heroes
          .map(
            (hero) => `
          <label class="hero-label" style="font-size: 8px;">
          <input type="checkbox" name="heroes" value="${hero}" style="font-size: 8px;">
          ${hero}
          </label><br>
        `
          )
          .join('')}
        </div>
        <br>
        <button type="button" id="show-special-decklists-${g_index}" style="font-size: 8px;">Show Special Decklists</button>
      </div>
      <div class="form-section" style="font-size: 8px;">
        <label>Format:</label><br>
        ${form_formats
          .map(
            (format) => `
        <label style="font-size: 8px;">
        <input type="radio" name="format" value="${format}" ${
              format === 'Classic Constructed' ? 'checked' : ''
            } required style="font-size: 8px;">
        ${format}
        </label><br>
        `
          )
          .join('')}
        <br>
        <label>Date Range:</label><br>
        <input type="datetime-local" name="start-date" value="2019-01-01T00:00" required style="font-size: 8px;"> to
        <br>
        <input type="datetime-local" name="end-date" max="${new Date()
          .toISOString()
          .slice(0, 16)}" value="${new Date()
    .toISOString()
    .slice(0, 16)}" required style="font-size: 8px;">
        <br><br>
        <div id="decklists-analyzed-count-group-${g_index}" style="font-size: 8px;">n/d</div>
        <button type="button" class="save-form-as-selection" style="font-size: 8px; background-color: rgba(30, 255, 0, 0.3);">Save Decklists Group as Selection ℹ️</button>
        <br>
        <button type="button" class="remove-form" style="font-size: 8px; background-color: rgba(255, 13, 0, 0.3);">❌ Remove Decklist Group</button>
      </div>
    </div>
    </fieldset>
  `;

  // Add hover tooltip for "Show Special Decklists" button
  const showSpecialDecklistsBtn = formDiv.querySelector(`#show-special-decklists-${g_index}`);
  showSpecialDecklistsBtn.addEventListener('mouseover', (event) => {
    tooltip
      .style('display', 'block')
      .html('Show specially excluded or included decklists. To manage them, use the checkboxes in the table.')
      .style('left', event.pageX + 10 + 'px')
      .style('top', event.pageY - 28 + 'px');
  });
  showSpecialDecklistsBtn.addEventListener('mousemove', function (event) {
    tooltip.style('left', event.pageX + 10 + 'px').style('top', event.pageY - 28 + 'px');
  });
  showSpecialDecklistsBtn.addEventListener('mouseout', function () {
    tooltip.style('display', 'none');
  });

  // Add functionality to show special decklists
  showSpecialDecklistsBtn.addEventListener('click', () => {
    const formId = formDiv.id.split('-').pop(); // Extract the group index from the form ID
    const groupName = all_criterias.group_form_names[formId];
    special_decklists[groupName] = special_decklists[groupName] || [];
    const groupSpecialDecklists = Object.values(special_decklists[groupName])
      .map((details) => ({ decklistId: details.listId, type: details.type }));

    // Create the pop-up container
    const popup = d3
      .select('body')
      .append('div')
      .style('position', 'fixed')
      .style('top', '50%')
      .style('left', '50%')
      .style('transform', 'translate(-50%, -50%)')
      .style('background', '#fff')
      .style('border', '1px solid #ccc')
      .style('padding', '20px')
      .style('box-shadow', '0px 4px 6px rgba(0, 0, 0, 0.1)')
      .style('z-index', '1000')
      .style('max-height', '80%')
      .style('overflow-y', 'auto')
      .style('font-size', '10px');

    // Add title
    popup
      .append('h3')
      .text(`Special Decklists for Group: ${groupName}`)
      .style('margin-bottom', '10px');

    // Add a note about whether the List Id filter is exclusive
    const isExclusive = all_criterias.groups[groupName]?.filter?.['List Id']?.value?.exclusive;
    popup
      .append('p')
      .text(`List Id filter is ${isExclusive ? 'exclusive' : 'not exclusive'}.`)
      .style('font-size', '10px')
      .style('margin-bottom', '10px')
      .style('color', isExclusive ? 'red' : 'green');

    // Add decklists divided by category
    const categories = ['added', 'removed'];
    categories.forEach((category) => {
      const categoryDecklists = groupSpecialDecklists.filter((d) => d.type === category);
      if (categoryDecklists.length > 0) {
        const categoryDiv = popup
          .append('div')
          .style('margin-bottom', '10px')
          .style('padding', '10px')
          .style('border', '1px solid black')
          .style('background-color', category === 'added' ? '#d4edda' : '#f8d7da'); // Green for added, red for removed

        categoryDiv
          .append('h4')
          .text(category === 'added' ? 'Added Decklists' : 'Removed Decklists')
          .style('margin-bottom', '5px')
          .style('margin-top', '0px');

        categoryDecklists.forEach((decklist) => {
          categoryDiv.append('div').text(`Decklist ID: ${decklist.decklistId}`);
        });
      }
    });

    // Add close button
    popup
      .append('button')
      .text('Close')
      .style('margin-top', '10px')
      .on('click', () => {
        popup.remove();
      });
  });

  // Add hover tooltip
  const rankHelpSpan = formDiv.querySelector('#rank-help-span');
  rankHelpSpan.addEventListener('mouseover', (event) => {
    tooltip
      .style('display', 'block')
      .html(`Rank 513 means that the player has dropped the tournament`)
      .style('left', event.pageX + 10 + 'px')
      .style('top', event.pageY - 28 + 'px');
  });
  rankHelpSpan.addEventListener('mousemove', function (event) {
    tooltip.style('left', event.pageX + 10 + 'px').style('top', event.pageY - 28 + 'px');
  });
  rankHelpSpan.addEventListener('mouseout', function () {
    tooltip.style('display', 'none');
  });

  // Add listeners to update all_criterias when values change
  const groupNameInput = formDiv.querySelector('input[name="group-name"]');
  function updateGroupName() {
    const formId = formDiv.id.split('-').pop(); // Extract the group index from the form ID
    let newGroupName = groupNameInput.value.replace(',', ' ').replace(/[^a-zA-Z0-9-_ ]/g, ''); // Sanitize input by trimming whitespace and removing special characters
    console.log('New Group Name:', newGroupName, '<formId>', formId);

    // Check for duplicates in all_criterias.groups, excluding the current group
    const isDuplicate = Object.keys(all_criterias.groups).some(
      (existingGroupName) =>
        existingGroupName !== all_criterias.group_form_names[formId] &&
        existingGroupName === newGroupName
    );

    if (isDuplicate) {
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
  groupNameInput.addEventListener(
    'input',
    debounce(async () => {
      formDiv.querySelector('input[name="dynamic-group-name"]').checked = false;
      const newGroupName = updateGroupName();
      formDiv.querySelector('input[name="group-name"]').value = newGroupName;
      await getDataAndUpdateViz();
    })
  );

  const rankInputs = formDiv.querySelectorAll('input[name="rank-min"], input[name="rank-max"]');
  function updateRankRange() {
    const formId = formDiv.id.split('-').pop(); // Extract the group index from the form ID
    const rankMin = formDiv.querySelector('input[name="rank-min"]').value;
    const rankMax = formDiv.querySelector('input[name="rank-max"]').value;
    all_criterias.groups[all_criterias.group_form_names[formId]] = all_criterias.groups[
      all_criterias.group_form_names[formId]
    ] || { filter: {} };
    all_criterias.groups[all_criterias.group_form_names[formId]].filter.Rank = {
      precision: 'RANGE',
      value: { min: rankMin, max: rankMax },
    };
  }
  rankInputs.forEach((input) => {
    input.addEventListener(
      'input',
      debounce(async () => {
        updateRankRange();
        await getDataAndUpdateViz();
      })
    );
  });

  const heroCheckboxes = formDiv.querySelectorAll('input[name="heroes"]');
  function updateHeroSelection() {
    const formId = formDiv.id.split('-').pop(); // Extract the group index from the form ID
    //Change name if name is standard
    if (formDiv.querySelector('input[name="dynamic-group-name"]').checked) {
      const selectedHeroes = Array.from(heroCheckboxes)
        .filter((cb) => cb.checked)
        .map((cb) => cb.value);

      let new_name;
      if (selectedHeroes.length === 0) {
        new_name = Math.random().toString(36).substring(2, 8); // Generate a random string
      } else if (selectedHeroes.length === 1) {
        new_name = selectedHeroes[0];
      } else {
        new_name = selectedHeroes.map((hero) => hero.slice(0, 3)).join('-');
      }

      let newGroupName = new_name.trim().replace(/[^a-zA-Z0-9-_ ]/g, ''); // Sanitize input by removing special characters but keep whitespaces
      // Check for duplicates in all_criterias.groups
      if (Object.keys(all_criterias.groups).includes(newGroupName)) {
        const randomSuffix = Math.random().toString(36).substring(2, 6); // Generate a random short string
        newGroupName = `${newGroupName}_${randomSuffix}`;
      }
      console.log('New Group Name:', newGroupName, 'Would be name:', new_name);
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
      .filter((cb) => cb.checked)
      .map((cb) => cb.value);
    all_criterias.groups[all_criterias.group_form_names[formId]] = all_criterias.groups[
      all_criterias.group_form_names[formId]
    ] || { filter: {} };
    if (selectedHeroes.length > 0) {
      all_criterias.groups[all_criterias.group_form_names[formId]].filter.Hero = {
        precision: 'IS-IN',
        value: selectedHeroes,
      };
    } else {
      delete all_criterias.groups[all_criterias.group_form_names[formId]].filter.Hero;
    }
    console.log('Changing!');
  }
  heroCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener('change', async () => {
      updateHeroSelection();
      await getDataAndUpdateViz();
    });
  });

  const formatRadios = formDiv.querySelectorAll('input[name="format"]');
  function updateFormatSelection() {
    const formId = formDiv.id.split('-').pop(); // Extract the group index from the form ID
    const selectedFormat = formDiv.querySelector('input[name="format"]:checked').value;
    all_criterias.groups[all_criterias.group_form_names[formId]] = all_criterias.groups[
      all_criterias.group_form_names[formId]
    ] || { filter: {} };
    all_criterias.groups[all_criterias.group_form_names[formId]].filter.Format = {
      precision: 'IS',
      value: selectedFormat,
    };
  }
  formatRadios.forEach((radio) => {
    radio.addEventListener(
      'change',
      debounce(async () => {
        updateFormatSelection();
        await getDataAndUpdateViz();
      })
    );
  });

  const startDateInput = formDiv.querySelector('input[name="start-date"]');
  const endDateInput = formDiv.querySelector('input[name="end-date"]');
  function updateDateRange() {
    const formId = formDiv.id.split('-').pop(); // Extract the group index from the form ID
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    all_criterias.groups[all_criterias.group_form_names[formId]] = all_criterias.groups[
      all_criterias.group_form_names[formId]
    ] || { filter: {} };
    all_criterias.groups[all_criterias.group_form_names[formId]].filter.Date = {
      precision: 'DATE',
      value: { min: startDate, max: endDate },
    };
  }
  [startDateInput, endDateInput].forEach((input) => {
    input.addEventListener(
      'change',
      debounce(async () => {
        updateDateRange();
        await getDataAndUpdateViz();
      })
    );
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
    heroLabels.forEach((label) => {
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

  // Add listener to save the group as selection
  formDiv.querySelector('.save-form-as-selection').addEventListener('click', async () => {
    const formId = formDiv.id.split('-').pop(); // Extract the group index from the form ID
    const groupName = all_criterias.group_form_names[formId];
    if (!groupName) {
      alert('Group name is missing. Cannot save the group as a selection.');
      return;
    }

    try {
      let json_body = {
        name: groupName,
        selections: all_criterias.selections,
        filter: all_criterias.groups[groupName],
      };
      delete json_body.filter;
      json_body['filter'] = all_criterias.groups[groupName].filter;
      const response = await fetch('http://localhost:3000/api/decklists/selection/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json_body),
      });

      if (!response.ok) {
        let responseBody;
        try {
          responseBody = await response.json();
        } catch (error) {
          responseBody = { error: 'Failed to parse error response' };
        }
        alert(
          `Failed to save selection. Status: ${response.status}, ${response.statusText}. Error: ${responseBody.error}`
        );
        throw new Error(
          `Failed to save selection. Status: ${response.status}, ${response.statusText}, ${responseBody.error}`
        );
      }

      const result = await response.json();
      console.log('Group saved as selection successfully:', result);
      await loadSelectionNames(); // Refresh the selection names
      await loadAllSelections(); // Refresh all selections
      console.log('Selection refreshed successfully.');
      alert(`Group "${groupName}" saved as a selection successfully.`);
    } catch (error) {
      console.error('Error saving group as selection:', error);
    }
  });

  // Add hover tooltip for save-form-as-selection button
  const saveFormAsSelectionBtn = formDiv.querySelector('.save-form-as-selection');
  saveFormAsSelectionBtn.addEventListener('mouseover', (event) => {
    tooltip
      .style('display', 'block')
      .html(
        `Save the current group as a selection (as a static list of Decklists IDs) for future use.
        <br>
        You can then select it later from the parallel coordinates graph to use it for matchups analysis and filtering.
        <br>
        You can also delete it from the Delete Selection menu.`
      )
      .style('left', event.pageX + 10 + 'px')
      .style('top', event.pageY - 28 + 'px');
  });
  saveFormAsSelectionBtn.addEventListener('mousemove', function (event) {
    tooltip.style('left', event.pageX + 10 + 'px').style('top', event.pageY - 28 + 'px');
  });
  saveFormAsSelectionBtn.addEventListener('mouseout', function () {
    tooltip.style('display', 'none');
  });

  // Add listener to the remove button
  formDiv.querySelector('.remove-form').addEventListener('click', () => {
    const formId = formDiv.id.split('-').pop(); // Extract the group index from the form ID
    const groupName = all_criterias.group_form_names[formId];
    delete all_criterias.groups[groupName];
    delete all_criterias.group_form_names[formId];
    all_criterias.graphs.parallelCoordinatesGraph?.[groupName]
      ? delete all_criterias.graphs.parallelCoordinatesGraph[groupName]
      : null;
    formDiv.remove();
    getDataAndUpdateViz();
  });

  formsContainer.appendChild(formDiv);

  const formId = formDiv.id.split('-').pop(); // Extract the group index from the form ID
  all_criterias.groups[all_criterias.group_form_names[formId]] = all_criterias.groups[
    all_criterias.group_form_names[formId]
  ] || { filter: {} };
  const groupFilter = all_criterias.groups[all_criterias.group_form_names[formId]].filter;

  // Set default filters if not present
  if (!groupFilter.Date) {
    groupFilter.Date = {
      precision: 'DATE',
      value: { min: startDateInput.value, max: endDateInput.value },
    };
  }
  if (!groupFilter.Format) {
    groupFilter.Format = {
      precision: 'IS',
      value: formDiv.querySelector('input[name="format"]:checked').value,
    };
  }
  if (!groupFilter.Rank) {
    groupFilter.Rank = {
      precision: 'RANGE',
      value: { min: rankInputs[0].value, max: rankInputs[2].value },
    };
  }
  // If there are matchups in all_criterias, add them to the new group
  if (all_criterias.graphs['parallel_coordinates_matchups']?.matchups?.length > 0) {
    all_criterias.groups[all_criterias.group_form_names[formId]] = all_criterias.groups[
      all_criterias.group_form_names[formId]
    ] || { filter: {} };
    all_criterias.groups[all_criterias.group_form_names[formId]].filter['Matchups Winrate'] = {
      precision: 'COMPOUND',
      value: all_criterias.graphs['parallel_coordinates_matchups'].matchups.reduce(
        (acc, matchup) => {
          acc[matchup.name] = {
            type: matchup.type,
            min: matchup.range.min,
            max: matchup.range.max,
          };
          return acc;
        },
        {}
      ),
    };
  }
  // await getDataAndUpdateViz();
  group_index++;
}

export function addAndUpdateForms() {
  // Clear existing forms
  formsContainer.innerHTML = '';
  Object.keys(all_criterias.group_form_names).forEach((groupIndex) => {
    const numericGroupIndex = parseInt(groupIndex, 10); // Ensure groupIndex is treated as a number
    console.log(
      'Re-adding form for group index:',
      numericGroupIndex,
      'with name:',
      all_criterias.group_form_names[numericGroupIndex]
    );
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
      heroCheckboxes.forEach((checkbox) => {
        if (all_criterias.groups[groupName]?.filter?.Hero?.precision === 'IS-IN') {
          checkbox.checked =
            all_criterias.groups[groupName]?.filter?.Hero?.value?.includes(checkbox.value) || false;
        } else if (all_criterias.groups[groupName]?.filter?.Hero?.precision === 'IS') {
          checkbox.checked =
            all_criterias.groups[groupName]?.filter?.Hero?.value === checkbox.value;
        }
      });
      const formatRadios = formDiv.querySelectorAll('input[name="format"]');
      formatRadios.forEach((radio) => {
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
  console.log('All criterias after re-adding forms:', JSON.parse(JSON.stringify(all_criterias)));
}

export async function fetchDecklists(criteria) {
  console.log('Fetching decklists with criteria:', criteria);
  try {
    const response = await fetch('http://localhost:3000/api/decklists/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(criteria),
    });

    if (!response.ok) {
      console.error('Failed to fetch decklists. Status:', response.status, response.statusText);
      return [];
    }

    const data = await response.json();
    console.log('Fetched decklists successfully:', data);
    return data;
  } catch (error) {
    console.error('Error fetching decklists:', error);
    return [];
  }
}

export function setLegend(group_names) {
  console.log('Setting legend with group names:', group_names);
  console.log('Current group names:', all_criterias.group_form_names);
  // Remove existing legend if any
  d3.select('#legend').remove();

  // Create a new legend
  const legend = d3
    .select('#visualizations')
    .append('div')
    .attr('id', 'legend')
    .style('display', 'inline-block')
    .style('background', 'rgba(230, 230, 230, 0.9)')
    .style('border', '2px solid #333')
    .style('border-radius', '8px')
    .style('margin-left', '5px')
    .style('padding', '5px')
    .style('box-shadow', '0px 4px 8px rgba(0, 0, 0, 0.2)')
    .style('font-family', 'Arial, sans-serif')
    .style('font-size', '10px');

  legend.append('div').style('font-weight', 'bold').style('margin-bottom', '12px').text('Legend');

  group_names.forEach((name) => {
    const item = legend
      .append('div')
      .attr('class', 'legend-item')
      .style('display', 'flex')
      .style('align-items', 'center')
      .style('margin-bottom', '5px');

    item
      .append('span')
      .style('display', 'inline-block')
      .style('width', '10px')
      .style('height', '10px')
      .style('margin-right', '5px')
      .style('background-color', color(name))
      .style('border', '1px solid #333')
      .style('border-radius', '50%');

    item.append('span').text(name);
  });
}

export function getUpdatedDecklists(data) {
  // Create a copy of allDecklists and prepare it for easy lookup
  let updatedDecklists = allDecklists != [] ? JSON.parse(JSON.stringify(allDecklists)) : data;

  updatedDecklists = Object.entries(updatedDecklists).flatMap(([group, decklists]) =>
    decklists.map((decklist) => ({ group: [], decklist }))
  );

  data = Object.entries(data).flatMap(([group, decklists]) =>
    decklists.map((decklist) => ({ group, decklist }))
  );

  // Update the copy with the decklists in data
  updatedDecklists.forEach((obj) => {
    const dataDecklists = data.filter(
      (d) => d.decklist.Metadata['List Id'] === obj.decklist.Metadata['List Id']
    );
    let groups = [];
    if (dataDecklists.length > 0) {
      dataDecklists.forEach((existingDecklist) => {
        if (Array.isArray(existingDecklist.group)) {
          groups = groups.concat(existingDecklist.group);
        } else {
          groups.push(existingDecklist.group);
        }
      });
      groups = Array.from(new Set(groups)).filter((g) => g !== undefined && g !== null && g !== '');
      if (groups.length === 0) groups = ['No Group'];
    } else {
      groups = ['No Group'];
    }
    obj.group = groups;
  });

  return updatedDecklists;
}

export function timeseriesGraph(name_of_element, data) {
  console.log('Drawing visualization with data:', data);

  d3.select(name_of_element).html(''); // Clear previous viz
  // set the dimensions and margins of the graph

  const width = parseInt(general_width * 0.7);
  const height = general_height;
  const margin = {
    top: general_margin.top,
    right: general_margin.right + 10,
    bottom: general_margin.bottom -3,
    left: general_margin.left + 30,
  };

  // append the svg object to the body of the page
  var svg = d3
    .select(name_of_element)
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

  const metadata = data.Metadata;
  delete data.Metadata;

  const x = d3
    .scaleTime()
    .domain([new Date(metadata.min_date), new Date(metadata.max_date)])
    .range([0, width]);
  svg
    .append('g')
    .attr('transform', 'translate(0,' + height + ')')
    .call(d3.axisBottom(x).ticks(Math.round(width / 100)));

  const y = d3.scaleLinear().domain([0, 100]).range([height, 0]);
  svg.append('g').call(d3.axisLeft(y));

  // Parse date strings into Date objects
  Object.values(data).forEach((groupData) => {
    groupData.forEach((d) => {
      d.date = new Date(d.date);
      d.winrate.winrate = parseFloat(d.winrate.winrate); // Ensure winrate is a number
    });
  });

  Object.entries(data).forEach(([group, group_data]) => {
    // Add the line
    svg
      .append('path')
      .attr('id', `timeseries-line-${group.replaceAll(' ', '')}`)
      .datum(group_data)
      .attr('fill', 'none')
      .attr('stroke', color(group))
      .attr('stroke-width', 1.5)
      .attr(
        'd',
        d3
          .line()
          .x(function (d) {
            return x(d.date);
          })
          .y(function (d) {
            return y(d.winrate.winrate);
          })
      );

    // Add hoverable points
    svg
      .selectAll(`timeseries-circle.group-${group.replaceAll(' ', '')}`)
      .data(group_data)
      .enter()
      .append('circle')
      .attr('class', `group-${group.replaceAll(' ', '')}`)
      .attr('cx', (d) => x(d.date))
      .attr('cy', (d) => y(d.winrate.winrate))
      .attr('r', 5)
      .attr('fill', color(group))
      .on('mouseover', function (event, d) {
        d3.select(this).attr('fill', 'red');
        tooltip
          .style('display', 'block')
          .html(
            `Group: ${group}<br>Date: ${d.date.toLocaleDateString()}<br>Played Rounds: ${
              d.winrate.playedRounds
            }<br>Winrate: ${d.winrate.winrate.toFixed(2)}%`
          )
          .style('left', event.pageX + 10 + 'px')
          .style('top', event.pageY - 28 + 'px');
      })
      .on('mousemove', function (event) {
        tooltip.style('left', event.pageX + 10 + 'px').style('top', event.pageY - 28 + 'px');
      })
      .on('mouseout', function () {
        d3.select(this).attr('fill', color(group));
        tooltip.style('display', 'none');
      });
  });

  console.log('Visualization drawn successfully.');
}

export function adjustGroupFilters(data, dim, this_graph_filters) {
  // Ensure all groups have the matchup filter with current graph filters
  Object.keys(this_graph_filters).forEach((dim) => {
    const existingMatchup = all_criterias.graphs['parallel_coordinates_matchups'].matchups.find(
      (matchup) => matchup.name === dim
    );
    if (existingMatchup) {
      existingMatchup.range = this_graph_filters[dim];
    } else {
      all_criterias.graphs['parallel_coordinates_matchups'].matchups.push({
        name: dim,
        type: selections_names.includes(dim) ? 'selection' : 'hero',
        range: this_graph_filters[dim],
      });
    }
  });

  Object.entries(data).forEach(([group, group_data]) => {
    let group_filter = all_criterias['groups'][group];
    if (group_filter['filter']['Matchups Winrate'] === undefined) {
      group_filter['filter']['Matchups Winrate'] = {
        precision: 'COMPOUND',
        value: {},
      };
    }
    if (group_filter['filter']['Matchups Winrate']['value'][dim] === undefined) {
      group_filter['filter']['Matchups Winrate']['value'][dim] = {
        type: selections_names.includes(dim) ? 'selection' : 'hero',
        min: this_graph_filters[dim].min,
        max: this_graph_filters[dim].max,
      };
    }
    group_filter['filter']['Matchups Winrate']['value'][dim] = {
      type: selections_names.includes(dim) ? 'selection' : 'hero',
      min: this_graph_filters[dim].min,
      max: this_graph_filters[dim].max,
    };
  });
}

export function parallelCoordinatesGraph(name_of_element, data, this_graph_filters) {
  console.log('Initializing parallel coordinates graph...');
  console.log('Data for parallel coordinates graph:', JSON.parse(JSON.stringify(data)));

  const margin = general_margin;
  let width = general_width;
  const height = general_height;

  const button_height = 20;
  const button_margin = 10;

  function createMatchupPopup(form_heroes, all_criterias, name_of_element) {
    // Check if the button already exists to avoid duplicates
    console.log('Creating matchup pop-up...');
    // Add a button to open the pop-up menu
    const addMatchupBtn = document.createElement('button');
    addMatchupBtn.className = 'manage-matchup-btn';
    addMatchupBtn.textContent = 'Manage Matchups';
    addMatchupBtn.style.height = `${button_height}px`;
    addMatchupBtn.style.margin = `${button_margin}px`;
    addMatchupBtn.style.backgroundColor = 'rgba(255, 255, 0, 0.296)';
    addMatchupBtn.style.fontSize = '10px';
    name_of_element.appendChild(addMatchupBtn);

    // Add hover tooltip for addMatchupBtn
    addMatchupBtn.addEventListener('mouseover', (event) => {
      tooltip
        .style('display', 'block')
        .html(
          `Click to manage matchups for the parallel coordinates graph. You can add or remove heroes or selections as matchups.`
        )
        .style('left', event.pageX + 10 + 'px')
        .style('top', event.pageY - 28 + 'px');
    });
    addMatchupBtn.addEventListener('mousemove', function (event) {
      tooltip.style('left', event.pageX + 10 + 'px').style('top', event.pageY - 28 + 'px');
    });
    addMatchupBtn.addEventListener('mouseout', function () {
      tooltip.style('display', 'none');
    });

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
      ${selections_names
      .map(
        (selection) => `
        <label class="matchup-label" style="background-color:${color(selection)}">
        <input type="checkbox" class="matchup-checkbox" id="matchup-input-${selection}" value="${selection}" 
        ${all_criterias.graphs['parallel_coordinates_matchups']?.matchups?.some((m) => m.name === selection) ? 'checked' : ''}>
        Group: ${selection}
        </label><br>
      `
      )
      .join('')}
      ${form_heroes
        .map(
        (hero) => `
        <label>
        <input type="checkbox" class="matchup-checkbox" value="${hero}" 
        ${all_criterias.graphs['parallel_coordinates_matchups']?.matchups?.some((m) => m.name === hero) ? 'checked' : ''}>
        ${hero}
        </label><br>
      `
        )
        .join('')}
      
      </div>
      <br>
      <button id="matchup-popup-submit">Submit</button>
      <button id="matchup-popup-cancel">Cancel</button>
    `;

    // Add hover tooltip for selection options
    const selectionLabels = matchupPopup.querySelectorAll('label.matchup-label');
    selectionLabels.forEach((label) => {
      label.addEventListener('mouseover', (event) => {
        const label_content = label.textContent.split(':')[1].trim();
        const selection_data = selections[label_content]
          ? selections[label_content]
          : loadSelection(label_content);
        selections[label_content] = selection_data;
        let info_html = `Selection: ${label_content}`;
        info_html += `<br>N. Decklists: ${selection_data.n_decklists}`;
        info_html += `<br>Date: ${selection_data.date}`;
        info_html += `<br>Filter:<br>${Object.entries(selection_data.filter)
          .map(([key, value]) => `${key}: ${JSON.stringify(value, null, 2)}`)
          .join('<br>')}`;
        tooltip
          .style('display', 'block')
          .html(info_html)
          .style('left', event.pageX + 100 + 'px')
          .style('top', event.pageY - 28 + 'px');
      });
      label.addEventListener('mousemove', function (event) {
        tooltip.style('left', event.pageX + 100 + 'px').style('top', event.pageY - 28 + 'px');
      });
      label.addEventListener('mouseout', function () {
        tooltip.style('display', 'none');
      });
    });

    // Add event listeners for the pop-up menu
    addMatchupBtn.addEventListener('click', () => {
      console.log('Selected matchups:', selected_matchups);
      matchupPopup.style.display = 'block';
      // Set checkboxes to checked for existing matchups
      const matchupCheckboxes = matchupPopup.querySelectorAll('.matchup-checkbox');
      matchupCheckboxes.forEach((checkbox) => {
        if (selected_matchups.includes(checkbox.value)) {
          checkbox.checked = true;
        }
        const selectionLabels = matchupPopup.querySelectorAll('label.matchup-label');
      });
    });

    matchupPopup.querySelector('#matchup-popup-cancel').addEventListener('click', () => {
      matchupPopup.style.display = 'none';
    });

    matchupPopup.querySelector('#matchup-popup-submit').addEventListener('click', async () => {
      selected_matchups = Array.from(
        matchupPopup.querySelectorAll('.matchup-checkbox:checked')
      ).map((checkbox) => checkbox.value);

      if (selected_matchups.length > 0) {
        if (!all_criterias.graphs['parallel_coordinates_matchups']) {
          all_criterias.graphs['parallel_coordinates_matchups'] = {
            type: 'parallel_coordinates',
            matchups: undefined,
          };
        }

        // Remove matchups that are no longer selected
        if (all_criterias.graphs['parallel_coordinates_matchups'].matchups) {
          all_criterias.graphs['parallel_coordinates_matchups'].matchups = all_criterias.graphs[
            'parallel_coordinates_matchups'
          ].matchups.filter((matchup) => selected_matchups.includes(matchup.name));
        }

        // Cleanup filters in all_criterias.groups that are no longer in selected_matchups
        Object.keys(all_criterias.groups).forEach((group) => {
          let matchupsFilter = all_criterias.groups[group].filter;
          matchupsFilter = matchupsFilter['Matchups Winrate']
            ? matchupsFilter['Matchups Winrate']
            : undefined;
          if (matchupsFilter && matchupsFilter.precision === 'COMPOUND') {
            Object.keys(matchupsFilter.value).forEach((matchup) => {
              if (!selected_matchups.includes(matchup)) {
                delete matchupsFilter.value[matchup];
                if (selections_names.includes(matchup)) {
                  all_criterias.selections = all_criterias.selections.filter(
                    (selection) => selection !== matchup
                  );
                }
              }
            });
          }
        });

        // Add new matchups for selected matchups
        selected_matchups.forEach((matchup) => {
          if (!all_criterias.graphs['parallel_coordinates_matchups'].matchups) {
            all_criterias.graphs['parallel_coordinates_matchups'].matchups = [];
          }
          if (
            !all_criterias.graphs['parallel_coordinates_matchups'].matchups.some(
              (m) => m.name === matchup
            )
          ) {
            if (selections_names.includes(matchup)) {
              if (!all_criterias.selections) {
                all_criterias.selections = [];
              }
              all_criterias.selections.push(matchup);
              all_criterias.graphs['parallel_coordinates_matchups'].matchups.push({
                name: matchup,
                type: 'selection',
                range: { min: 0, max: 100 },
              });
            } else {
              all_criterias.graphs['parallel_coordinates_matchups'].matchups.push({
                name: matchup,
                type: 'hero',
                range: { min: 0, max: 100 },
              });
            }
          }
        });

        console.log('Matchups added:', selected_matchups);
        await getDataAndUpdateViz();
      }

      matchupPopup.style.display = 'none';
    });
  }

  // Call the helper function
  const element = document.querySelector(name_of_element);
  if (!element.querySelector('button.manage-matchup-btn')) {
    createMatchupPopup(form_heroes, all_criterias, element);
  }

  console.log('Extracting dimensions...');
  // Extract the list of dimensions we want to keep in the plot. Here I keep all except the column called Species
  const dimensions = [...data.Dimensions];
  delete data.Dimensions;
  delete data.selections;
  console.log('Dimensions:', dimensions);
  data = JSON.parse(JSON.stringify(data)); // Deep copy to avoid mutation issues

  const ideal_width = dimensions.length * 75;
  if (ideal_width > general_width) {
    width = ideal_width;
  }

  // Set the size of the HTML element
  d3.select(name_of_element)
    .style('width', `${width + margin.left + margin.right}px`)
    .style('height', `${height + margin.top + margin.bottom}px`);

  console.log('Setting up SVG canvas...');
  // append the svg object to the body of the page
  var svg = d3
    .select(name_of_element)
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom - button_height - button_margin * 2)
    .append('g')
    .attr('transform', 'translate(' + margin.left + ',' + (margin.top + button_margin) + ')');

  console.log('Building scales for each dimension...');

  console.log('Setting up X scale...');
  // Build the X scale -> it finds the best position for each Y axis
  var x = d3.scalePoint().range([0, width]).padding(0.5).domain(dimensions);

  const y_height = height - button_height - button_margin * 2;

  console.log('Setting up Y scales...');
  // For each dimension, I build a linear scale. I store all in a y object
  var y = d3.scaleLinear().domain([0, 100]).range([y_height, 0]);

  console.log('Y scale:', y);

  /*
  for (const name of dimensions) {
    svg.append("g")
      .attr("class", `y-axis y-axis-${name}`)
      .attr("transform", `translate(${x(name)}, 0)`)
      .call(d3.axisLeft().scale(y));
  }
      */
  console.log('Data before processing:', JSON.parse(JSON.stringify(data)));
  // Reorder group_data to match the order of dimensions
  Object.entries(data).forEach(([group, group_data]) => {
    console.log(`Reordering data for group: ${group}`);
    //console.log("Original group data:", group_data);
    const correct_order = [];
    dimensions.forEach((d) => {
      const found = group_data.filter((g) => g.matchup === d)[0];
      if (found) {
        correct_order.push(found);
      }
    });
    data[group] = correct_order; // Update the original data object
    //console.log("Reordered group data:", data[group]);
  });
  console.log('Data after processing:', JSON.parse(JSON.stringify(data)));

  //console.log("Reordered data for each group:", data);

  console.log('Drawing lines and points for each group...');
  Object.entries(data).forEach(([group, group_data]) => {
    console.log(`Processing group: ${group}`);
    console.log('Group data:', group_data);

    // Draw the lines
    svg
      .append('path')
      .attr('id', `parallel-graph-line-${group.replaceAll(' ', '')}`)
      .datum(group_data)
      .style('fill', 'none')
      .style('stroke', color(group))
      .style('stroke-width', 1.5)
      .attr(
        'd',
        d3
          .line()
          .x(function (d) {
            return x(d.matchup);
          })
          .y(function (d) {
            return y(d.winrate);
          })
      );

    // Add hoverable points
    svg
      .selectAll(`parallel-circle.group-${group.replaceAll(' ', '')}`)
      .data(group_data)
      .enter()
      .append('circle')
      .attr('class', `group-${group.replaceAll(' ', '')}`)
      .attr('cx', (d) => x(d.matchup))
      .attr('cy', (d) => y(d.winrate))
      .attr('r', 5)
      .attr('fill', color(group))
      .on('mouseover', function (event, d) {
        d3.select(this).attr('fill', 'red');
        tooltip
          .style('display', 'block')
          .html(
            `Group: ${group}<br>Matchup: ${d.matchup}<br>Played Rounds: ${
              d.playedRounds
            }<br>Winrate: ${d.winrate.toFixed(2)}%`
          )
          .style('left', event.pageX + 10 + 'px')
          .style('top', event.pageY - 28 + 'px');
      })
      .on('mousemove', function (event) {
        tooltip.style('left', event.pageX + 10 + 'px').style('top', event.pageY - 28 + 'px');
      })
      .on('mouseout', function () {
        d3.select(this).attr('fill', color(group));
        tooltip.style('display', 'none');
      });
  });

  console.log('Drawing axes...');
  // Draw the axis:
  svg
    .selectAll('myAxis')
    // For each dimension of the dataset I add a 'g' element:
    .data(dimensions)
    .enter()
    .append('g')
    // I translate this element to its right position on the x axis
    .attr('transform', function (d) {
      return 'translate(' + x(d) + ')';
    })
    // And I build the axis with the call function
    .each(function (d) {
      d3.select(this).call(d3.axisLeft().scale(y));
    })
    // Add axis title
    .append('text')
    .style('text-anchor', 'middle')
    .attr('y', -9)
    .each(function (d) {
      const text = d3.select(this);
      const label = String(d);
      if (dimensions.length > 2) {
        const words = String(d).split(' ');
        text.text(words.slice(0, 2).join(' '));
      } else {
        text.text(label);
      }
    })
    .on('mouseover', function (event, d) {
      if (dimensions.length > 2) {
        tooltip
          .style('display', 'block')
          .html(`${d}`)
          .style('left', event.pageX + 10 + 'px')
          .style('top', event.pageY - 28 + 'px');
      }
    })
    .on('mousemove', function (event) {
      if (dimensions.length > 2) {
        tooltip.style('left', event.pageX + 10 + 'px').style('top', event.pageY - 28 + 'px');
      }
    })
    .on('mouseout', function () {
      tooltip.style('display', 'none');
    })
    .style('fill', (d) => (selections_names.includes(d) ? color(d) : 'black'))
    .style('font-size', '8px');

  // Add movable point for filters
  let yMin, yMax;
  dimensions.forEach((dim) => {
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
    const axisGroup = svg.append('g').attr('class', `filter-squares-${dim.replaceAll(' ', '')}`);

    // Top square (max)
    axisGroup
      .append('rect')
      .attr('class', `filter-square filter-square-top axis-${dim.replaceAll(' ', '')}`)
      .attr('x', x(dim) - 4)
      .attr('y', yMax)
      .attr('width', 8)
      .attr('height', 8)
      .attr('fill', '#ff7f0e')
      .call(
        d3
          .drag()
          .on('drag', function (event) {
            let newY = Math.max(y.range()[1], Math.min(y.range()[0], event.y));
            // Prevent crossing the bottom square
            const bottomY = +axisGroup.select('.filter-square-bottom').attr('y');
            newY = Math.min(newY, bottomY);
            d3.select(this).attr('y', newY);
            const newMax = y.invert(newY);
            this_graph_filters[dim].max = newMax;
          })
          .on('end', async function () {
            adjustGroupFilters(data, dim, this_graph_filters);
            await getDataAndUpdateViz();
          })
      );

    // Bottom square (min)
    axisGroup
      .append('rect')
      .attr('class', `filter-square filter-square-bottom axis-${dim.replaceAll(' ', '')}`)
      .attr('x', x(dim) - 4)
      .attr('y', yMin)
      .attr('width', 8)
      .attr('height', 8)
      .attr('fill', '#1f77b4')
      .call(
        d3
          .drag()
          .on('drag', function (event) {
            let newY = Math.max(y.range()[1], Math.min(y.range()[0], event.y));
            // Prevent crossing the top square
            const topY = +axisGroup.select('.filter-square-top').attr('y');
            newY = Math.max(newY, topY);
            d3.select(this).attr('y', newY);
            const newMin = y.invert(newY);
            this_graph_filters[dim].min = newMin;
          })
          .on('end', async function () {
            adjustGroupFilters(data, dim, this_graph_filters);
            await getDataAndUpdateViz();
          })
      );
  });

  console.log('Parallel coordinates graph drawn successfully.');
}

export function scatterPlotGraph(name_of_element, graph_data, active = true) {
  console.log('Drawing scatter plot with data:', graph_data);

  const margin = general_margin;
  const width = general_width + parseInt(general_width * 0.2);
  const height = general_height;

  let scatterPlotDiv = document.querySelector(name_of_element);
  let leftDiv;
  let warningText;
  let fetchScatterPlotBtn;

  // Set the dimensions of the div container
  scatterPlotDiv.style.width = `${width + margin.left + margin.right}px`;
  scatterPlotDiv.style.height = `${height + margin.top + margin.bottom}px`;

  if (!scatterPlotDiv.querySelector(`#update-scatter-plot-btn`)) {
    console.log('Setting fetch button for scatter plot...');
    // Set the height and ensure alignment of the HTML element
    d3.select(name_of_element)
      .style('height', `${height + margin.top + margin.bottom}px`)
      .style('display', 'inline-block')
      .style('vertical-align', 'top');

    // Add a div with dotted borders to the left of the parent div
    leftDiv = document.createElement('div');
    leftDiv.style.border = '2px dotted black';
    leftDiv.style.width = '20%';
    leftDiv.style.height = '100%';
    leftDiv.style.position = 'relative';
    leftDiv.style.left = '0';
    leftDiv.style.top = '0';
    leftDiv.style.backgroundColor = '#f9f9f9';
    leftDiv.style.overflowY = 'auto';
    leftDiv.style.padding = '8px';
    leftDiv.style.boxSizing = 'border-box';
    leftDiv.style.display = 'inline-flex';
    leftDiv.style.flexDirection = 'column';
    leftDiv.style.gap = '8px';
    leftDiv.style.fontSize = '8px';
    leftDiv.id = 'scatter-plot-left-div';

    // Append the left div to the parent div
    scatterPlotDiv.appendChild(leftDiv);

    // Add a button to fetch scatter plot data
    fetchScatterPlotBtn = document.createElement('button');
    fetchScatterPlotBtn.textContent = 'Update Scatter Plot Data';
    fetchScatterPlotBtn.id = 'update-scatter-plot-btn';
    fetchScatterPlotBtn.style.display = 'block';
    fetchScatterPlotBtn.style.backgroundColor = scatter_updated ? 'green' : 'red';
    fetchScatterPlotBtn.style.fontSize = '10px';

    // Add hover tooltip
    fetchScatterPlotBtn.addEventListener('mouseover', (event) => {
      tooltip
        .style('display', 'block')
        .html(`Heavy calculations, may need several seconds`)
        .style('left', event.pageX + 10 + 'px')
        .style('top', event.pageY - 28 + 'px')
        .style('background-color', 'yellow');
    });
    fetchScatterPlotBtn.addEventListener('mousemove', function (event) {
      tooltip.style('left', event.pageX + 10 + 'px').style('top', event.pageY - 28 + 'px');
    });
    fetchScatterPlotBtn.addEventListener('mouseout', function () {
      tooltip.style('display', 'none').style('background-color', tooltipColor);
    });
    leftDiv.appendChild(fetchScatterPlotBtn);

    // Add a button to toggle zoom functionality
    const toggleZoomBtn = document.createElement('button');
    toggleZoomBtn.textContent = 'Toggle Zoom';
    toggleZoomBtn.id = 'toggle-zoom-btn';
    toggleZoomBtn.style.display = 'block';
    toggleZoomBtn.style.backgroundColor = zoomActive ? 'green' : 'red';
    toggleZoomBtn.style.fontSize = '10px';

    // Add hover tooltip for zoom
    toggleZoomBtn.addEventListener('mouseover', (event) => {
      tooltip
        .style('display', 'block')
        .html(
          `Click to ${
            zoomActive ? 'disable' : 'enable'
          } zoom functionality. You may also press Z key.`
        )
        .style('left', event.pageX + 10 + 'px')
        .style('top', event.pageY - 28 + 'px');
    });
    toggleZoomBtn.addEventListener('mousemove', function (event) {
      tooltip.style('left', event.pageX + 10 + 'px').style('top', event.pageY - 28 + 'px');
    });
    toggleZoomBtn.addEventListener('mouseout', function () {
      tooltip.style('display', 'none');
    });

    function toggleZoomState() {
      zoomActive = !zoomActive;
      toggleZoomBtn.style.backgroundColor = zoomActive ? 'green' : 'red';
      if (zoomActive && brushActive) {
        toggleBrushState();
      }
    }

    // Add click event listener to toggle zoomActive
    toggleZoomBtn.addEventListener('click', () => {
      toggleZoomState();
    });

    // Add keydown event listener for the Z key to toggle zoomActive
    document.addEventListener('keydown', (event) => {
      if (event.key === 'z' || event.key === 'Z') {
        toggleZoomState();
      }
    });

    // Add a button to toggle brush functionality
    const toggleBrushBtn = document.createElement('button');
    toggleBrushBtn.textContent = 'Toggle Brush';
    toggleBrushBtn.id = 'toggle-brush-btn';
    toggleBrushBtn.style.display = 'block';
    toggleBrushBtn.style.backgroundColor = brushActive ? 'green' : 'red';
    toggleBrushBtn.style.fontSize = '10px';

    // Add hover tooltip for brush
    toggleBrushBtn.addEventListener('mouseover', (event) => {
      tooltip
        .style('display', 'block')
        .html(
          `Click to ${
            brushActive ? 'disable' : 'enable'
          } brush functionality. You may also press B key. If brush is active, click functionality is disabled.`
        )
        .style('left', event.pageX + 10 + 'px')
        .style('top', event.pageY - 28 + 'px');
    });
    toggleBrushBtn.addEventListener('mousemove', function (event) {
      tooltip.style('left', event.pageX + 10 + 'px').style('top', event.pageY - 28 + 'px');
    });
    toggleBrushBtn.addEventListener('mouseout', function () {
      tooltip.style('display', 'none');
    });

    function toggleBrushState() {
      brushActive = !brushActive;
      const svg = d3.select(name_of_element).select('svg');
      if (brushActive) {
        svg.select('.brush').select('rect.overlay').style('pointer-events', 'all');
      } else {
        svg.select('.brush').call(brush.move, null);
        svg.select('.brush').select('rect.overlay').style('pointer-events', 'none');
      }
      toggleBrushBtn.style.backgroundColor = brushActive ? 'green' : 'red';
      if (brushActive && zoomActive) {
        toggleZoomState();
      }
    }

    // Add click event listener to toggle brushActive
    toggleBrushBtn.addEventListener('click', () => {
      toggleBrushState();
    });

    // Add keydown event listener for the B key to toggle brushActive
    document.addEventListener('keydown', (event) => {
      if (event.key === 'b' || event.key === 'B') {
        toggleBrushState();
      }
    });

    leftDiv.appendChild(toggleZoomBtn);
    leftDiv.appendChild(toggleBrushBtn);

    warningText = document.createElement('div');
    warningText.style.display = scatter_updated ? 'none' : 'block';
    warningText.textContent = 'PLOT DO NOT REFLECTS ACTUAL GROUPS';
    warningText.style.color = 'red';
    warningText.style.fontWeight = 'bold';
    warningText.id = 'scatter-plot-warning';
    warningText.style.fontSize = '8px';
    leftDiv.appendChild(warningText);
    scatterPlotDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
    leftDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';

    // Add a bordered div to show the number of neighbors used for UMAP
    const neighborsDiv = document.createElement('div');
    neighborsDiv.style.border = '1px solid black';
    neighborsDiv.style.padding = '5px';
    neighborsDiv.style.fontSize = '8px';

    // Create an input field for editing the number of neighbors
    const neighborsInput = document.createElement('input');
    neighborsInput.id = 'neighbors-input';
    isEdited = false;
    neighborsInput.type = 'number';
    neighborsInput.style.width = '35px';
    neighborsInput.style.backgroundColor = isEdited ? 'yellow' : 'white';
    neighborsInput.min = 1;
    neighborsInput.value = graph_data?.Metadata?.nNeighbors || 1;

    // Add hover tooltip for neighbors input
    neighborsDiv.addEventListener('mouseover', (event) => {
      tooltip
        .style('display', 'block')
        .html('If left unchanged, the number will be determined automatically.')
        .style('left', event.pageX + 10 + 'px')
        .style('top', event.pageY - 28 + 'px');
    });
    neighborsDiv.addEventListener('mousemove', (event) => {
      tooltip.style('left', event.pageX + 10 + 'px').style('top', event.pageY - 28 + 'px');
    });
    neighborsDiv.addEventListener('mouseout', () => {
      tooltip.style('display', 'none');
    });
    

    // Add an event listener to detect changes
    neighborsInput.addEventListener('input', () => {
      isEdited = true;
      neighborsInput.style.backgroundColor = 'yellow';
    });

    neighborsDiv.textContent = `N. Neighbors (UMAP): `;
    neighborsDiv.appendChild(neighborsInput);
    leftDiv.appendChild(neighborsDiv);

    // Add fetch button listener
    fetchScatterPlotBtn.addEventListener('click', async () => {
      try {
        console.log('Fetching scatter plot data...');
        const json_body = {
          filters: all_criterias.filters,
          groups: all_criterias.groups,
          selections: all_criterias.selections,
          graphs: {
            scatter_plot_card_presence: { type: 'scatter_plot', nNeighbors: isEdited ? parseInt(neighborsInput.value) : undefined },
          },
        };
        console.log('Sending request with body:', json_body);

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
            body: JSON.stringify(json_body),
          });

          if (!response.ok) {
            throw new Error(
              `Failed to fetch scatter plot data. Status: ${response.status}, Status Text: ${response.statusText}`
            );
          }

          scatterData = await response.json();
          console.log('Fetched scatter plot data successfully:', scatterData);

          // Clear previous scatter plot visualization
          d3.select(name_of_element).html('');

          // Redraw scatter plot with the new data
          scatterPlotGraph(name_of_element, scatterData['scatter_plot_card_presence']);
        } catch (error) {
          console.error('Error fetching scatter plot data:', error);
        } finally {
          // Remove the loading indicator
          loadingIndicator.remove();
        }
        // Clear previous scatter plot visualization
        d3.select(name_of_element).html('');

        // Redraw scatter plot with the new data
        if (scatterData) {
          scatterPlotGraph(name_of_element, scatterData['scatter_plot_card_presence']);
          tooltip.style('display', 'none');
        } else {
          console.error('No scatter plot data to display.');
          alert('Failed to fetch scatter plot data. Please try again or change the filters.');
          scatterPlotGraph(name_of_element, [], false);
          tooltip.style('display', 'none');
        }
      } catch (error) {
        console.error('Error fetching scatter plot data:', error);
      }
    });
  }

  if (!scatter_updated) {
    console.log('Scatter plot not updated.');
    warningText = d3.select(`#scatter-plot-warning`);
    warningText.style('display', 'block');
    leftDiv = d3.select('#scatter-plot-left-div');
    scatterPlotDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
    leftDiv.style('background-color', 'rgba(255, 0, 0, 0.1)');

    fetchScatterPlotBtn = d3.select(`#update-scatter-plot-btn`);
    fetchScatterPlotBtn.style('background-color', 'red');
  } else {
    console.log('Scatter plot updated successfully.');
    warningText = d3.select(`#scatter-plot-warning`);
    warningText.style('display', 'none');
    leftDiv = d3.select('#scatter-plot-left-div');
    scatterPlotDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
    leftDiv.style('background-color', 'rgba(255, 255, 255, 0.8)');

    fetchScatterPlotBtn = d3.select(`#update-scatter-plot-btn`);
    fetchScatterPlotBtn.style('background-color', 'green');
  }

  if (active) {
    // Append the svg object to the specified element
    const svg_height = height + margin.top + margin.bottom;
    const svg = d3
      .select(name_of_element)
      .append('svg')
      .attr('width', svg_height)
      .attr('height', svg_height)
      .style('display', 'inline-block') // Ensure it appears as an inline-block element
      .style('vertical-align', 'top') // Align it to the top of the left column
      .style('margin-left', '10px') // Add some spacing from the left column
      .style('background-color', '#f0f0f0ff');

    scatter_updated = true;

    // Extract metadata and remove it from the data object
    const metadata = graph_data.Metadata;
    const data = graph_data.data;
    console.log('Data for scatter plot:', data);

    const neighborsInput = d3.select('#neighbors-input');
    isEdited = false;
    neighborsInput.property('value', metadata.nNeighbors);
    neighborsInput.style('background-color', 'white');
    leftDiv = d3.select('#scatter-plot-left-div');
    scatterPlotDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
    leftDiv.style('background-color', 'rgba(255, 255, 255, 0.8)');

    const graph_margins = 5;

    // Set up the X axis
    const x = d3
      .scaleLinear()
      .domain([metadata.min_x, metadata.max_x])
      .range([graph_margins * 2, svg_height - margin.right - margin.left - graph_margins * 4]);
    const xAxis = svg
      .append('g')
      .attr('transform', `translate(${0},${svg_height - graph_margins})`)
      .call(d3.axisBottom(x).tickSize(0).tickFormat(''));

    // Set up the Y axis
    const y = d3
      .scaleLinear()
      .domain([metadata.min_y, metadata.max_y])
      .range([svg_height - graph_margins * 4, 0]);
    const yAxis = svg
      .append('g')
      .attr('transform', `translate(${graph_margins * 2},${graph_margins * 3})`)
      .call(d3.axisLeft(y).tickSize(0).tickFormat(''));

    // Add a clipPath to prevent points from being drawn outside the chart area
    const circleRadius = 5;
    svg
      .append('defs')
      .append('clipPath')
      .attr('id', 'clip')
      .append('rect')
      .attr('width', svg_height - margin.right - margin.left + 2 * circleRadius)
      .attr('height', svg_height - graph_margins * 4 + 2 * circleRadius)
      .attr('x', graph_margins * 2 - circleRadius)
      .attr('y', graph_margins * 3 - circleRadius);

    // Add points
    const pointsGroup = svg
      .append('g')
      .attr('clip-path', 'url(#clip)')
      .selectAll(`scatter-circle`)
      .data(data, (d) => d[2].id)
      .enter()
      .append('circle')
      .attr('cx', (d) => x(d[0]))
      .attr('cy', (d) => y(d[1]))
      .attr('data-id', (d) => sanitizeId(d[2].id))
      .attr('r', 5)
      .attr('transform', `translate(0,${graph_margins * 3})`)
      .attr(
        'class',
        (d) => `scatter-circle ${d[2].group.map((g) => `group-${g.replaceAll(' ', '')}`).join(' ')}`
      )
      .attr('fill', (d) => ensureSVGGradient(svg, d[2].group, color))
      .on('mouseover', function (event, d) {
        d3.select(this)
          .attr('stroke', 'black')
          .attr('stroke-dasharray', '4,2')
          .attr('stroke-width', 1)
          .raise(); // Bring the point to the top
        tooltip
          .style('display', 'block')
          .html(
            `Groups: ${d[2].group.join(', ')}<br>Rank: ${d[2].rank}<br>Event: ${
              d[2].event
            }<br>Hero: ${d[2].hero}<br>ID: ${d[2].id}`
          )
          .style('left', event.pageX + 10 + 'px')
          .style('top', event.pageY - 28 + 'px');
      })
      .on('mousemove', function (event) {
        tooltip.style('left', event.pageX + 10 + 'px').style('top', event.pageY - 28 + 'px');
      })
      .on('mouseout', function () {
        d3.select(this)
          .attr('stroke', null)
          .attr('stroke-dasharray', null)
          .attr('stroke-width', null);
        tooltip.style('display', 'none');
      })
      .on('click', function (event, d) {
        event.stopPropagation(); // Prevent triggering other click events
        const circle = d3.select(this);
        const isSelected = circle.classed('selected');

        if (isSelected) {
          circle.classed('selected', false).style('stroke', null);
          d3.select(`input[data-id="${sanitizeId(d[2].id)}"]`).property('checked', false);
        } else {
          circle.classed('selected', true).style('stroke', 'black');
          d3.select(`input[data-id="${sanitizeId(d[2].id)}"]`).property('checked', true);
        }
      });

    let currentTransform = d3.zoomIdentity;
    
    // Add brush functionality
    brush = d3
      .brush()
      .extent([
        [0, 0],
        [svg_height, svg_height],
      ])
      .on('start brush', (event) => {
        const selection = event.selection;
        if (selection) {
          const [[x0, y0], [x1, y1]] = selection;

          pointsGroup.each(function (d) {
            const newX = currentTransform.rescaleX(x);
            const newY = currentTransform.rescaleY(y);
            const cx = newX(d[0]);
            const cy = newY(d[1]) + graph_margins * 3;
            const isBrushed = cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;

            d3.select(this)
              .classed('selected', isBrushed)
              .style('stroke', isBrushed ? 'black' : null);

            d3.select(`input[data-id="${sanitizeId(d[2].id)}"]`).property('checked', isBrushed);
          });
        }
      });

    svg.append('g').attr('class', 'brush').call(brush);
    svg.select('.brush').select('rect.overlay').style('pointer-events', 'none');

    // Add zoom functionality
    const zoom = d3
      .zoom()
      .scaleExtent([1, 20]) // Zoom scale
      .translateExtent([
        [0, 0],
        [svg_height, svg_height],
      ]) // Pan boundaries
      .on('zoom', (event) => {
        if (zoomActive) {
          currentTransform = event.transform;
          const transform = event.transform;
          const newX = transform.rescaleX(x);
          const newY = transform.rescaleY(y);

          xAxis.call(d3.axisBottom(newX).tickSize(0).tickFormat(''));
          yAxis.call(d3.axisLeft(newY).tickSize(0).tickFormat(''));

          pointsGroup.attr('cx', (d) => newX(d[0])).attr('cy', (d) => newY(d[1]));
        }
      });

    svg.call(zoom);
  }

  console.log('Scatter plot drawn successfully.');
}

let tbody;
let tableInitialized = false;

export function fillTable(data) {
  
  if (!tableInitialized) {
    const headers = [
      'Selected',
      'Group',
      'ID',
      'Event',
      'Player',
      'Date',
      'Rank',
      'Hero',
      'Classes',
      'Talents',
      'Played Rounds',
      'Top Rounds',
      'Wins',
      'Losses',
      'Draws',
      'Double Losses',
      'List of Cards',
    ];
    const filter_to_header_map = {
      selected: 'Selected',
      group: 'Group',
      id: 'ID',
      event: 'Event',
      player: 'Player',
      'min date': 'Date',
      'max date': 'Date',
      'min rank': 'Rank',
      'max rank': 'Rank',
      hero: 'Hero',
      classes: 'Classes',
      talents: 'Talents',
      'min played rounds': 'Played Rounds',
      'max played rounds': 'Played Rounds',
      'min top rounds': 'Top Rounds',
      'max top rounds': 'Top Rounds',
      'min wins': 'Wins',
      'max wins': 'Wins',
      'min losses': 'Losses',
      'max losses': 'Losses',
      'min draws': 'Draws',
      'max draws': 'Draws',
      'min double losses': 'Double Losses',
      'max double losses': 'Double Losses',
    };

    // Add filters above the table
    const filtersContainer = d3
      .select(filterAndHead)
      .append('div')
      .attr('id', 'filters-container')
      .style('display', 'flex')
      .style('gap', '5px')
      .style('height', '40px')
      .style('overflow-x', 'auto')
      .style('flex-wrap', 'wrap')
      .style('font-size', '8px');

    const filterWrapper = filtersContainer
      .append('div')
      .attr('id', `filter-wrapper`)
      .style('display', 'flex')
      .style('flex-wrap', 'nowrap')
      .style('overflow-x', 'auto')
      .style('gap', '5px');

    const filters = {};

    [
      'Selected',
      'Group',
      'ID',
      'Event',
      'Player',
      'Start Date',
      'End Date',
      'Min Rank',
      'Max Rank',
      'Hero',
      'Classes',
      'Talents',
      'Min Played Rounds',
      'Max Played Rounds',
      'Min Top Rounds',
      'Max Top Rounds',
      'Min Wins',
      'Max Wins',
      'Min Losses',
      'Max Losses',
      'Min Draws',
      'Max Draws',
      'Min Double Losses',
      'Max Double Losses',
    ].forEach((column, index) => {
      const filterColumnWrapper = filterWrapper
        .append('div')
        .style('display', 'flex')
        .style('flex-direction', 'column')
        .style('align-items', 'center')
        .style('height', '20px')
        .style('font-size', '8px');

      filterColumnWrapper
        .append('span')
        .text(column)
        .style('font-weight', 'bold')
        .style('font-size', '8px');

      let filterInput;
      if (
        [
          'Min Played Rounds',
          'Max Played Rounds',
          'Min Top Rounds',
          'Max Top Rounds',
          'Min Wins',
          'Max Wins',
          'Min Losses',
          'Max Losses',
          'Min Draws',
          'Max Draws',
          'Min Double Losses',
          'Max Double Losses',
        ].includes(column)
      ) {
        // Numeric range filter
        filterInput = filterColumnWrapper
          .append('input')
          .attr('type', 'number')
          .attr('placeholder', column)
          .attr('data-column', column.toLowerCase().replace(' ', '_'))
          .style('font-size', '8px');
      } else if (['Min Rank', 'Max Rank'].includes(column)) {
        // Numeric range filter for Rank
        filterInput = filterColumnWrapper
          .append('input')
          .attr('type', 'number')
          .attr('placeholder', column)
          .attr('data-column', column.toLowerCase().replace(' ', '_'))
          .style('font-size', '8px');
      } else if (column === 'Start Date' || column === 'End Date') {
        // Date filter
        filterInput = filterColumnWrapper
          .append('input')
          .attr('type', 'date')
          .attr('placeholder', `Filter by ${column}`)
          .attr('data-column', column.toLowerCase().replace(' ', '_'))
          .style('font-size', '8px');
      } else if (column === 'Selected') {
        // Checkbox filter for 'Selected'
        filterInput = filterColumnWrapper
          .append('select')
          .attr('data-column', column.toLowerCase().replace(' ', '_'))
          .style('font-size', '8px');
        filterInput.append('option').attr('value', '').text('All');
        filterInput.append('option').attr('value', 'true').text('Selected');
        filterInput.append('option').attr('value', 'false').text('Not Selected');
      } else {
        // General text filter
        filterInput = filterColumnWrapper
          .append('input')
          .attr('type', 'text')
          .attr('placeholder', `Filter by ${column}`)
          .attr('data-column', column.toLowerCase().replace(' ', '_'))
          .style('font-size', '8px');
      }

      filters[column] = '';

      filterInput.on('input', debounce(function () {
        const filterValue = this.value.toLowerCase();
        filters[column] = filterValue;

        d3.selectAll('tbody tr').each(function () {
          const row = d3.select(this);
          let isVisible = true;

          Object.keys(filters).forEach((key) => {
            const header = filter_to_header_map[key.toLowerCase()];
            if (!header) return; // Skip if no matching header

            const cell = row.select(`td:nth-child(${headers.indexOf(header) + 1})`); // Match the column based on the header
            const filter = filters[key];
            key = key.toLowerCase();

            if (key === 'selected') {
              // Handle 'Selected' filter
              const checkbox = cell.select('input[type="checkbox"]');
              if (filter === 'true' && !checkbox.property('checked')) {
                isVisible = false;
              } else if (filter === 'false' && checkbox.property('checked')) {
                isVisible = false;
              }
            } else if (key === 'start date' || key === 'end date') {
              // Handle 'Start Date' and 'End Date' filters
              const cellDate = new Date(cell.text());
              const filterDate = new Date(filter);
              if (key === 'start date' && filter && (!cellDate || cellDate < filterDate)) {
                isVisible = false;
              } else if (key === 'end date' && filter && (!cellDate || cellDate > filterDate)) {
                isVisible = false;
              }
            } else if (key.startsWith('min') || key.startsWith('max')) {
              // Handle numeric range filters
              const cellValue = parseInt(cell.text());
              const filterValue = parseInt(filter);
              if (key.startsWith('min') && filter && (!cellValue || cellValue < filterValue)) {
                isVisible = false;
              } else if (key.startsWith('max') && filter && (!cellValue || cellValue > filterValue)) {
                isVisible = false;
              }
            } else {
              // Handle general text filters
              if (filter && (!cell || !cell.text().toLowerCase().includes(filter))) {
                isVisible = false;
              }
            }
          });
          row.style('display', isVisible ? '' : 'none');
        });
      }));
    });

    // Add a reset button for filters
    d3.select('#filter-wrapper')
      .insert('button', ':first-child')
      .text('Reset Filters')
      .style('font-size', '8px')
      .style('margin-left', '5px')
      .style('display', 'inline-block')
      .on('click', () => {
        // Clear all filter inputs
        Object.keys(filters).forEach((key) => {
          filters[key] = '';
          const input = filterWrapper.select(
            `[data-column="${key.toLowerCase().replace(' ', '_')}"]`
          );
          if (input.node()) {
            input.property('value', '');
          }
        });

        // Reset table rows visibility
        d3.selectAll('tbody tr').style('display', '');
      });

    // Create the table element
    const table = d3
      .select(tableContainer)
      .html('') // Clear previous content
      .append('table')
      .attr('id', 'decklists-table')
      .style('border-collapse', 'collapse')
      .style('width', '100%')
      .style('white-space', 'nowrap')
      .style('font-size', '8px');

    // Create the table header
    const thead = table
      .append('thead')
      .style('width', '100%')
      .style('position', 'sticky')
      .style('top', '0')
      .style('background-color', '#fff')
      .style('z-index', '1')
      .style('text-align', 'center')
      .style('font-size', '8px');

    const headerRow = thead.append('tr');

    headers.forEach((header, index) => {
      const th = headerRow
        .append('th')
        .style('border', '1px solid black')
        .style('border-top', 'none')
        .style('border-bottom', 'none')
        .style('font-size', '8px')
        .text(header);

      if (index === 0) {
        th.append('button')
          .attr('id', 'manage-selected-list-table')
          .text('Manage')
          .style('font-size', '8px')
          .on('click', () => {
            const popup = d3
              .select('body')
              .append('div')
              .style('position', 'fixed')
              .style('top', '50%')
              .style('left', '50%')
              .style('transform', 'translate(-50%, -50%)')
              .style('background', '#fff')
              .style('border', '1px solid #ccc')
              .style('padding', '10px')
              .style('box-shadow', '0px 4px 6px rgba(0, 0, 0, 0.1)')
              .style('z-index', '1000')
              .style('font-size', '8px');

            popup.html(`
              <h3 style="font-size: 8px;">Manage Selected List</h3>
              <form id="manage-selected-list-form" style="font-size: 8px;">
              <label><input type="radio" name="manage-option" value="clear" style="font-size: 8px;"> Clear Selected List</label><br>
              <label><input type="radio" name="manage-option" value="select" style="font-size: 8px;"> Select All Rows</label><br>
              <label><input type="radio" name="manage-option" value="remove" style="font-size: 8px;"> Remove from Groups</label><br>
              <label><input type="radio" name="manage-option" value="add" style="font-size: 8px;"> Add to Groups</label><br>
              <label><input type="radio" name="manage-option" value="group" style="font-size: 8px;"> Make as new Group</label><br>
              <button type="submit" style="font-size: 8px;">Submit</button>
              <button type="button" id="cancel-manage-popup" style="font-size: 8px;">Cancel</button>
              </form>
            `);

            popup.select('#cancel-manage-popup').on('click', () => popup.remove());
            popup.select('#manage-selected-list-form').on('submit', async (event) => {
              event.preventDefault();
              const selectedOption = popup
                .select('input[name="manage-option"]:checked')
                .node()?.value;

              if (selectedOption === 'clear') {
                d3.selectAll('.select-decklist').property('checked', false);
                d3.selectAll('.scatter-circle').classed('selected', false).style('stroke', null);
                alert('Selected list cleared.');
              }
              if (selectedOption === 'select') {
                d3.selectAll('.select-decklist').property('checked', true);
                d3.selectAll('.scatter-circle').classed('selected', true).style('stroke', 'black');
                alert('All rows selected.');
              }
              if (selectedOption === 'remove') {
                d3.selectAll('.select-decklist:checked').each(function () {
                  const row = d3.select(this.closest('tr'));
                  const groupNames = row.select('td:nth-child(2)').text().trim().split(',');
                  const listId = row.select('td:nth-child(3)').text().trim();

                  // Create a dropdown for the user to select a group
                  const groupDropdown = document.createElement('select');
                  groupDropdown.style.margin = '10px';
                  groupDropdown.style.fontSize = '8px';

                  groupNames.forEach((groupName) => {
                    const option = document.createElement('option');
                    option.value = groupName;
                    option.textContent = groupName;
                    groupDropdown.appendChild(option);
                  });

                  const popup = document.createElement('div');
                  popup.style.position = 'fixed';
                  popup.style.top = '50%';
                  popup.style.left = '50%';
                  popup.style.transform = 'translate(-50%, -50%)';
                  popup.style.background = '#fff';
                  popup.style.border = '1px solid #ccc';
                  popup.style.padding = '10px';
                  popup.style.boxShadow = '0px 4px 6px rgba(0, 0, 0, 0.1)';
                  popup.style.zIndex = '1000';
                  popup.style.fontSize = '8px';

                  const submitButton = document.createElement('button');
                  submitButton.textContent = 'Submit';
                  submitButton.style.margin = '10px';
                  submitButton.style.fontSize = '8px';

                  const cancelButton = document.createElement('button');
                  cancelButton.textContent = 'Cancel';
                  cancelButton.style.margin = '10px';
                  cancelButton.style.fontSize = '8px';

                  popup.appendChild(document.createTextNode(`Select a group to remove the decklist (ID: ${listId}) from:`));
                  popup.appendChild(groupDropdown);
                  popup.appendChild(submitButton);
                  popup.appendChild(cancelButton);
                  document.body.appendChild(popup);

                  cancelButton.addEventListener('click', () => {
                    popup.remove();
                  });

                  submitButton.addEventListener('click', () => {
                    const selectedGroupName = groupDropdown.value;
                    if (selectedGroupName) {
                      if (all_criterias.groups[selectedGroupName]) {
                        if (!all_criterias.groups[selectedGroupName].filter) {
                          all_criterias.groups[selectedGroupName].filter = {};
                        }
                        if (
                          special_decklists[selectedGroupName]?.find((d) => d.listId === listId)?.type == 'added'
                        ) {
                          // If the decklist was previously marked as added to the same group, we need to undo that
                          if (
                            all_criterias.groups[selectedGroupName].filter['List Id'] &&
                            Object.keys(all_criterias.groups[selectedGroupName].filter['List Id']?.value).includes(
                              'IS-IN'
                            )
                          ) {
                            const index = all_criterias.groups[selectedGroupName].filter['List Id'].value[
                              'IS-IN'
                            ].indexOf(listId);
                            if (index > -1) {
                              all_criterias.groups[selectedGroupName].filter['List Id'].value['IS-IN'].splice(
                                index,
                                1
                              );
                              delete special_decklists[selectedGroupName].find((d) => d.listId === listId); // Remove from special_decklists as it's no longer special
                            }
                          }
                        } else {
                          if (!all_criterias.groups[selectedGroupName].filter['List Id']) {
                            all_criterias.groups[selectedGroupName].filter['List Id'] = {
                              precision: 'COMPOUND',
                              value: {
                                'IS-IN': [],
                                'IS-NOT-IN': [],
                                exclusive: false,
                              },
                            };
                          }
                          all_criterias.groups[selectedGroupName].filter['List Id'].value['IS-NOT-IN'].push(listId);
                          special_decklists[selectedGroupName] = special_decklists[selectedGroupName] || [];
                          special_decklists[selectedGroupName].push({ listId: listId, type: 'removed' });
                        }
                      }
                      alert(
                        `Decklist removed from group "${selectedGroupName}". Please refresh the Exploration to see changes.`
                      );
                      popup.remove();
                    } else {
                      alert('Please select a group.');
                    }
                  });
                });
              }
              if (selectedOption === 'add') {
                const row = d3.select(this.closest('tr'));
                const listId = row.select('td:nth-child(3)').text().trim();
                const groupNames = Object.keys(all_criterias.groups);
                const groupName = document.createElement('select');
                groupName.id = 'group-name-dropdown';
                groupName.style.margin = '10px';
                groupName.style.fontSize = '8px';
                groupNames.forEach((name) => {
                  const option = document.createElement('option');
                  option.value = name;
                  option.textContent = name;
                  groupName.appendChild(option);
                });

                const group_popup = document.createElement('div');
                group_popup.style.position = 'fixed';
                group_popup.style.top = '50%';
                group_popup.style.left = '50%';
                group_popup.style.transform = 'translate(-50%, -50%)';
                group_popup.style.background = '#fff';
                group_popup.style.border = '1px solid #ccc';
                group_popup.style.padding = '10px';
                group_popup.style.boxShadow = '0px 4px 6px rgba(0, 0, 0, 0.1)';
                group_popup.style.zIndex = '1000';
                group_popup.style.fontSize = '8px';

                const submitButton = document.createElement('button');
                submitButton.textContent = 'Submit';
                submitButton.style.margin = '10px';
                submitButton.style.fontSize = '8px';

                const cancelButton = document.createElement('button');
                cancelButton.textContent = 'Cancel';
                cancelButton.style.margin = '10px';
                cancelButton.style.fontSize = '8px';


                group_popup.appendChild(
                  popup.appendChild(document.createTextNode(`Select a group to add the decklist (ID: ${listId}) from:`))
                );
                group_popup.appendChild(groupName);
                group_popup.appendChild(submitButton);
                group_popup.appendChild(cancelButton);
                document.body.appendChild(group_popup);

                cancelButton.addEventListener('click', () => {
                  group_popup.remove();
                });

                submitButton.addEventListener('click', () => {
                  const selectedGroupName = groupName.value;
                  if (selectedGroupName) {
                    d3.selectAll('.select-decklist:checked').each(function () {
                      const row = d3.select(this.closest('tr'));
                      const listId = row.select('td:nth-child(3)').text().trim();

                      if (all_criterias.groups[selectedGroupName]) {
                        if (!all_criterias.groups[selectedGroupName].filter) {
                          all_criterias.groups[selectedGroupName].filter = {};
                        }
                        if (special_decklists[selectedGroupName]?.find((d) => d.id === listId)?.type == 'removed') {
                          // If the decklist was previously marked as removed from the same group, we need to undo that
                          if (all_criterias.groups[selectedGroupName].filter['List Id'] && Object.keys(all_criterias.groups[selectedGroupName].filter['List Id']?.value).includes('IS-NOT-IN')) {
                            const index = all_criterias.groups[selectedGroupName].filter['List Id'].value["IS-NOT-IN"].indexOf(listId);
                            if (index > -1) {
                              all_criterias.groups[selectedGroupName].filter['List Id'].value["IS-NOT-IN"].splice(index, 1);
                              delete special_decklists[selectedGroupName].find((d) => d.listId === listId); // Remove from special_decklists as it's no longer special
                            }
                          }
                        } else {
                          if (!all_criterias.groups[selectedGroupName].filter['List Id']) {
                            all_criterias.groups[selectedGroupName].filter['List Id'] = {
                              precision: 'COMPOUND',
                              value: {
                                "IS-IN": [],
                                "IS-NOT-IN": [],
                                exclusive: false
                              },
                            };
                          }
                          all_criterias.groups[selectedGroupName].filter['List Id'].value["IS-IN"].push(listId);
                          special_decklists[selectedGroupName] = special_decklists[selectedGroupName] || [];
                          special_decklists[selectedGroupName].push({ listId: listId, type: 'added' });
                        }
                      }
                    });
                    alert('Selected decklists added to the group. Please refresh the Exploration to see changes.');
                    group_popup.remove();
                  } else {
                    alert('Please select a group.');
                  }
                });
              }
              if (selectedOption === 'group'){
                const groupNameInput = document.createElement('input');
                groupNameInput.type = 'text';
                groupNameInput.id = 'new-group-name';
                groupNameInput.placeholder = 'Enter new group name';
                groupNameInput.style.margin = '10px';
                groupNameInput.style.fontSize = '8px';

                const group_popup = document.createElement('div');
                group_popup.style.position = 'fixed';
                group_popup.style.top = '50%';
                group_popup.style.left = '50%';
                group_popup.style.transform = 'translate(-50%, -50%)';
                group_popup.style.background = '#fff';
                group_popup.style.border = '1px solid #ccc';
                group_popup.style.padding = '10px';
                group_popup.style.boxShadow = '0px 4px 6px rgba(0, 0, 0, 0.1)';
                group_popup.style.zIndex = '1000';
                group_popup.style.fontSize = '8px';

                const submitButton = document.createElement('button');
                submitButton.textContent = 'Submit';
                submitButton.style.margin = '10px';
                submitButton.style.fontSize = '8px';

                const cancelButton = document.createElement('button');
                cancelButton.textContent = 'Cancel';
                cancelButton.style.margin = '10px';
                cancelButton.style.fontSize = '8px';

                group_popup.appendChild(
                  document.createTextNode(`Enter a name for the new group:`)
                );
                group_popup.appendChild(groupNameInput);
                group_popup.appendChild(submitButton);
                group_popup.appendChild(cancelButton);

                document.body.appendChild(group_popup);

                cancelButton.addEventListener('click', () => {
                  group_popup.remove();
                });

                submitButton.addEventListener('click', () => {
                  const newGroupName = groupNameInput.value.trim();
                  if (newGroupName) {
                    all_criterias.group_form_names[group_index] = newGroupName;
                    group_index += 1;
                    createForm(newGroupName);
                    all_criterias.groups[newGroupName] = { 
                      filter: {
                        'List Id': { precision: 'COMPOUND', value: { "IS-IN": [], "IS-NOT-IN": [], exclusive: true } }
                      }
                    };
                    
                    d3.selectAll('.select-decklist:checked').each(function () {
                      const row = d3.select(this.closest('tr'));
                      const listId = row.select('td:nth-child(3)').text().trim();
                      all_criterias.groups[newGroupName].filter['List Id'].value["IS-IN"].push(listId);
                      special_decklists[newGroupName] = special_decklists[newGroupName] || [];
                      special_decklists[newGroupName].push({ listId: listId, type: 'added' });
                    });
                  }
                  alert(`New group created. Please refresh the Exploration to see changes.`);
                  group_popup.remove();
                });
                }
              popup.remove();
            });
          });
      }
    });

    // Create the table body
    tbody = table.append('tbody');
  }

  const updatedDecklists = getUpdatedDecklists(data);

  // Bind data to rows and update the table
  tbody
    .selectAll('tr')
    .data(updatedDecklists, (d) => d.decklist.Metadata['List Id'])
    .join(
      (enter) =>
        enter
          .append('tr')
          .style('text-align', 'center')
          .style('background', (d) => getGradient(d.group))
          .style('height', '15px')
          .style('font-size', '8px')
          .call((enter) => {
            enter
              .selectAll('td')
              .data((d) => [
                  `<input type="checkbox" class="select-decklist" data-id="${sanitizeId(d.decklist.Metadata['List Id'])}" style="font-size: 8px;">`,
                  d.group,
                  d.decklist.Metadata['List Id'],
                  d.decklist.Metadata['Event'],
                  d.decklist.Metadata['Player Name'],
                  d.decklist.Metadata['Date'],
                  d.decklist.Metadata['Rank'],
                  d.decklist.Metadata['Hero'] || '',
                  d.decklist.Metadata['Classes'] || '',
                  d.decklist.Metadata['Talents'] || '',
                  d.decklist.Metadata['Classic Constructed Played Rounds'] || 0,
                  d.decklist.Metadata['Classic Constructed Top Rounds'] || 0,
                  d.decklist.Metadata['Classic Constructed Wins'] || 0,
                  d.decklist.Metadata['Classic Constructed Losses'] || 0,
                  d.decklist.Metadata['Classic Constructed Draws'] || 0,
                  d.decklist.Metadata['Classic Constructed Double Losses'] || 0,
                  `<button type="button" class="show-card-list" data-id="${d.decklist.Metadata['List Id']}" style="font-size: 8px;">Show Card List</button>`
                ])
              .enter()
              .append('td')
              .style('border', '1px solid black')
              .style('font-size', '8px')
              .html((d) => d);
          }),
      (update) =>
        update
          .style('background', (d) => getGradient(d.group))
          .select('td:nth-child(2)')
          .html((d) => d.group),
      (exit) => exit.remove()
    );

    // Define the handler function for the checkbox change event
    function handleCheckboxChange(checkbox) {
      const decklistId = checkbox.getAttribute('data-id');
      const isChecked = checkbox.checked;

        // Find the corresponding scatter plot point
        const scatterPoint = d3.select(`.scatter-circle[data-id="${sanitizeId(decklistId)}"]`);

        if (!scatterPoint.empty()) {
          scatterPoint.classed('selected', isChecked).style('stroke', isChecked ? 'black' : null).raise();
        }
      }

    if (!tableInitialized) {
      tbody.selectAll('.select-decklist').on('change', function() {
        handleCheckboxChange(this);
      });

      // Add listener for "Show Card List" buttons
      tbody.selectAll('.show-card-list').on('click', function () {
        const decklistId = this.getAttribute('data-id');
        const decklist = updatedDecklists.find((d) => d.decklist.Metadata['List Id'] === decklistId)?.decklist;
        const cardList = decklist?.Cards || [];

        // Create the pop-up container
        const popup = d3
          .select('body')
          .append('div')
          .style('position', 'fixed')
          .style('top', '50%')
          .style('left', '50%')
          .style('transform', 'translate(-50%, -50%)')
          .style('background', '#fff')
          .style('border', '1px solid #ccc')
          .style('padding', '20px')
          .style('box-shadow', '0px 4px 6px rgba(0, 0, 0, 0.1)')
          .style('z-index', '1000')
          .style('max-height', '80%')
          .style('overflow-y', 'auto')
          .style('font-size', '10px');

        // Add title
        popup
          .append('h3')
          .text(`List ID: ${decklist.Metadata['List Id']}`)
          .style('margin-bottom', '10px');

        // Add card list grouped by color with bordered divs
        const cardListContainer = popup.append('div').style('max-height', '60vh').style('overflow-y', 'auto');
        const colorBackgrounds = {
          '': '#e1e1e1ff', // Light grey for no color
          'Red': '#ffd3d3ff', // Light red
          'Yel': '#ffffc8ff', // Light yellow
          'Blu': '#c6e2ffff', // Light blue
        };

        // Group cards by color
        const cardsByColor = {};
        cardList.forEach((card) => {
          if (!cardsByColor[card.color]) {
            cardsByColor[card.color] = [];
          }
          cardsByColor[card.color].push(card);
        });

        // Create a block for each color
        Object.entries(cardsByColor).forEach(([color, cards]) => {
          const colorBlock = cardListContainer
            .append('div')
            .style('margin-bottom', '10px')
            .style('padding', '10px')
            .style('border', '1px solid black')
            .style('background-color', colorBackgrounds[color] || '#d3d3d3'); // Default to light grey if color is not found

          // Add header with color name
          const colorName = color === '' ? 'Colorless' : color === 'Red' ? 'Red' : color === 'Yel' ? 'Yellow' : color === 'Blu' ? 'Blue' : 'Unknown';
          colorBlock.append('h4').text(colorName).style('margin-bottom', '5px').style('margin-top', '0px');

          cards.forEach((card) => {
            colorBlock.append('div').text(`x${card.quantity} - ${card.card_name}`);
          });
        });

        // Add close button
        popup
          .append('button')
          .text('Close')
          .style('margin-top', '10px')
          .on('click', () => {
            popup.remove();
          });
      });
    }

    tableInitialized = true;
    console.log('Table filled successfully.');
}

export function clearCriterias() {
  function cleanFilters(filters) {
    Object.keys(filters).forEach((key) => {
      if (filters[key].precision === 'IS-IN' || filters[key].precision === 'IS-NOT-IN') {
        if (Array.isArray(filters[key].value) && filters[key].value.length === 0) {
          delete filters[key];
        }
      } else if (typeof filters[key] === 'object') {
        cleanFilters(filters[key]); // Recursively clean nested filters
      }
    });
  }

  Object.keys(all_criterias.filters).forEach((key) => {
    cleanFilters(all_criterias.filters[key]);
  });

  Object.keys(all_criterias.groups).forEach((groupName) => {
    if (all_criterias.groups[groupName]?.filter) {
      cleanFilters(all_criterias.groups[groupName].filter);
    }
  });
}

export async function getDataAndUpdateViz() {
  scatter_updated = false;
  clearCriterias();
  try {
    const data = await fetchDecklists(all_criterias);
    if (data.length === 0) {
      console.warn('No data returned for the given criteria.');
    } else {
      // color palette
      color = d3
        .scaleOrdinal()
        .domain(
          Object.values(['No Group'].concat(all_criterias['group_form_names'])).concat(
            all_criterias.selections ? all_criterias.selections : []
          )
        )
        .range(range_of_colors);
      setLegend(
        Object.values(all_criterias['group_form_names'])
          .concat(all_criterias.selections ? all_criterias.selections : [])
          .concat(['No Group'])
      );
      // adjust count display
      console.log('data is:', JSON.parse(JSON.stringify(data)));
      console.log('all criteria:', JSON.parse(JSON.stringify(all_criterias)));
      console.log('special_decklists:', JSON.parse(JSON.stringify(special_decklists)));
      console.log('selections:', JSON.parse(JSON.stringify(selections)));
      data.grouped_decklists_count.forEach(([group, count]) => {
        const groupIndex = Object.keys(all_criterias['group_form_names']).find(
          (key) => all_criterias['group_form_names'][key] === group
        );
        console.log(
          `Updating count for group ${group}, index ${parseInt(groupIndex[0])}, ${count}`
        );
        const countElement = document.getElementById(
          `decklists-analyzed-count-group-${parseInt(groupIndex[0])}`
        );
        if (countElement) {
          countElement.textContent = `Decklists Analyzed: ${count}`;
        }
      });

      // Draw the graphs
      console.log('Drawing graphs...');
      d3.select('#timeseries_viz').html(''); // Clear previous timeseries visualization if present
      timeseriesGraph('#timeseries_viz', data['timeseries_winrates']);
      d3.select('#parallel_coordinates_viz').html(''); // Clear previous parallel coordinates visualization if present
      if (graphs_filters['parallel_coordinates_matchups'] === undefined) {
        graphs_filters['parallel_coordinates_matchups'] = {};
      }
      d3.select('#parallel_coordinates_viz').html(''); // Clear previous parallel coordinates visualization if present
      parallelCoordinatesGraph(
        '#parallel_coordinates_viz',
        data['parallel_coordinates_matchups'],
        graphs_filters['parallel_coordinates_matchups']
      );
      if (data['scatter_plot_card_presence']) {
        d3.select('#scatter_plot_viz').html(''); // Clear previous scatter plot visualization if present
        scatterPlotGraph('#scatter_plot_viz', data['scatter_plot_card_presence']);
      } else {
        scatterPlotGraph('#scatter_plot_viz', null, false);
      }
      // Fill the table
      fillTable(data['grouped_decklists']);
      console.log('All visualizations updated successfully.');
    }
  } catch (error) {
    console.error('Error processing form submission:', error);
  }
}

export async function restartViz() {
  console.log('Resetting all criteria and forms...');

  // Clear all forms
  formsContainer.innerHTML = '';

  // Reset all_criterias object
  all_criterias = {
    filters: {},
    group_form_names: {},
    groups: {},
    graphs: {
      timeseries_winrates: { type: 'timeseries'},
      parallel_coordinates_matchups: { type: 'parallel_coordinates' , matchups: []},
    },
    selections: [],
  };

  // Reset group index
  group_index = 0;

  // Add the first form
  createForm();

  console.log('All criteria and forms have been reset.');


  try {
    await getDataAndUpdateViz();
  } catch (error) {
    console.error('Error processing form submission:', error);
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
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch search names. Status: ${response.status}, ${response.statusText}`
      );
    }

    const searchNames = await response.json();
    console.log('Fetched search names successfully:', searchNames);

    // Populate the search list dropdown
    searchList.innerHTML = ''; // Clear existing options
    searchList.innerHTML = searchNames
      .map(
        (name) => `
      <option value="${name}">
      ${name}
      </option>
    `
      )
      .join('');

    // Add event listeners for delete button
    const deleteButton = document.getElementById('delete-search');
    deleteButton.addEventListener('click', async (event) => {
      event.stopPropagation(); // Prevent the dropdown from opening
      const selectedOption = document.querySelector('#search-list').value;
      console.log('Currently selected search:', selectedOption);
      if (!selectedOption) {
        alert('Search cannot be empty.');
        return;
      }

      if (!confirm(`Are you sure you want to delete the search "${selectedOption}"?`)) {
        return;
      }

      try {
        const response = await fetch(
          `http://localhost:3000/api/decklists/search/delete?search_name=${encodeURIComponent(
            selectedOption
          )}`,
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
          }
        );

        if (!response.ok) {
          throw new Error(
            `Failed to delete search. Status: ${response.status}, ${response.statusText}`
          );
        }

        console.log(`Search "${selectedOption}" deleted successfully.`);
        alert(`Search "${selectedOption}" deleted successfully.`);

        // Remove the option from the dropdown
        const optionToRemove = document.querySelector(`option[value="${selectedOption}"]`);
        if (optionToRemove) {
          optionToRemove.remove();
        }
      } catch (error) {
        console.error('Error deleting search:', error);
        alert('Failed to delete the search. Check the console for more details.');
      }
    });
  } catch (error) {
    console.error('Error fetching search names:', error);
    alert('Failed to fetch search names. Check the console for more details.');
  }
}

loadSearchNames();

export function setupLoadSearchListener() {
  const loadSearchBtn = document.getElementById('load-search');

  loadSearchBtn.addEventListener('click', async () => {
    const searchName = document.getElementById('search-list').value;
    if (!searchName) {
      alert('Search name cannot be empty.');
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:3000/api/decklists/search/load?search_name=${encodeURIComponent(
          searchName
        )}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to load search. Status: ${response.status}, ${response.statusText}`
        );
      }

      const loadedSearch = await response.json();
      console.log('Loaded search successfully:', JSON.parse(JSON.stringify(loadedSearch)));

      // Update all_criterias with the loaded search data
      all_criterias.group_form_names = loadedSearch.all_criterias.group_form_names || {};
      all_criterias.filters = loadedSearch.all_criterias.filters || {};
      all_criterias.groups = loadedSearch.all_criterias.groups || {};
      all_criterias.graphs = loadedSearch.all_criterias.graphs || {};
      all_criterias.selections = loadedSearch.all_criterias.selections || [];
      special_decklists = loadedSearch.special_decklists || {};

      console.log('Updated all_criterias:', JSON.parse(JSON.stringify(all_criterias)));

      addAndUpdateForms();
      await getDataAndUpdateViz();
    } catch (error) {
      console.error('Error loading search:', error);
      alert('Failed to load the search. Check the console for more details.');
    }
  });
}

setupLoadSearchListener();

export function setupSaveSearchListener() {
  const saveSearchBtn = document.getElementById('save-search');

  saveSearchBtn.addEventListener('click', async () => {
    const searchName = document.getElementById('search-name').value.trim();
    if (!searchName) {
      alert('Search name cannot be empty.');
      return;
    }

    try {
      const response = await fetch('http://localhost:3000/api/decklists/search/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ search_name: searchName, all_criterias, special_decklists }),
      });

      if (!response.ok) {
        let responseBody;
        try {
          responseBody = await response.json();
        } catch (error) {
          responseBody = { error: 'Failed to parse error response' };
        }
        alert(
          `Failed to save search. Status: ${response.status}, ${response.statusText}. Error: ${responseBody.error}`
        );
        throw new Error(
          `Failed to save search. Status: ${response.status}, ${response.statusText}, ${responseBody.error}`
        );
      }

      const result = await response.json();
      console.log('Search saved successfully:', result);
      alert('Search saved successfully.');
    } catch (error) {
      console.error('Error saving search:', error);
    }
  });
}

setupSaveSearchListener();

export async function loadSelectionNames() {
  try {
    const response = await fetch('http://localhost:3000/api/decklists/selection/names', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch selection names. Status: ${response.status}, ${response.statusText}`
      );
    }
    selections_names = await response.json();
  } catch (error) {
    console.error('Error fetching selection names:', error);
    return [];
  }
}

await loadSelectionNames();

console.log('Available selection names:', selections_names);

export async function loadSelection(selection_name) {
  try {
    const response = await fetch(
      `http://localhost:3000/api/decklists/selection/load?selection_name=${encodeURIComponent(
        selection_name
      )}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );
    if (!response.ok) {
      throw new Error(
        `Failed to fetch selection. Status: ${response.status}, ${response.statusText}`
      );
    }
    return response.json();
  } catch (error) {
    console.error('Error fetching selection:', error);
    return null;
  }
}

export async function loadAllSelections() {
  try {
    const response = await fetch('http://localhost:3000/api/decklists/selection/loadall', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch all selections. Status: ${response.status}, ${response.statusText}`
      );
    }

    console.log('Fetched all selections successfully.');
    console.log('Response data:', await response.clone().json());

    const selectionData = await response.json();
    if (Array.isArray(selectionData)) {
      for (const selection of selectionData) {
        if (selection?.name) {
          console.log(`Loading selection: ${selection.name}`, selection);
          let to_save = { ...selection };
          delete to_save.name; // Remove name from the selection object
          selections[selection.name] = to_save;
        } else {
          console.warn('Invalid selection format:', selection);
        }
      }
    } else {
      console.error('Unexpected response format:', selectionData);
    }
    console.log('All selections loaded:', JSON.parse(JSON.stringify(selections)));

    console.log('Adding selections to dropdown...');
    const selectionList = document.getElementById('selection-list');
    // Populate the selection list dropdown
    selectionList.innerHTML = ''; // Clear existing options
    selectionList.innerHTML = selections_names
      .map(
        (name) => `
      <option class="selection-option" value="${name}">
      ${name}
      </option>
    `
      )
      .join('');

    // Add hover tooltip for options
    const options = document.querySelectorAll('.selection-option');
    options.forEach((option) => {
      option.addEventListener('mouseover', (event) => {
        const tooltip = document.createElement('div');
        const selection_name = option.value;
        tooltip.className = 'tooltip';
        let innerText = `Filter: ${
          selection[selection_name] ? JSON.stringify(selection[selection_name].filter) : 'N/A'
        }`;
        innerText += `\nDate: ${
          selection[selection_name]
            ? JSON.stringify(Object.values(selection[selection_name].date))
            : 'N/A'
        }`;
        innerText += `\nN. Decklists: ${
          selection[selection_name] ? selection[selection_name].n_decklists : 'N/A'
        }`;
        tooltip.innerText = innerText;
        document.body.appendChild(tooltip);

        const rect = option.getBoundingClientRect();
        tooltip.style.left = `${rect.left + window.scrollX}px`;
        tooltip.style.top = `${rect.bottom + window.scrollY}px`;
      });
      option.addEventListener('mousemove', function (event) {
        const tooltip = document.querySelector('.tooltip');
        if (tooltip) {
          tooltip.style.left = `${event.clientX + 5}px`;
          tooltip.style.top = `${event.clientY + 5}px`;
        }
      });
      option.addEventListener('mouseout', function () {
        const tooltip = document.querySelector('.tooltip');
        if (tooltip) {
          tooltip.remove();
        }
      });
    });
  } catch (error) {
    console.error('Error loading all selections:', error);
  }
}

// Add event listeners for delete button
deleteButton.addEventListener('click', async (event) => {
  event.stopPropagation(); // Prevent the dropdown from opening
  const selectedOption = document.querySelector('#selection-list').value;
  console.log('Currently selected selection:', selectedOption);
  if (!selectedOption) {
    alert('Selection cannot be empty.');
    return;
  }

  if (!confirm(`Are you sure you want to delete the selection "${selectedOption}"?`)) {
    return;
  }

  try {
    const response = await fetch(
      `http://localhost:3000/api/decklists/selection/delete?selection_name=${encodeURIComponent(
        selectedOption
      )}`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to delete selection. Status: ${response.status}, ${response.statusText}`
      );
    }

    console.log(`Selection "${selectedOption}" deleted successfully.`);
    alert(`Selection "${selectedOption}" deleted successfully.`);

    // Remove the option from the dropdown
    const optionToRemove = document.querySelector(`option[value="${selectedOption}"]`);
    if (optionToRemove) {
      optionToRemove.remove();
    }
  } catch (error) {
    console.error('Error deleting selection:', error);
    alert('Failed to delete the selection. Check the console for more details.');
  }
});

await loadAllSelections();

// Add hover tooltip for refresh button
refreshBtn.addEventListener('mouseover', (event) => {
  tooltip
    .style('display', 'block')
    .html('Click to refresh searches, selections, and visualizations.')
    .style('left', event.pageX + 10 + 'px')
    .style('top', event.pageY - 28 + 'px');
});
refreshBtn.addEventListener('mousemove', (event) => {
  tooltip.style('left', event.pageX + 10 + 'px').style('top', event.pageY - 28 + 'px');
});
refreshBtn.addEventListener('mouseout', () => {
  tooltip.style('display', 'none');
});

export async function reloadSearchesSelections() {
  await loadSearchNames();
  await loadSelectionNames();
  await loadAllSelections();
}

refreshBtn.addEventListener('click', async () => {
  try {
    await reloadSearchesSelections();
    await getDataAndUpdateViz();
    alert('Viz Refreshed');
  } catch (error) {
    console.error('Error reloading searches and selections:', error);
    alert('Failed to reload searches and selections. Check the console for more details.');
  }
});

// Aggiungi il primo form all'avvio
if (Object.keys(all_criterias.group_form_names).length === 0) {
  createForm();
}

// Fetch all decklists and fill the table
export async function fetchAndFillAllDecklists() {
  try {
    const response = await fetch('http://localhost:3000/api/decklists', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch all decklists. Status: ${response.status}, ${response.statusText}`
      );
    }

    allDecklists = await response.json();
    console.log('Fetched all decklists successfully:', allDecklists);

    // Set the color function for groups and selections
    color = d3
      .scaleOrdinal()
      .domain(
        Object.values(['No Group'].concat(all_criterias['group_form_names'])).concat(
          all_criterias.selections ? all_criterias.selections : []
        )
      )
      .range(range_of_colors); // Ensure "No Group" always has the same color

    // Fill the table with the fetched decklists
    fillTable(allDecklists);
  } catch (error) {
    console.error('Error fetching all decklists:', error);
    alert('Failed to fetch all decklists. Check the console for more details.');
  }
}

// Fetch and fill the table with all decklists on page load
await fetchAndFillAllDecklists();

restartViz();
