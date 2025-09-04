import json
import copy
import os
from datetime import datetime

decklists_folder = "decklists_adjusted_with_results_and_standings"

if __name__ == "__main__":
    '''unified_decklist = []

    # Iterate through all files in the decklists_folder
    for filename in os.listdir(decklists_folder):
        file_path = os.path.join(decklists_folder, filename)
        if os.path.isfile(file_path) and filename.endswith(".json"):
            with open(file_path, "r", encoding="utf-8") as file:
                try:
                    decklists = json.load(file)
                    
                    # Extract the national name from the filename (assuming it's part of the filename)
                    national_name = file_path.split("_")[-1].replace(".json", "")
                    
                    # Extract tournament information from the decklists
                    for decklist in decklists.values():
                        metadata = decklist.get("Metadata", {})
                        tournament_format = metadata.get("Format", "Unknown Format")
                        if tournament_format == "Classic Constructed":
                            tournament_date = metadata.get("Date", "Unknown Date")
                            tournament_name = metadata.get("Event", "Unknown Event")
                            break
                    
                    # Add the decklist directly to the unified dictionary
                    for key, decklist in decklists.items():
                        decklist["Metadata"]["Event"] = tournament_name
                        decklist["Metadata"]["Date"] = tournament_date
                        decklist["Metadata"]["Format"] = tournament_format
                        decklist["Metadata"]["List Id"] = key
                        unified_decklist.append(decklist)
                except json.JSONDecodeError as e:
                    print(f"Error decoding JSON from file {filename}: {e}")

    # Save the unified decklist dictionary to a JSON file
    with open("decklists.json", "w", encoding="utf-8") as output_file:
        json.dump(unified_decklist, output_file, indent=4)'''
        
    # Load the decklists from the JSON file
    with open("src/decklists_date copy.json", "r", encoding="utf-8") as file:
        decklists = json.load(file)

    # Convert the "Date" field in "Metadata" to datetime format
    for decklist in decklists:
        if decklist["Metadata"].get("Rank") == -1:
            decklist["Metadata"]["Rank"] = 513

    # Save the updated decklists back to the JSON file
    with open("src/decklists_date.json", "w", encoding="utf-8") as file:
        json.dump(decklists, file, indent=4, default=str)