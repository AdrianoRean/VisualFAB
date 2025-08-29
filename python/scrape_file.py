import json
import os
from bs4 import BeautifulSoup
import requests

# Function to scrape and follow the URL in a <link> tag
def find_link_tag(url, type):
    try:
        # Fetch the HTML content of the page
        headers = {"Content-Language": "en"}
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        html_content = response.text

        # Parse the HTML content using BeautifulSoup
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Find the <link> tag 
        match type:
            case 'spur_nationals':
                #non-week nationals
                spur_nationals = soup.find_all("a", class_="item-link", href=lambda href: href and "coverage/week" in href)
                link_url = []
                for national in spur_nationals:
                    if 'href' in national.attrs:
                        link_url.append(national['href'])
                    else:
                        print("No matching <a> tag with 'coverage' in href found for national: " + national)
                link_url = list(set(link_url))
            case 'week_nationals':
                #week nationals
                week_nationals = soup.find_all("a", class_="item-link", href=lambda href: href and "coverage/national-championship-2025-coverage-week-" in href)
                link_url = []
                for national in week_nationals:
                    if 'href' in national.attrs:
                        link_url.append(national['href'])
                    else:
                        print("No matching <a> tag with 'coverage' in href found for national: " + national)
                link_url = list(set(link_url))
            case '2025':
                with open("avoid.txt", "r") as f:
                    link_to_avoid = f.read().splitlines()
                h5s = soup.find_all("h5", text=lambda text: text and ("Calling" in text or "Battle Hardened" in text or "Pro Tour" in text))
                link_url = []
                for h5 in h5s:
                    name = h5.get_text(strip=True)
                    link = guess_link_url(name)
                    if link in link_to_avoid:
                        print("Guessed link is in avoid list: " + link)
                        continue
                    elif check_if_url_valid(link):
                        link_url.append(link)
                    else:
                        print("Guessed link is not valid: " + link)
                        link_to_avoid.append(link)
                with open("avoid.txt", "w") as f:
                    for link in link_to_avoid:
                        f.write(link + "\n")                
                        
            case 'high tier':
                link_tag = soup.find("a", class_="item-link", href=lambda href: href and "pairings-results-and-standing" in href)
                if link_tag and 'href' in link_tag.attrs:
                    headers = {"Content-Language": "en"}
                    response = requests.get(link_tag['href'], headers=headers)
                    response.raise_for_status()
                    html_content = response.text
                    print(f"Followed link: {link_tag['href']}")
                    soup = BeautifulSoup(html_content, 'html.parser')
                    
                    link_url = []
                    tournaments = soup.find_all("a", class_="item-link", href=lambda href: href and "coverage" in href)
                    for tournament in tournaments:
                        text = tournament.get_text(strip=True)
                        try:
                            if "Classic Constructed" in str(text):
                                print(f"Found tournament: {text}")
                                link_url.append((str(text).replace("Classic Constructed", ""), tournament['href']))
                        except:
                            print("No Classic Constructed tournament found in link: " + text)
                            
                else:
                    print("No matching <a> tag with 'coverage' in href found.")
                    return None
            case 'national':
                link_tag = soup.find("a", class_="item-link", href=lambda href: href and "coverage" in href)
                if link_tag and 'href' in link_tag.attrs:
                    link_url = link_tag['href']
                else:
                    print("No matching <a> tag with 'coverage' in href found.")
                    return None
            case "coverage":
                table = soup.table.find_all("tr")
                cells = None
                flag = False
                Top = False
                rounds = 0
                pairings = []
                for i, row in enumerate(table[1:]) if table else None:
                    cells = row.find_all("td")
                    text = cells[0].get_text(separator=" ", strip=True)
                    if "Classic Constructed" in text in text:
                        pairings.append(("https://fabtcg.com" + cells[2].a["href"], i, Top))
                        flag = True
                    if len(cells) > 3 and cells[3].a:
                        rounds += 1
                    else:
                        Top = True
                if not flag:
                    print("No Classic Constructed rounds!")
                    return None
                first_row = table[1] if table else None
                cells = first_row.find_all("td") if first_row else None
                standings = "https://fabtcg.com" + cells[3].a["href"]
                link_url = {"standings": standings, "pairings": pairings, "rounds": rounds}
            case "standings":
                table = soup.table.find_all("tr")
                cells = None
                flag = False
                rounds = 0
                standings = None
                for i, row in enumerate(table[1:]) if table else None:
                    cells = row.find_all("td")
                    text = cells[0].get_text(separator=" ", strip=True)
                    if "Classic Constructed" in text in text:
                        flag = True
                    if len(cells) > 3 and cells[3].a:
                        rounds += 1
                        standings = "https://fabtcg.com" + cells[3].a["href"]
                if not flag:
                    print("No Classic Constructed rounds!")
                    return None
                final_standings = "https://fabtcg.com" + soup.find_all("a", href=lambda href: href and "final-standings" in href)[0]["href"]
                link_url = {"standings": standings, "final standings": final_standings}
                    
        
        #print(f"Found URL in <link> tag: {link_url}")
        return link_url
    except requests.exceptions.RequestException as e:
        print(f"An error occurred: {e}")
        return None
    
