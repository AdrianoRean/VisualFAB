import express from 'express';
import cors from 'cors';
import { readFile } from 'fs/promises';

const app = express();
const PORT = 3000;
app.use(cors());
app.use(express.json());
app.use(express.static('dist'));
app.use(express.static('.'));

const decklists_file = "src/decklists_date.json";
console.log(`Reading decklists from file: ${decklists_file}`);
const data = await readFile(decklists_file, 'utf-8');
const decklists = JSON.parse(data);
console.log(`Loaded ${decklists.length} decklists`);

function filterDecklists(decklists, criteria) {
    console.log('Filtering decklists with criteria:', criteria);
    const filtered = decklists.filter(decklist => {
        return Object.entries(criteria).every(([key, value]) => {
            if (value.precision === 'RANGE') {
                return decklist.Metadata[key] >= value.min && decklist.Metadata[key] <= value.max;
            } else if (value.precision === 'IS-IN') {
                return decklist.Metadata[key].includes(value.value);
            } else {
                return decklist.Metadata[key] === value.value;
            }
        });
    });
    console.log(`Filtered down to ${filtered.length} decklists`);
    return filtered;
}

function groupDecklists(decklists, groupCriteria) {
    console.log('Grouping decklists with group criteria:', groupCriteria);
    const grouped = {};

    for (const group of groupCriteria) {
        const groupKey = group["name"];
        const grouped_decklists = filterDecklists(decklists, group["filter"]);
        grouped[groupKey] = grouped_decklists;
        console.log(`Group "${groupKey}" contains ${grouped_decklists.length} decklists`);
    }

    return grouped;
}

/**
 * Filters decklists based on the provided criteria.
 * @param {dictionary} groupedDecklists - a dictionary of grouped decklists.
 * @returns {dictionary} returns a dictionary that for each previous group contains the grouped and sorted decklists by date as pair <date, decklists[]>.
 */
function groupAndSortGroupsByDate(groupedDecklists) {
    console.log('Sorting grouped decklists by date');
    const sortedGroups = {};
    console.log('Starting to sort grouped decklists by date');

    for (const [group, decklists] of Object.entries(groupedDecklists)) {
        console.log(`Processing group "${group}" with ${decklists.length} decklists`);
        const subgroups = {};

        // Divide decklists into subgroups by Metadata.Date
        for (const decklist of decklists) {
            const date = decklist.Metadata.Date;
            if (!subgroups[date]) {
                subgroups[date] = [];
            }
            subgroups[date].push(decklist);
        }
        console.log(`Divided group "${group}" into ${Object.keys(subgroups).length} subgroups by date`);

        // Sort subgroups by date in ascending order
        const sortedSubgroups = Object.keys(subgroups)
            .sort((a, b) => new Date(a) - new Date(b)) // Compare dates
            .reduce((acc, date) => {
                acc[date] = subgroups[date];
                return acc;
            }, {});

        console.log(`Sorted subgroups for group "${group}" by date`);
        sortedGroups[group] = sortedSubgroups;
    }

    console.log('Finished sorting all groups by date');
    return sortedGroups;
    
}

function calculateWinrates(groupedDecklists) {
    console.log('Calculating winrates for grouped decklists');
    const winrates = {};

    for (const [group, decklists] of Object.entries(groupedDecklists)) {
        //console.log(`Group "${group}", Decklists:`, decklists.slice(0, 3));
        const totalGames = decklists.reduce((sum, decklist) => sum + decklist.Metadata["Classic Constructed Played Rounds"], 0);
        const totalWins = decklists.reduce((sum, decklist) => sum + decklist.Metadata["Classic Constructed Wins"], 0);
        winrates[group] = totalGames > 0 ? (totalWins / totalGames) * 100 : 0;
        console.log(`Winrate for group "${group}": ${winrates[group].toFixed(2)}%`);
    }

    return winrates;
}

function extractMetadataAndMatchup(decklists) {
    console.log('Extracting metadata and matchups');
    return decklists.map(decklist => ({
        Metadata: decklist.Metadata,
        Matchup: decklist["Classic Constructed Matchups"]
    }));
}

// Serve default index.html
app.get('/', (req, res) => {
    console.log('Serving index.html');
    res.sendFile('index.html', { root: '.' });
});

// API endpoint
app.post('/api/decklists', async (req, res) => {
    try {
        console.log('POST /api/decklists - Request received');
        const criteria = req.body;
        console.log('Filter criteria:', criteria);
        let filtered = filterDecklists(decklists, criteria);
        filtered = extractMetadataAndMatchup(filtered);
        res.json(filtered);
        console.log('Response sent with filtered decklists');
    } catch (error) {
        console.error('Error in /api/decklists:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/decklists/winrate', async (req, res) => {
    try {
        console.log('POST /api/decklists/winrate - Request received');
        const filterCriteria = req.body["filter criteria"];
        const groupCriteria = req.body["group criteria"];
        console.log('Filter criteria:', filterCriteria);
        console.log('Group criteria:', groupCriteria);
        let filtered = filterDecklists(decklists, filterCriteria);
        filtered = extractMetadataAndMatchup(filtered);
        let grouped_decklists = groupDecklists(filtered, groupCriteria);

        let final_groups = {};
        let min_date = null;
        let max_date = null;
        console.log("Starting to process each group for winrate calculation");
        for (const [group, lists] of Object.entries(grouped_decklists)) {
          console.log(`Group "${group}" contains ${lists.length} decklists`);
          // You can further process each group's decklists if needed
          const time_divided_groups = groupAndSortGroupsByDate({ [group]: lists });
          console.log("Time divided groups");
          let timed_winrates = [];
          for (const [subgroup, dlists] of Object.entries(time_divided_groups)) {
            console.log(`Processing subgroup "${subgroup}"`);
            time_divided_groups[subgroup] = calculateWinrates(dlists);
          }
          for (const [date, winrate] of Object.entries(time_divided_groups[group])) {
            timed_winrates.push({ date, winrate });
            if (!min_date || new Date(date) < new Date(min_date)) {
                console.log(`Updating min_date: ${min_date} -> ${date}`);
                min_date = date;
            }
            if (!max_date || new Date(date) > new Date(max_date)) {
                console.log(`Updating max_date: ${max_date} -> ${date}`);
                max_date = date;
            }
          }
          console.log("Timed winrates:", timed_winrates);
          final_groups[group] = timed_winrates;
        }
        final_groups["Metadata"] = {
          min_date,
          max_date
        };
        console.log('Final groups:', final_groups);
        res.json(final_groups);
        console.log('Response sent with winrate data');
    } catch (error) {
        console.error('Error in /api/decklists/winrate:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});