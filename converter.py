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
    decklist_folder = "decklists_with_results"
    for filename in os.listdir(decklist_folder):
        if filename.endswith(".json"):
            file_path = os.path.join(decklist_folder, filename)
            decklists_dict = denest_matchups_and_adjust_metadata_names(file_path)
            output_path = os.path.join("decklists_with_results_no_standings", f"{os.path.splitext(filename)[0]}.json")
            with open(output_path, "w") as outfile:
                json.dump(decklists_dict, outfile, indent=2)