def guess_link_url(tournament_name):
    base_url = "https://fabtcg.com/en/organised-play/2025/"
    tournament_name = tournament_name.lower().replace(" ", "-").replace(":", "")
    guessed_url = f"{base_url}{tournament_name}/"
    return guessed_url

def check_if_url_valid(url):
    try:
        headers = {"Content-Language": "en"}
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return True
    except requests.exceptions.RequestException as e:
        return False

def get_decklist_name(decklist):
    return decklist["Metadata"]["Id"] + " - " + decklist["Metadata"]["Date"] + " - " + decklist["Metadata"]["Event"]
    
def extract_decklists(url):
    try:
        # Fetch the HTML content of the page
        headers = {"Content-Language": "en"}
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        html_content = response.text

        # Parse the HTML content using BeautifulSoup
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Find the <link> tag
        table = soup.table.find_all("tr")
        decklists = {}
        for row in table[1:]:
            cells = row.find_all("td")
            #rank = cells[0].text.strip()
            #player = cells[1].text.strip()
            try:
                decklist_link = cells[3].a["href"] if cells[3].a else None
            except:
                decklist_link = None
                print("No decklist link found for Player: " + str(cells[1].text.strip()))
            #decklists[player] = {"rank": rank, "decklist": decklist_link}
            if decklist_link:
                decklist = get_decklist("https://fabtcg.com" + decklist_link)
                if not decklist:
                    print("No decklist found for link: " + decklist_link)
                    continue
                decklists[get_decklist_name(decklist)] = decklist
        
        #print(f"Extracted decklists: {decklists}")
        return decklists
    except requests.exceptions.RequestException as e:
        print(f"An error occurred: {e}")
        return None
    
def get_decklist_metadata(metadata_table):
    
    #Table 1 Metadata extraction
    rows = metadata_table.find_all("tr")
    metadata = {}
    for row in rows:
        key = row.th.text.strip()
        if key != "Player Name / ID":
            value = row.td.get_text(separator=" ", strip=True)
            metadata[key] = value
        else:
            player_info = row.td.get_text(separator=" ", strip=True)
            try:
                metadata["Player Name"] = player_info[:-11]
                metadata["Id"] = player_info[-9:-1]
            except:
                print("Error parsing Player Name / ID, Player Name is: " + player_info + ", ID set to empty string")
                metadata["Player Name"] = player_info
                metadata["Id"] = ""
    
    metadata["Rank"] = 0
    metadata["Total Swiss Wins"] = 0
    metadata["Classic Constructed Tournament Rounds"] = 0
    metadata["Classic Constructed Wins"] = 0
    metadata["Classic Constructed Losses"] = 0
    metadata["Classic Constructed Double Losses"] = 0
    metadata["Classic Constructed Draws"] = 0
    metadata["Classic Constructed Played Rounds"] = 0
    metadata["Top"] = False
    metadata["Classic Constructed Top Rounds"] = 0
    metadata["Classic Constructed Matchups"] = []
    
    return metadata
    
