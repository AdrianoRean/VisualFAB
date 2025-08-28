import json


if __name__ == "__main__":
    with open("decklists/nationals_decklists_italy.json", "r") as file:
        decklists = json.load(file)
    name = "Flavio Miani"
    decklist = [dl for dl in decklists.values() if dl["Metadata"]["Player Name"] == name][0]
    print(decklist)