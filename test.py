import json
import copy
import os


if __name__ == "__main__":
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