import express from 'express';
import cors from 'cors';
import { readFile } from 'fs/promises';

const app = express();
const PORT = 3000;
app.use(cors());
app.use(express.json());

const decklists_file = "decklists.json";
const data = await readFile(decklists_file, 'utf-8');
const decklists = JSON.parse(data);

// Filtering logic (reuse your helpers)
function isRangeCriteria(value) {
    return typeof value === 'object' && value.min !== undefined && value.max !== undefined;
}
function isWithinRange(value, range) {
    return value >= range.min && value <= range.max;
}
function isExactMatch(value, expected) {
    return value === expected;
}
function filterDecklists(decklists, criteria) {
    return decklists.filter(decklist => {
        return Object.entries(criteria).every(([key, value]) => {
            if (isRangeCriteria(value)) {
                return isWithinRange(decklist.Metadata[key], value);
            } else {
                return isExactMatch(decklist.Metadata[key], value);
            }
        });
    });
}
function extractMetadataAndMatchup(decklists) {
    return decklists.map(decklist => ({
        Metadata: decklist.Metadata,
        Matchup: decklist["Classic Constructed Matchups"]
    }));
}

// Serve default index.html
app.get('/', (req, res) => {
    res.sendFile('index.html', { root: '.' });
});

// API endpoint
app.post('/api/decklists', async (req, res) => {
    try {
        const criteria = req.body;
        let filtered = filterDecklists(decklists, criteria);
        filtered = extractMetadataAndMatchup(filtered);
        res.json(filtered);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});