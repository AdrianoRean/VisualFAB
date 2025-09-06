import express from 'express';
import cors from 'cors';
import { UMAP } from 'umap-js';
import { writeFile, readFile } from 'fs/promises';
import path from 'path';
import { match } from 'assert';
import { filter } from 'd3';

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

function filterDecklists(decklists, criteria, decksToCompare = {}) {
    console.log('Filtering decklists with criteria:', criteria);
    const filtered = decklists.filter(decklist => {
        return Object.entries(criteria).every(([key, value]) => {
            if (value.precision === 'RANGE') {
                return decklist.Metadata[key] >= value.value.min && decklist.Metadata[key] <= value.value.max;
            } else if (value.precision === 'DATE') {
                const decklistDate = new Date(decklist.Metadata[key]);
                const minDate = new Date(value.value.min);
                const maxDate = new Date(value.value.max);
                return decklistDate >= minDate && decklistDate <= maxDate;
            } else if (value.precision === 'IS') {
                return decklist.Metadata[key] === value.value;
            }else if (value.precision === 'IS-IN') {
                return value.value.some(item => item === decklist.Metadata[key]);
            } else if (value.precision === 'COMPOUND') {
                if (key === 'Matchups Winrate') {
                    let flag = true;
                    Object.entries(value.value).forEach(([matchup, values]) => {
                        let played = 0;
                        let wins = 0;
                        decklist["Classic Constructed Matchups"].forEach(round => {
                            if (values.type === "selection") {
                                const opponentDeck = decksToCompare[matchup].includes(round["Opponent"]);
                                if (opponentDeck) {
                                    played += 1;
                                    if (round["Result"] === "W") {
                                        wins += 1;
                                    }
                                }
                            } else if (values.type === "hero") {
                                if (round["Opponent Hero"] === matchup){
                                    played += 1;
                                    if (round["Result"] === "W") {
                                        wins += 1;
                                    }
                                }
                            }
                        });
                        if (played > 0){
                            let winrate = wins / played * 100;
                            //console.log("Winrate for", matchup, "is", winrate);
                            if ((winrate >= values.min && winrate <= values.max) === false) {
                                //console.log("Winrate is out of bounds");
                                flag = false;
                            } else {

                                //console.log("Winrate for", matchup, "Decklist ID", decklist.Metadata.Id, "is", winrate);
                                //console.log("Winrate is within bounds");
                            }
                        } else {
                            //console.log("Not played against", matchup);
                        }
                    });
                    
                    return flag;
                }
            } else {
                return decklist.Metadata[key] === value.value;
            }
        });
    });
    console.log(`Filtered down to ${filtered.length} decklists`);
    return filtered;
}

function groupDecklists(decklists, groupCriteria, decklistsToCompare = {}) {
    console.log('Grouping decklists with group criteria:', groupCriteria);
    const grouped = {};

    for (const [groupKey, group] of Object.entries(groupCriteria)) {
        console.log("Filtering groups with filters:");
        Object.entries(group["filter"]).forEach(([key, value]) => {
            console.log(` - ${key}:`, value);
        });
        const grouped_decklists = filterDecklists(decklists, group["filter"], decklistsToCompare);
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
        winrates[group] = {
            winrate: totalGames > 0 ? (totalWins / totalGames) * 100 : 0,
            playedRounds: totalGames
        };
        console.log(`Winrate for group "${group}": ${winrates[group]["winrate"].toFixed(2)}%`);
    }

    return winrates;
}

function extractMetadataAndMatchup(decklists) {
    console.log('Extracting metadata and matchups');
    return decklists.map(decklist => ({
        Metadata: decklist.Metadata,
        "Classic Constructed Matchups": decklist["Classic Constructed Matchups"]
    }));
}

function timeseriesWinrates(grouped_decklists) {
    try {
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
        return final_groups;
    } catch (error) {
        console.error('Error in /api/decklists/winrate:', error.message);
        //res.status(500).json({ error: error.message });
    }
};