def get_decklist(url):
    try:
        # Fetch the HTML content of the page
        headers = {"Content-Language": "en"}
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        html_content = response.text

        # Parse the HTML content using BeautifulSoup
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Find the <link> tag
        tables = soup.find_all("table")
        metadata_table = tables[0]
        
        metadata = get_decklist_metadata(metadata_table)
        decklist = {"Metadata": metadata, "Classic Constructed Matchups": [], "Cards": []}
        
        #Decklist extraction
        for table in tables[1:]:
            rows = table.find_all("tr")
            pitch = rows[0].th.get_text(separator=" ", strip=True)
            if not ("Pitch" in pitch or pitch == "Hero / Weapon / Equipment"):  # Ensure it's a valid pitch header   
                break
            for row in rows[1:]:  # Skip header row
                div = row.td.div
                quantity = div.get_text(separator=" ", strip=True)[0]
                card_name = div.a.get_text(separator=" ", strip=True)
                if not(pitch[-1] == "0" or pitch == "Hero / Weapon / Equipment"):
                    color = card_name[-4:-1].capitalize()
                    card_name = card_name[:-6]
                else:
                    color = ""
                decklist["Cards"].append({"color": color, "quantity": quantity, "card_name": card_name})
        
        #print(f"Extracted decklist: {decklist}")
        return decklist
    except requests.exceptions.RequestException as e:
        print(f"An error occurred: {e}")
        return None
    
def update_results(url, round, Top, decklists):
    try:
        # Fetch the HTML content of the page
        headers = {"Content-Language": "en"}
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        html_content = response.text

        # Parse the HTML content using BeautifulSoup
        soup = BeautifulSoup(html_content, 'html.parser')
        
        links = soup.find_all("a", href=lambda href: href and "decklist" in href and "coverage" in href)
        results_names_1 = []
        results_names_2 = []

        if len(links) == 0:
            print("No decklist links found.")
            return None
        print(f"Links found: {len(links)}")

        for i, decklist_link in enumerate(links):
            link = "https://fabtcg.com" + decklist_link['href']
            headers = {"Content-Language": "en"}
            try:
                response = requests.get(link, headers=headers)
            except:
                print(f"Failed to retrieve decklist from {link}")
                continue
            response.raise_for_status()
            html_content = response.text

            # Parse the HTML content using BeautifulSoup
            soup2 = BeautifulSoup(html_content, 'html.parser')
            
            tables = soup2.find_all("table")
            metadata = get_decklist_metadata(tables[0])
            name = get_decklist_name({"Metadata": metadata})

            if i % 2 == 0:
                results_names_1.append({"Name": name, "Hero": metadata["Hero"]})
            else:
                results_names_2.append({"Name": name, "Hero": metadata["Hero"]})

            #print(f"Player {name} with Hero {decklist['metadata']['Hero']} processed. Index {i}")

        results = soup.find_all("div", class_="tournament-coverage__result")
        
        for i, result in enumerate(results):
            text = result.get_text(separator=" ", strip=True)
            print(f"For round {i} result text: {text}")
            if "1" in text:
                decklists[results_names_1[i]["Name"]]["Metadata"]["Classic Constructed Matchups"].append({
                    "Result": True,
                    "Opponent Hero": results_names_2[i]["Hero"],
                    "Round": round,
                    "Top": Top
                })
                decklists[results_names_1[i]["Name"]]["Metadata"]["Classic Constructed Wins"] += 1
                decklists[results_names_2[i]["Name"]]["Metadata"]["Classic Constructed Matchups"].append({
                    "Result": False,
                    "Opponent Hero": results_names_2[i]["Hero"],
                    "Round": round,
                    "Top": Top
                })
                decklists[results_names_2[i]["Name"]]["Metadata"]["Classic Constructed Losses"] += 1
            elif "2" in text:
                decklists[results_names_1[i]["Name"]]["Metadata"]["Classic Constructed Matchups"].append({
                    "Result": False,
                    "Opponent Hero": results_names_2[i]["Hero"],
                    "Round": round,
                    "Top": Top
                })
                decklists[results_names_1[i]["Name"]]["Metadata"]["Classic Constructed Losses"] += 1
                decklists[results_names_2[i]["Name"]]["Metadata"]["Classic Constructed Matchups"].append({
                    "Result": True,
                    "Opponent Hero": results_names_2[i]["Hero"],
                    "Round": round,
                    "Top": Top
                })
                decklists[results_names_2[i]["Name"]]["Metadata"]["Classic Constructed Wins"] += 1
            else:
                decklists[results_names_1[i]["Name"]]["Metadata"]["Classic Constructed Matchups"].append({
                    "Result": None,
                    "Opponent Hero": results_names_2[i]["Hero"],
                    "Round": round,
                    "Top": Top
                })
                decklists[results_names_1[i]["Name"]]["Metadata"]["Classic Constructed Draws"] += 1
                decklists[results_names_2[i]["Name"]]["Metadata"]["Classic Constructed Matchups"].append({
                    "Result": None,
                    "Opponent Hero": results_names_2[i]["Hero"],
                    "Round": round,
                    "Top": Top
                })
                decklists[results_names_2[i]["Name"]]["Metadata"]["Classic Constructed Draws"] += 1
            
            if Top:
                decklists[results_names_1[i]["Name"]]["Metadata"]["Top"] = True
                decklists[results_names_2[i]["Name"]]["Metadata"]["Top"] = True
                decklists[results_names_1[i]["Name"]]["Metadata"]["Classic Constructed Top Rounds"] += 1
                decklists[results_names_2[i]["Name"]]["Metadata"]["Classic Constructed Top Rounds"] += 1
                
            decklists[results_names_1[i]["Name"]]["Metadata"]["Classic Constructed Played Rounds"] += 1
            decklists[results_names_2[i]["Name"]]["Metadata"]["Classic Constructed Played Rounds"] += 1
        
        return decklists
    except requests.exceptions.RequestException as e:
        print(f"An error occurred: {e}")
        return None
    
