import express from 'express';
import cors from 'cors';
import { readFile } from 'fs/promises';

const app = express();
const PORT = 3000;
app.use(cors());
app.use(express.json());
app.use(express.static('dist'));
app.use(express.static('.'));

const decklists_file = "src/decklists.json";
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

function calculateWinrates(groupedDecklists) {
    console.log('Calculating winrates for grouped decklists');
    const winrates = {};

    for (const [group, decklists] of Object.entries(groupedDecklists)) {
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
        const { filterCriteria, groupCriteria } = req.body;
        console.log('Filter criteria:', filterCriteria);
        console.log('Group criteria:', groupCriteria);
        let filtered = filterDecklists(decklists, filterCriteria);
        filtered = extractMetadataAndMatchup(filtered);
        res.json(filtered);
        console.log('Response sent with winrate data');
    } catch (error) {
        console.error('Error in /api/decklists/winrate:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});