function parallelMatchups(grouped_decklists, matchups_array, decklistsToCompare={}) {
    try{
        // Implementation for parallelMatchups
        //console.log('Grouped decklists:', grouped_decklists);
        console.log('Matchups:', matchups_array);
        // Here you would implement the logic for parallel matchups
        /*
        Object.entries(matchups).forEach(([matchup_name, matchup_data]) => {
            console.log(`Processing matchup "${matchup_name}" with data:`, matchup_data);
            // Implement the logic for each matchup
            if (matchup_data.type === 'COMPOUND') {
                // Handle compound matchups
                console.log(`Handling compound matchup "${matchup_name}"`);

                // GET ID OF EACH DECKLIST CORRESPONDING TO FILTERS IN ORDER TO USE IT LATER TO CHECK IF DECKS HAVE BEATEN THOSE MATCHUPS
                // IS IT POSSIBLE?
            } else if (matchup_data.type === 'SIMPLE') {
                // Handle simple matchups
                console.log(`Handling simple matchup "${matchup_name}"`);
                // Implement the logic for simple matchups

            }
        });
        */
    let grouped_matchup_winrates = {};
        matchups_array.forEach(matchup => {
            console.log("Processing matchup:", matchup);
            Object.entries(grouped_decklists).forEach(([group_name, decklists]) => {
                console.log(`Processing group "${group_name}"`);
                grouped_matchup_winrates[group_name] = grouped_matchup_winrates[group_name] ? grouped_matchup_winrates[group_name] : [];
                let matchupStats = {};

                for (const decklist of decklists) {
                    const played_matchups = decklist["Classic Constructed Matchups"];
                    for (const round of played_matchups) {
                        if (matchup.type === "selection") {
                            const opponentID = round["Opponent"];
                            if (!decklistsToCompare[matchup.name].includes(opponentID)) {
                                continue;
                            } else {
                                if (!matchupStats[matchup.name]) {
                                    console.log("Initializing stats for matchup:", matchup.name);
                                    matchupStats[matchup.name] = { played: 0, wins: 0, losses: 0, draws: 0, double_losses: 0 };
                                }
                                matchupStats[matchup.name].played += 1;
                                if (round["Result"] === "W") {
                                    matchupStats[matchup.name].wins += 1;
                                } else if (round["Result"] === "L") {
                                    matchupStats[matchup.name].losses += 1;
                                } else if (round["Result"] === "D") {
                                    matchupStats[matchup.name].draws += 1;
                                } else {
                                    matchupStats[matchup.name].double_losses += 1;
                                }
                            }
                        } else if (matchup.type === "hero") {
                            const opponentHero = round["Opponent Hero"];
                            if (opponentHero !== matchup.name) {
                                continue;
                            } else {
                                if (!matchupStats[opponentHero]) {
                                    matchupStats[opponentHero] = { played: 0, wins: 0, losses: 0, draws: 0, double_losses: 0 };
                                }
                                matchupStats[opponentHero].played += 1;
                                if (round["Result"] === "W") {
                                    matchupStats[opponentHero].wins += 1;
                                } else if (round["Result"] === "L") {
                                    matchupStats[opponentHero].losses += 1;
                                } else if (round["Result"] === "D") {
                                    matchupStats[opponentHero].draws += 1;
                                } else {
                                    matchupStats[opponentHero].double_losses += 1;
                                }
                            }
                        }
                    }
                }

                console.log(`Processed ${decklists.length} decklists for group "${group_name}"`);

                for (const [matchup_name, stats] of Object.entries(matchupStats)) {
                    const winrate = stats.played > 0 ? (stats.wins / stats.played) * 100 : 0;
                    const playedRounds = stats.played;
                    grouped_matchup_winrates[group_name].push({ "matchup": matchup_name, winrate, playedRounds});
                    console.log(`Matchup: ${matchup_name}, Played: ${stats.played}, Wins: ${stats.wins}, Winrate: ${winrate.toFixed(2)}%`);
                }
            });
        });
        console.log('Finished calculating matchup winrates for all groups');
        grouped_matchup_winrates["Dimensions"] = Object.values(matchups_array).map(matchup => matchup.name).sort();
        return grouped_matchup_winrates;
    } catch (error) {
        console.error('Error in /api/decklists/winrate:', error.message);
        //res.status(500).json({ error: error.message });
    }
}