def update_results_with_name(url, round, Top, decklists):
    try:
        # Fetch the HTML content of the page
        headers = {"Content-Language": "en"}
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        html_content = response.text

        # Parse the HTML content using BeautifulSoup
        soup = BeautifulSoup(html_content, 'html.parser')
        
        names = soup.find_all("div", class_="tournament-coverage__player-name-and-flag")
        all_text = soup.find_all("div", class_="tournament-coverage__player-text")
        results_names_1 = []
        results_names_2 = []

        if len(names) == 0:
            print("No decklist names found.")
            return None
        print(f"names found: {len(names)}")

        for i, name_div in enumerate(names):
            name = name_div.get_text(separator=" ", strip=True)
            matching_decklists = [(key, dl) for key, dl in decklists.items() if dl["Metadata"]["Player Name"].lower() == name.lower()]
            
            if len(matching_decklists) > 1:
                print("Multiple matching decklists found for Player: " + name + ", trying to match by Hero")
                hero_div = all_text[i].find("div", class_="tournament-coverage__player-hero-and-deck")
                hero = hero_div.get_text(separator=" ", strip=True) if hero_div else "N/A"
                matching_decklists = [(key, dl) for key, dl in matching_decklists if dl["Metadata"]["Hero"].lower() == hero.lower()]
                if len(matching_decklists) > 1:
                    print("Still multiple matching decklists found for Player: " + name + " with Hero: " + hero + ", ingoring this national")
                    return None
                elif len(matching_decklists) == 0:
                    print("No matching decklist found for Player: " + name + " with Hero: " + hero + ", ignoring this national")
                    return None
            
            try:
                id_decklist = matching_decklists[0][0]
                decklist = matching_decklists[0][1]
            except:
                print("No matching decklist found for Player: " + name)
                if name is not None:
                    dummy_decklist = {
                        "Metadata": {
                            "Player Name": name,
                            "Hero": "N/A",
                            "Event": "N/A",
                            "Date": "N/A",
                            "Id": "",
                            "Rank": 0,
                            "Total Swiss Wins": 0,
                            "Classic Constructed Tournament Rounds": 0,
                            "Classic Constructed Wins": 0,
                            "Classic Constructed Losses": 0,
                            "Classic Constructed Double Losses": 0,
                            "Classic Constructed Draws": 0,
                            "Classic Constructed Played Rounds": 0,
                            "Top": False,
                            "Classic Constructed Top Rounds": 0,
                            "Classic Constructed Matchups": []
                        },
                        "Classic Constructed Matchups": [],
                        "Cards": []
                    }
                    id_decklist = name
                    decklists[id_decklist] = dummy_decklist
                    print(f"Created dummy decklist for Player: {name}")
                else:
                    print("Player name is None, skipping dummy decklist creation.")
                    continue

            if i % 2 == 0:
                results_names_1.append({"Id": id_decklist, "Hero": decklist["Metadata"]["Hero"]})
            else:
                results_names_2.append({"Id": id_decklist, "Hero": decklist["Metadata"]["Hero"]})
        
        if len(results_names_1) == len(results_names_2) + 1:
            print("Odd number of players, adding dummy player to results_names_2")
            results_names_2.append({"Id": "By", "Hero": "N/A"})

            #print(f"Player {name} with Hero {decklist['metadata']['Hero']} processed. Index {i}")

        results = soup.find_all("div", class_="tournament-coverage__result")
        
        for i, result in enumerate(results):
            text = result.get_text(separator=" ", strip=True)
            print(f"For table {i} result text: {text}")
            if "1" in text:
                decklists[results_names_1[i]["Id"]]["Classic Constructed Matchups"].append({
                    "Result": "W",
                    "Opponent": results_names_2[i]["Id"],
                    "Opponent Hero": results_names_2[i]["Hero"],
                    "Round": round,
                    "Top": Top
                })
                decklists[results_names_1[i]["Id"]]["Metadata"]["Classic Constructed Wins"] += 1
                decklists[results_names_2[i]["Id"]]["Classic Constructed Matchups"].append({
                    "Result": "L",
                    "Opponent": results_names_1[i]["Id"],
                    "Opponent Hero": results_names_1[i]["Hero"],
                    "Round": round,
                    "Top": Top
                })
                decklists[results_names_2[i]["Id"]]["Metadata"]["Classic Constructed Losses"] += 1
            elif "2" in text:
                decklists[results_names_1[i]["Id"]]["Classic Constructed Matchups"].append({
                    "Result": "L",
                    "Opponent": results_names_2[i]["Id"],
                    "Opponent Hero": results_names_2[i]["Hero"],
                    "Round": round,
                    "Top": Top
                })
                decklists[results_names_1[i]["Id"]]["Metadata"]["Classic Constructed Losses"] += 1
                decklists[results_names_2[i]["Id"]]["Classic Constructed Matchups"].append({
                    "Result": "W",
                    "Opponent": results_names_1[i]["Id"],
                    "Opponent Hero": results_names_1[i]["Hero"],
                    "Round": round,
                    "Top": Top
                })
                decklists[results_names_2[i]["Id"]]["Metadata"]["Classic Constructed Wins"] += 1
            elif "Draw" in text:
                decklists[results_names_1[i]["Id"]]["Classic Constructed Matchups"].append({
                    "Result": "D",
                    "Opponent": results_names_2[i]["Id"],
                    "Opponent Hero": results_names_2[i]["Hero"],
                    "Round": round,
                    "Top": Top
                })
                decklists[results_names_1[i]["Id"]]["Metadata"]["Classic Constructed Draws"] += 1
                decklists[results_names_2[i]["Id"]]["Classic Constructed Matchups"].append({
                    "Result": "D",
                    "Opponent": results_names_1[i]["Id"],
                    "Opponent Hero": results_names_1[i]["Hero"],
                    "Round": round,
                    "Top": Top
                })
                decklists[results_names_2[i]["Id"]]["Metadata"]["Classic Constructed Draws"] += 1
            else:
                decklists[results_names_1[i]["Id"]]["Classic Constructed Matchups"].append({
                    "Result": "DL",
                    "Opponent": results_names_2[i]["Id"],
                    "Opponent Hero": results_names_2[i]["Hero"],
                    "Round": round,
                    "Top": Top
                })
                decklists[results_names_1[i]["Id"]]["Metadata"]["Classic Constructed Double Losses"] += 1
                decklists[results_names_2[i]["Id"]]["Classic Constructed Matchups"].append({
                    "Result": "DL",
                    "Opponent": results_names_1[i]["Id"],
                    "Opponent Hero": results_names_1[i]["Hero"],
                    "Round": round,
                    "Top": Top
                })
                decklists[results_names_2[i]["Id"]]["Metadata"]["Classic Constructed Double Losses"] += 1
            
            if Top:
                decklists[results_names_1[i]["Id"]]["Metadata"]["Top"] = True
                decklists[results_names_2[i]["Id"]]["Metadata"]["Top"] = True
                decklists[results_names_1[i]["Id"]]["Metadata"]["Classic Constructed Top Rounds"] += 1
                decklists[results_names_2[i]["Id"]]["Metadata"]["Classic Constructed Top Rounds"] += 1
                
            decklists[results_names_1[i]["Id"]]["Metadata"]["Classic Constructed Played Rounds"] += 1
            decklists[results_names_2[i]["Id"]]["Metadata"]["Classic Constructed Played Rounds"] += 1
        
        return decklists
    except requests.exceptions.RequestException as e:
        print(f"An error occurred: {e}")
        return None
    
