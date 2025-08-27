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
            decklists_dict[deck_id] = new_decklist
    return decklists_dict

if __name__ == "__main__":
    decklist_folder = "old_decklists_2"
    for filename in os.listdir(decklist_folder):
        if filename.endswith(".json"):
            file_path = os.path.join(decklist_folder, filename)
            decklists_dict = convert_decklists_to_dict(file_path)
            output_path = os.path.join("decklists", f"{os.path.splitext(filename)[0]}.json")
            with open(output_path, "w") as outfile:
                json.dump(decklists_dict, outfile, indent=2)