function constructCardMatrix(grouped_decklists) {
    console.log('Constructing card matrix from grouped decklists');
    const decklists = Object.values(grouped_decklists).flat();
    const decklistToGroup = {};
    Object.entries(grouped_decklists).forEach(([group, lists]) => {
        lists.forEach(decklist => {
            decklistToGroup[decklist.Metadata["List Id"]] = group;
        });
    });
    console.log('Constructing card matrix from decklists');
    const cardMatrix = new Array(decklists.length).fill([]);
    const cardInfo = new Array(decklists.length).fill([]);
    const cardNames = [];
    const cardIndexes = {};
    let decklist_index = 0;
    let index = 0;

    decklists.forEach(decklist => {
        decklist.Cards.forEach(card => {
            const card_name = (card.card_name + " " + card.color).trim();
            const cardName = card_name;
            if (!cardNames.includes(card_name)) {
                cardNames.push(card_name);
                cardIndexes[card_name] = index++;
            }
        });
    });

    decklists.forEach(decklist => {
        //.log(`Processing decklist ID: ${decklist.Metadata.Id}`);
        cardMatrix[decklist_index] = new Array(cardNames.length).fill(0);
        cardInfo[decklist_index] = {
            id: decklist.Metadata["List Id"],
            date: decklist.Metadata.Date,
            event: decklist.Metadata.Event,
            rank: decklist.Metadata.Rank,
            hero: decklist.Metadata.Hero,
            group: decklistToGroup[decklist.Metadata["List Id"]] || "Ungrouped"
        };
        decklist.Cards.forEach(card => {
            const card_name = (card.card_name + " " + card.color).trim();
            //console.log(`Processing card: ${card.Name}`);
            cardMatrix[decklist_index][cardIndexes[card_name]] = parseInt(card.quantity);
            //console.log(`Card "${card.Name}" index: ${cardIndexes[card.Name]}, count: ${cardMatrix[decklist.ID]["data"][cardIndexes[card.Name]]}`);
        });
        decklist_index++;
    });

    console.log('Finished constructing card matrix');
    return {cardMatrix, cardInfo};
}

async function performUMAP(decklistsMatrix) {

    const {cardMatrix, cardInfo} = decklistsMatrix;
    //shape = [n_decks, n_cards]
    const umap = new UMAP({
        nComponents: 2,
        minDist: 0.1,
        metric: 'cosine', //'euclidean' 'jaccard'
    });

    let embedding = await umap.fitAsync(cardMatrix);
    const reshapedEmbedding = {
        component1: embedding.map(point => point[0]),
        component2: embedding.map(point => point[1])
    };
    embedding = embedding.map((point, index) => [
        point[0],
        point[1],
        cardInfo[index]
    ]);

    const min_x = Math.min(...reshapedEmbedding.component1);
    const max_x = Math.max(...reshapedEmbedding.component1);
    const min_y = Math.min(...reshapedEmbedding.component2);
    const max_y = Math.max(...reshapedEmbedding.component2);

    console.log('UMAP reshaped embedding range:', { minX: min_x, maxX: max_x, minY: min_y, maxY: max_y });
    return { 
        "data": embedding, 
        "Metadata": { min_x: min_x, max_x: max_x, min_y: min_y, max_y: max_y } 
    };
}

const searchFilePath = path.join('search', 'searches.json');

// Helper function to load searches from file
async function loadSearches() {
    try {
        const data = await readFile(searchFilePath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('Search file not found, initializing empty search list');
            return [];
        } else {
            throw error;
        }
    }
}

// Helper function to save searches to file
async function saveSearches(searches, newSearch) {
    try {
        if (searches.some(search => search.search_name === newSearch.search_name)) {
            throw new Error('A search with the same name already exists');
        }
        searches.push(newSearch);
        await writeFile(searchFilePath, JSON.stringify(searches, null, 2), 'utf-8');
        console.log('Searches saved successfully');
    } catch (error) {
        console.error('Error saving searches:', error.message);
        throw error;
    }
}

async function deleteSearch(search_name) {
    try {
        const data = await readFile(searchFilePath, 'utf-8');
        const searches = JSON.parse(data);
        const updatedSearches = searches.filter(search => search.search_name !== search_name);
        await writeFile(searchFilePath, JSON.stringify(updatedSearches, null, 2), 'utf-8');
        console.log(`Search "${search_name}" deleted successfully`);
    } catch (error) {
        console.error('Error deleting search:', error.message);
        throw error;
    }
}

const selectionFilePath = path.join('selections', 'selections.json');

async function saveSelections(selections, newSelection) {
    try {
        if (selections.some(selection => selection.name === newSelection.name)) {
            throw new Error('A selection with the same name already exists');
        }
        selections.push(newSelection);
        await writeFile(selectionFilePath, JSON.stringify(selections, null, 2), 'utf-8');
        console.log('Selections saved successfully');
    } catch (error) {
        console.error('Error saving selections:', error.message);
        throw error;
    }
}