def update_decklists_results(pairings, total_rounds, decklists, names = True):
    for link, round, Top in pairings:
        decklists = update_results_with_name(link, round, Top, decklists)
        if decklists is None:
            print(f"Failed to update results for {link}")
            return None
    for decklist in decklists.values():
        decklist["Metadata"]["Tournament Rounds"] = total_rounds
    return decklists

# Example usage
if __name__ == "__main__":
    nationals_flag = True
    high_tier_flag = False
    nationals_standings_flag = True

    #NATIONALS
    if nationals_flag:
        page_url = "https://fabtcg.com/en/articles/national-championships-2025-live-streams"  # Replace with the URL of the page to scrape
        spur_nationals = find_link_tag(page_url, "spur_nationals")
        page_url = "https://fabtcg.com/en/organised-play/2025/national-championships-2025/coverage/national-championship-2025-coverage-week-1/"
        week1_nationals = find_link_tag(page_url, "week_nationals")
        page_url = "https://fabtcg.com/en/organised-play/2025/national-championships-2025/coverage/national-championship-2025-coverage-week-2/"
        week2_nationals = find_link_tag(page_url, "week_nationals")
        nationals = spur_nationals + week1_nationals + week2_nationals
        nationals = list(set(nationals))
        
        for national in nationals:
            decklists = {}
            name = national.split("/")[-2]
            if os.path.exists(f"decklists_adjusted/nationals_decklists_{name}.json"):
                print(f"Already done {name} national!")
                continue
            else:
                print("Processing national: " + name)
            coverage = find_link_tag(national, "national") if national else None
            standing_details = find_link_tag(coverage, "coverage") if coverage else None
            #print(coverage_details)
            decklists = extract_decklists(standing_details["standings"]) if standing_details else None
            if decklists is None:
                print("No decklists found for national: " + name)
                continue
            json_object = json.dumps(decklists, indent=4)
            with open(f"decklists_adjusted/nationals_decklists_{name}.json", "w") as outfile:
                outfile.write(json_object)
    
        #UPDATE RESULTS
        for national in nationals:
            name = national.split("/")[-2]
            decklist_file = f"decklists_adjusted/nationals_decklists_{name}.json"
            results_file = f"decklists_adjusted_with_results_no_standings/nationals_decklists_results_{name}.json"

            if not os.path.exists(decklist_file):
                print(f"No decklists file found for {name} national, skipping results update!")
                continue

            if os.path.exists(results_file):
                print(f"Results file already exists for {name} national, skipping!")
                continue

            print(f"Updating results for national: {name}")
            with open(decklist_file, "r") as infile:
                decklists = json.load(infile)
                
                coverage = find_link_tag(national, "national") if national else None
                standing_details = find_link_tag(coverage, "coverage") if coverage else None
                if standing_details is None:
                    print("No coverage details found for national: " + name)
                    continue
                #print(coverage_details)
                decklists = update_decklists_results(standing_details["pairings"], standing_details["rounds"], decklists) if decklists else None
                if decklists is None:
                    print("No decklists found for national: " + name)
                    continue
                json_object = json.dumps(decklists, indent=4)
                with open(f"decklists_adjusted_with_results_no_standings/nationals_decklists_results_{name}.json", "w") as outfile:
                    outfile.write(json_object)        
    
    #HIGH TIER TOURNAMENTS
    if high_tier_flag:
        page_url = "https://fabtcg.com/en/organised-play/2025/"
        tournaments_2025 = find_link_tag(page_url, "2025")
        for tournament in tournaments_2025:
            name = tournament.split("/")[-2]
            if os.path.exists(f"decklists/high_tier_decklists_{name}.json"):
                print(f"Already done {name} high tier tournament!")
                continue
            else:
                print("Processing high tier tournament: " + name)
            print(f"Processing tournament: {name}")
            high_tier = find_link_tag(tournament, "high tier") if tournament else None
            print(f"High tier links: {high_tier}")
            for tournament_name, link in high_tier:
                print(f"High tier tournament link: {link}")
                standing_details = find_link_tag(link, "coverage") if link else None
                print(f"Coverage details: {standing_details}")
                if standing_details:
                    decklists = extract_decklists(standing_details["standings"]) if standing_details else None
                    
                else:
                    print("No coverage details found for tournament: " + name)
                    continue                    
                    
                json_object = json.dumps(decklists, indent=4)
                with open(f"decklists/high_tier_decklists_{name}_{str(tournament_name).replace(' ', '-').replace('/', '-').lower()}.json", "w") as outfile:
                    outfile.write(json_object)
    
        #UPDATE RESULTS
        for tournament in tournaments_2025:
            name = tournament.split("/")[-2]
            high_tier = find_link_tag(tournament, "high tier") if tournament else None
            print(f"Processing high tier tournament: " + name)
            for tournament_name, link in high_tier:
                file_name = f"decklists/high_tier_decklists_{name}_{str(tournament_name).replace(' ', '-').replace('/', '-').lower()}.json"
                if not os.path.exists(file_name):
                    print(f"No decklists file found for {name} high tier tournament, skipping results update!")
                    continue
                else:
                    print("Updating results for high tier tournament: " + name)
                out_name = f"decklists/high_tier_decklists_results_{name}_{str(tournament_name).replace(' ', '-').replace('/', '-').lower()}.json"
                if os.path.exists(out_name):
                    print(f"Results file found for {name} high tier tournament, skipping!")
                    continue
                with open(file_name, "r") as infile:
                    decklists = json.load(infile)
                    standing_details = find_link_tag(link, "coverage") if link else None
                    if standing_details is None:
                        print("No coverage details found for tournament: " + name)
                        continue
                    #print(coverage_details)
                    decklists = update_decklists_results(standing_details["pairings"], standing_details["rounds"], decklists) if decklists else None
                    if decklists is None:
                        print("No decklists found for tournament: " + name)
                        continue
                    json_object = json.dumps(decklists, indent=4)
                    with open(out_name, "w") as outfile:
                        outfile.write(json_object)

    if nationals_standings_flag:
        page_url = "https://fabtcg.com/en/articles/national-championships-2025-live-streams"  # Replace with the URL of the page to scrape
        spur_nationals = find_link_tag(page_url, "spur_nationals")
        page_url = "https://fabtcg.com/en/organised-play/2025/national-championships-2025/coverage/national-championship-2025-coverage-week-1/"
        week1_nationals = find_link_tag(page_url, "week_nationals")
        page_url = "https://fabtcg.com/en/organised-play/2025/national-championships-2025/coverage/national-championship-2025-coverage-week-2/"
        week2_nationals = find_link_tag(page_url, "week_nationals")
        nationals = spur_nationals + week1_nationals + week2_nationals
        nationals = list(set(nationals))
        
        for national in nationals:
            name = national.split("/")[-2]
            decklist_file = f"decklists_adjusted_with_results_no_standings/nationals_decklists_results_{name}.json"
            standings_file = f"decklists_adjusted_with_results_and_standings/nationals_decklists_results_and_standings_{name}.json"

            if not os.path.exists(decklist_file):
                print(f"No decklists file found for {name} national, skipping standings update!")
                continue

            if os.path.exists(standings_file):
                print(f"Standings file already exists for {name} national, skipping!")
                continue

            print(f"Updating standings for national: {name}")
            with open(decklist_file, "r") as infile:
                decklists = json.load(infile)
                standings = {}
                
                coverage = find_link_tag(national, "national") if national else None
                standings_details = find_link_tag(coverage, "standings") if coverage else None
                if standings_details is None:
                    print("No standings details found for national: " + name)
                    continue
                
                #Get before-top standings
                headers = {"Content-Language": "en"}
                response = requests.get(standings_details["standings"], headers=headers)
                response.raise_for_status()
                html_content = response.text

                # Parse the HTML content using BeautifulSoup
                soup = BeautifulSoup(html_content, 'html.parser')
                
                table = soup.find("table")
                if table is None:
                    print("No table found in standings for national: " + name)
                    continue
                rows = table.find_all("tr")
                for row in rows[1:]:
                    cells = row.find_all("td")
                    rank = cells[0].get_text(separator=" ", strip=True)
                    if rank == "Dropped":
                        rank = -1
                    else:
                        try:
                            rank = int(rank)
                        except:
                            print("Error parsing rank: " + rank + ", setting to 0")
                            rank = 0
                    player_info = cells[1].get_text(separator=" ", strip=True)
                    if len(cells) < 4:
                        hero = None
                        wins = cells[2].get_text(separator=" ", strip=True)
                    else:
                        hero = cells[2].get_text(separator=" ", strip=True)
                        wins = cells[3].get_text(separator=" ", strip=True)
                        
                    print(f"Player: {player_info}, Rank: {rank}, Wins: {wins}")
    
                    decklist_id = None
                    for key, dl in decklists.items():
                        if dl["Metadata"]["Player Name"].strip().lower() == player_info.strip().lower():
                            if decklist_id != None:
                                print(f"Warning: Multiple decklists matched for player: {player_info}. Previous ID: {decklist_id}, New ID: {key}. Mathing by hero")
                                if hero:
                                    if dl["Metadata"]["Hero"].strip().lower() == hero.strip().lower():
                                        decklist_id = key
                                        print(f"Matched decklist for player: {player_info} with ID: {decklist_id} by hero")
                                else:
                                    print("Try by matching classic constructed wins")
                                    if int(dl["Metadata"]["Classic Constructed Wins"]) > int(wins):
                                        print(f"More Classic Constructed Wins ({dl['Metadata']['Classic Constructed Wins']}) than Swiss Wins ({wins}), keeping previous ID: {decklist_id}")
                                    else:
                                        print(f"No hero information available to disambiguate for player: {player_info}, keeping previous ID: {decklist_id}")
                                    
                                    
                            if hero and dl["Metadata"]["Hero"].strip().lower() == hero.strip().lower():                                  
                                decklist_id = key
                            elif int(dl["Metadata"]["Classic Constructed Wins"]) > int(wins):
                                print(f"More Classic Constructed Wins ({dl['Metadata']['Classic Constructed Wins']}) than Swiss Wins ({wins}), ignoring this decklist for player: {player_info}")
                            else:
                                decklist_id = key
                            print(f"Matched decklist for player: {player_info} with ID: {decklist_id}")
                            #break
                    if decklist_id:
                        if decklists[decklist_id]["Metadata"]["Rank"] == 0:
                            decklists[decklist_id]["Metadata"]["Rank"] = rank
                            decklists[decklist_id]["Metadata"]["Total Swiss Wins"] = int(wins)
                            print(f'Updated decklist for player: {player_info} with ID: {decklist_id}, Rank: {decklists[decklist_id]["Metadata"]["Rank"]}, Wins: {decklists[decklist_id]["Metadata"]["Total Swiss Wins"]}')
                    else:
                        print(f"No matching decklist found for player: {player_info} in before-top standings")
                        # Skip processing this player but ensure no unintended overwrites occur
                        continue
                
                print("Completed updating before-top standings.")
                print("Proceeding to update final standings.")
                
                #Get top standings
                headers = {"Content-Language": "en"}
                response = requests.get(standings_details["final standings"], headers=headers)
                response.raise_for_status()
                html_content = response.text
                
                # Parse the HTML content using BeautifulSoup
                soup = BeautifulSoup(html_content, 'html.parser')
                table = soup.find("table")
                if table is None:
                    print("No table found in final standings for national: " + name)
                    continue
                rows = table.find_all("tr")
                for row in rows[1:]:
                    cells = row.find_all("td")
                    rank = cells[0].get_text(separator=" ", strip=True)
                    if rank == "Dropped":
                        rank = -1
                    else:
                        try:
                            rank = int(rank)
                        except:
                            print("Error parsing rank: " + rank + ", setting to 0")
                            rank = 0
                    player_info = cells[1].get_text(separator=" ", strip=True)
                    
                    decklist_id = None
                    for key, dl in decklists.items():
                        if dl["Metadata"]["Player Name"].strip().lower() == player_info.strip().lower():
                            decklist_id = key
                            break
                        
                    if decklist_id:
                        decklists[decklist_id]["Metadata"]["Rank"] = rank
                        print(f'Updated decklist for player: {player_info} with ID: {decklist_id}, Rank: {decklists[decklist_id]["Metadata"]["Rank"]}, Wins: {decklists[decklist_id]["Metadata"]["Total Swiss Wins"]}')
                    else:
                        print(f"No matching decklist found for player: {player_info} in final standings") 
                        continue
                    
                json_object = json.dumps(decklists, indent=4)
                with open(standings_file, "w") as outfile:
                    outfile.write(json_object)
                
                