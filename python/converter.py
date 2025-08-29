import json
import os

def convert_decklists_to_dict(file_path):
    def capitalize_words(s):
        return ' '.join(word.capitalize() for word in s.split())

    with open(file_path, "r") as infile:
        decklists = json.load(infile)
    decklists_dict = {}
    for decklist in decklists:
        if "id" in decklist:
            deck_id = decklist["id"]
            new_decklist = {}
            for k, v in decklist.items():
                if k == "id":
                    continue
                if k == "metadata" and isinstance(v, dict):
                    # Capitalize all words in keys in metadata
                    new_decklist["Metadata"] = {capitalize_words(meta_k): meta_v for meta_k, meta_v in v.items()}
                else:
                    new_decklist[capitalize_words(k)] = v
            new_decklist["Metadata"]["Double Losses"] = 0
            decklists_dict[deck_id] = new_decklist
    return decklists_dict

def denest_matchups_and_adjust_metadata_names(decklists_dict):
    with open(file_path, "r") as infile:
        decklists = json.load(infile)
        decklists_dict = {}
        for id, decklist in decklists.items():
            new_decklist = {}
            for k, v in decklist.items():
                if k == "Metadata" and isinstance(v, dict):
                    new_metadata = {}
                    for meta_k, meta_v in v.items():
                        if meta_k in ["Wins", "Losses", "Double Losses", "Draws", "Played Rounds", "Top Rounds"]:
                            new_metadata[f"Classic Constructed {meta_k}"] = meta_v
                        elif meta_k == "Matchups":
                            pass
                        else:
                            new_metadata[meta_k] = meta_v
                    new_decklist["Metadata"] = new_metadata
                else:
                    new_decklist[k] = v
            new_decklist["Metadata"]["Rank"] = 0
            new_decklist["Metadata"]["Total Swiss Wins"] = 0
            new_decklist["Classic Constructed Matchups"] = decklist["Metadata"]["Matchups"]
            decklists_dict[id] = new_decklist
    return decklists_dict

if __name__ == "__main__":
    '''decklist_folder = "decklists_adjusted"
    for filename in os.listdir(decklist_folder):
        if filename.endswith(".json"):
            file_path = os.path.join(decklist_folder, filename)
            decklists_dict = denest_matchups_and_adjust_metadata_names(file_path)
            output_path = os.path.join("decklists_adjusted copy", f"{os.path.splitext(filename)[0]}.json")
            with open(output_path, "w") as outfile:
                json.dump(decklists_dict, outfile, indent=2)'''
                
    input_folder = "decklists_good"
    results_folder = "decklists_with_results_no_standings"
    output_folder = "decklist_adjusted"

    # Ensure the output folder exists
    os.makedirs(output_folder, exist_ok=True)

    for filename in os.listdir(input_folder):
        if filename.endswith(".json"):
            national_name = filename.split("_")[-1]  # Extract the national name
            results_filename = f"nationals_decklists_results_{national_name}"
            print(f"Processing {filename} with results file {results_filename}")

            input_path = os.path.join(input_folder, filename)
            results_path = os.path.join(results_folder, results_filename)
            output_path = os.path.join(output_folder, filename)

            if os.path.exists(results_path):
                with open(input_path, "r") as file:
                    decklists = json.load(file)
                with open(results_path, "r") as file:
                    decklists2 = json.load(file)
                    
                print(f"Loaded {len(decklists)} decklists from {filename}")
                print(f"Loaded {len(decklists2)} decklists from {results_filename}")

                decklists3 = copy.deepcopy(decklists)
                adjusted_keys = []

                for key, decklist in decklists.items():
                    player_name = decklist["Metadata"]["Player Name"]
                    for key2, decklist2 in decklists2.items():
                        if player_name.lower() in key2.lower() and key != key2:
                            actual_name = decklist2["Metadata"]["Player Name"]
                            if key in adjusted_keys:
                                continue
                            partial_key = key.split(" - ")[1] + key.split(" - ")[2]
                            actual_key = actual_name + " - " + partial_key
                            decklist3 = copy.deepcopy(decklist)
                            decklist3["Metadata"]["Player Name"] = actual_name
                            decklist3["Metadata"]["Id"] = actual_name
                            decklists3[actual_key] = decklist3
                            print(key)
                            del decklists3[key]
                            adjusted_keys.append(key)

                with open(output_path, "w") as output_file:
                    json.dump(decklists3, output_file, indent=4)