async function loadSelectionNames() {
    try {
        const data = await readFile(selectionFilePath, 'utf-8');
        const selections = JSON.parse(data);
        return selections.map(selection => selection.name);
    } catch (error) {
        console.error('Error loading selections:', error.message);
        throw error;
    }
}

async function loadSelection(selection_name) {
    try {
        const data = await readFile(selectionFilePath, 'utf-8');
        const selections = JSON.parse(data);
        return selections.find(selection => selection.name === selection_name);
    } catch (error) {
        console.error('Error retrieving selection:', error.message);
        throw error;
    }
}

async function deleteSelection(selection_name) {
    try {
        const data = await readFile(selectionFilePath, 'utf-8');
        const selections = JSON.parse(data);
        const updatedSelections = selections.filter(selection => selection.name !== selection_name);
        await writeFile(selectionFilePath, JSON.stringify(updatedSelections, null, 2), 'utf-8');
        console.log(`Selection "${selection_name}" deleted successfully`);
    } catch (error) {
        console.error('Error deleting selection:', error.message);
        throw error;
    }
}

// Serve default index.html
app.get('/', (req, res) => {
    console.log('Serving index.html');
    res.sendFile('index.html', { root: '.' });
});

app.get('/api/formData', (req, res) => {
    console.log('GET /api/formData - Request received');
    const formData = {
        heroes: [...new Set(decklists.flatMap(decklist => decklist.Metadata.Hero))],
        formats: [...new Set(decklists.map(decklist => decklist.Metadata.Format))]
    };
    res.json(formData);
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

app.post('/api/decklists/calculate', async (req, res) => {
    try {
        console.log('\n ******************** \n POST /api/decklists/calculate - Request received \n ******************** \n ');
        const filterCriteria = req.body.filters;
        const groupCriteria = req.body.groups;
        const graph_requests = req.body.graphs;
        const selections = req.body.selections;
        console.log('Filter criteria:', filterCriteria);
        console.log('Group criteria:', groupCriteria);
        console.log('Graph requests:', graph_requests);
        console.log('Selections requests:', selections);
        const decksToCompare = {};
        if (selections.length > 0) {
            console.log("Loading selections for parallel coordinates matchups:", selections);
            for (const selection_name of selections) {
                const selection = await loadSelection(selection_name);
                console.log(`Selection "${selection_name}" loaded with ${selection.decklists_ID.length} decklists`);
                decksToCompare[selection_name] = selection ? selection.decklists_ID : [];
            }
        }
        console.log("Start Filtering and grouping decklists");
        const filtered = filterDecklists(decklists, filterCriteria);
        let grouped_decklists = groupDecklists(filtered, groupCriteria, decksToCompare);
        let json_response = {
            "grouped_decklists_count": Object.entries(grouped_decklists).map(([group, lists]) => [group, lists.length])
        };
        for (const [graph_name, request_data] of Object.entries(graph_requests)) {
            console.log(`Processing ${graph_name} with data:`, request_data);
            // Here you would call the appropriate function to handle each graph type
            switch (request_data.type) {
            case 'timeseries':
                // Call the function to handle timeseries graph
                let timeseries_data = timeseriesWinrates(grouped_decklists);
                json_response[graph_name] = timeseries_data;
                break;
            case 'parallel_coordinates':
                // Call the function to handle parallel coordinates graph
                let parallel_coordinates_data = parallelMatchups(grouped_decklists, request_data.matchups, decksToCompare);
                json_response[graph_name] = parallel_coordinates_data;
                break;
            case 'scatter_plot':
                // Call the function to handle scatter plot graph
                let scatter_plot_data = await performUMAP(constructCardMatrix(grouped_decklists));
                json_response[graph_name] = scatter_plot_data;
                break;
            default:
                console.warn(`Unknown graph type: ${request_data.type}`);
            }
        }
        console.log('Finished processing graph requests');
        res.json(json_response);
    } catch (error) {
        console.error('Error in /api/decklists/calculate:', error.message);
        res.status(500).json({ error: error.message });
    }
});
// API to load a specific search by name
app.get('/api/decklists/search/load', async (req, res) => {
    try {
        console.log('GET /api/decklists/search/load - Request received');
        const searchName = req.query.search_name;
        console.log('Search name:', searchName);

        const searches = await loadSearches();
        const search = searches.find(s => s.search_name === searchName);
        console.log('Found search:', search);

        if (search) {
            res.json(search);
            console.log('Response sent with search:', search);
        } else {
            res.status(404).json({ error: 'Search not found' });
            console.log('Search not found');
        }
    } catch (error) {
        console.error('Error in /api/decklists/search/load:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// API to save a new search
app.post('/api/decklists/search/save', async (req, res) => {
    try {
        console.log('POST /api/decklists/search/save - Request received');
        const newSearch = req.body;
        console.log('New search:', newSearch);

        const searches = await loadSearches();
        await saveSearches(searches, newSearch);

        res.status(201).json({ message: 'Search saved successfully' });
        console.log('New search saved');
    } catch (error) {
        console.error('Error in /api/decklists/search/save:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// API to get the list of search names
app.get('/api/decklists/search/names', async (req, res) => {
    try {
        console.log('GET /api/decklists/search/names - Request received');
        const searches = await loadSearches();
        const searchNames = searches.map(s => s.search_name);
        res.json(searchNames);
        console.log('Response sent with search names:', searchNames);
    } catch (error) {
        console.error('Error in /api/decklists/search/names:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/decklists/search/delete', async (req, res) => {
    try {
        console.log('DELETE /api/decklists/search/delete - Request received');
        const searchName = req.query.search_name;
        console.log('Search name to delete:', searchName);

        await deleteSearch(searchName);
        res.status(204).send();
        console.log('Search deleted successfully');
    } catch (error) {
        console.error('Error in /api/decklists/search/delete:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// API to save a new selection
app.post('/api/decklists/selection/save', async (req, res) => {
    try {
        console.log('POST /api/decklists/selection/save - Request received');
        let newSelection = { ...req.body };
        console.log('Selection info:', newSelection);
        let decklistsInSelections = {};
        for (const name of Object.values(newSelection.selections)) {
            try {
                decklistsInSelections[name] = (await loadSelection(name))["decklists_ID"];
            } catch (error) {
                console.error(`Error loading selection for ${name} while saving for ${newSelection.name}:`, error.message);
            }
        }
        console.log("Decklists in selections:", decklistsInSelections);
        const decklists_ID = filterDecklists(decklists, newSelection.filter, decklistsInSelections).map(dl => dl["Metadata"]["List Id"]);
        newSelection["decklists_ID"] = decklists_ID;
        newSelection["n_decklists"] = decklists_ID.length;
        newSelection["date"] = new Date().toISOString();

        const selections = JSON.parse(await readFile(selectionFilePath, 'utf-8'));
        await saveSelections(selections, newSelection);

        res.status(201).json({ message: 'Selection saved successfully' });
        console.log('New selection saved');
    } catch (error) {
        console.error('Error in /api/decklists/selection/save:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// API to get the list of selection names
app.get('/api/decklists/selection/names', async (req, res) => {
    try {
        console.log('GET /api/decklists/selection/names - Request received');
        const selectionNames = await loadSelectionNames();
        res.json(selectionNames);
        console.log('Response sent with selection names:', selectionNames);
    } catch (error) {
        console.error('Error in /api/decklists/selection/names:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// API to load a specific selection by name
app.get('/api/decklists/selection/load', async (req, res) => {
    try {
        console.log('GET /api/decklists/selection/load - Request received');
        const selectionName = req.query.selection_name;
        console.log('Selection name:', selectionName);

        const selection = await loadSelection(selectionName);
        if (selection) {
            res.json(selection);
            console.log('Response sent with selection:', selection.name);
        } else {
            res.status(404).json({ error: 'Selection not found' });
            console.log('Selection not found');
        }
    } catch (error) {
        console.error('Error in /api/decklists/selection/load:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/decklists/selection/loadall', async (req, res) => {
    try {
        console.log('GET /api/decklists/selection/loadall - Request received');
        const selections = JSON.parse(await readFile(selectionFilePath, 'utf-8'));
        res.json(selections);
        console.log('Response sent with all selections');
    } catch (error) {
        console.error('Error in /api/decklists/selection/loadall:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/decklists/selection/delete', async (req, res) => {
    try {
        console.log('DELETE /api/decklists/selection/delete - Request received');
        const selectionName = req.query.selection_name;
        console.log('Selection name to delete:', selectionName);
        await deleteSelection(selectionName);
        res.status(204).send();
        console.log('Selection deleted successfully');
    } catch (error) {
        console.error('Error in /api/decklists/selection/delete:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
