// filepath: c:\Users\adria\GitHub\VisualFAB\main.mjs
import * as d3 from 'd3';
import { readFile } from 'fs/promises';
console.log('d3 version:', d3.version);

example = true;

const decklists_file = "decklists.json";

// Load the decklists file

async function loadDecklists() {
    try {
        const data = await readFile(decklists_file, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading decklists:', error);
        return [];
    }
}

// Helper function to filter decklists by criteria
function filterDecklists(decklists, criteria) {
    return decklists.filter(decklist => {
        return Object.entries(criteria).every(([key, value]) => {
            if (isRangeCriteria(value)) {
                // Check if the value falls within the specified range
                return isWithinRange(decklist.Metadata[key], value);
            } else {
                // Check for an exact match
                return isExactMatch(decklist.Metadata[key], value);
            }
        });
    });
}

// Helper function to check if the criteria is a range
function isRangeCriteria(value) {
    return typeof value === 'object' && value.min !== undefined && value.max !== undefined;
}

// Helper function to check if a value is within a range
function isWithinRange(value, range) {
    return value >= range.min && value <= range.max;
}

// Helper function to check for an exact match
function isExactMatch(value, expected) {
    //console.log(`Comparing value: ${value} with expected: ${expected}`);
    return value === expected;
}

// Function to extract only Metadata and Matchup fields from decklists
function extractMetadataAndMatchup(decklists) {
    return decklists.map(decklist => ({
        Metadata: decklist.Metadata,
        Matchup: decklist["Classic Constructed Matchups"]
    }));
}

// Example usage
if (example){
    (async () => {
        const decklists = await loadDecklists();
        var filteredDecklists = filterDecklists(decklists, {
            "Format": 'Classic Constructed',
            "Rank": {min: 1, max: 8}
            //"Power Level": { min: 3, max: 5 }
        });
        var filteredDecklists = extractMetadataAndMatchup(filteredDecklists);
        console.log('Filtered Decklists:', filteredDecklists);
    })();
}
