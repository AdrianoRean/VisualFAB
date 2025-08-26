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
                for row in table[1:] if table else None:
                    cells = row.find_all("td")
                    text = cells[0].get_text(separator=" ", strip=True)
                    if "Classic Constructed" in text in text:
                        break
                    print("No Classic Constructed rounds!")
                    return None
                pairings = "https://fabtcg.com" + cells[2].a["href"]
                standings = "https://fabtcg.com" + cells[3].a["href"]
                link_url = {"standings": standings, "pairings": pairings}
                    
        
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
    
def extract_data(url):
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
        decklists = []
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
                decklist["id"] = get_decklist_name(decklist)
                decklists.append(decklist)
        
        #print(f"Extracted decklists: {decklists}")
        return decklists
    except requests.exceptions.RequestException as e:
        print(f"An error occurred: {e}")
        return None
    
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
                    metadata["ID"] = player_info[-9:-1]
                except:
                    print("Error parsing Player Name / ID, Player Name is: " + player_info + ", ID set to empty string")
                    metadata["Player Name"] = player_info
                    metadata["ID"] = ""
        
        #Initialize decklist structure
        decklist = {"metadata": metadata, "cards": []}
        
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
                decklist["cards"].append({"color": color, "quantity": quantity, "card_name": card_name})
        
        #print(f"Extracted decklist: {decklist}")
        return decklist
    except requests.exceptions.RequestException as e:
        print(f"An error occurred: {e}")
        return None
    
def get_decklist_name(decklist):
    return decklist["metadata"]["ID"] + " - " + decklist["metadata"]["Date"] + " - " + decklist["metadata"]["Event"]

# Example usage
if __name__ == "__main__":
    nationals_flag = False
    high_tier_flag = True

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
            decklists = []
            name = national.split("/")[-2]
            if os.path.exists(f"nationals_decklists_{name}.json"):
                print(f"Already done {name} national!")
                continue
            else:
                print("Processing national: " + name)
            coverage = find_link_tag(national, "national") if national else None
            coverage_details = find_link_tag(coverage, "coverage") if coverage else None
            #print(coverage_details)
            decklists = extract_data(coverage_details["standings"]) if coverage_details else None
            if decklists is None:
                print("No decklists found for national: " + name)
                continue
            json_object = json.dumps(decklists, indent=4)
            with open(f"nationals_decklists_{name}.json", "w") as outfile:
                outfile.write(json_object)
    
    #HIGH TIER TOURNAMENTS
    if high_tier_flag:
        page_url = "https://fabtcg.com/en/organised-play/2025/"
        tournaments_2025 = find_link_tag(page_url, "2025")
        for tournament in tournaments_2025:
            name = tournament.split("/")[-2]
            if os.path.exists(f"high_tier_decklists_{name}.json"):
                print(f"Already done {name} high tier tournament!")
                continue
            else:
                print("Processing high tier tournament: " + name)
            print(f"Processing tournament: {name}")
            high_tier = find_link_tag(tournament, "high tier") if tournament else None
            print(f"High tier links: {high_tier}")
            for tournament_name, link in high_tier:
                print(f"High tier tournament link: {link}")
                coverage_details = find_link_tag(link, "coverage") if link else None
                print(f"Coverage details: {coverage_details}")
                if coverage_details:
                    decklists = extract_data(coverage_details["standings"]) if coverage_details else None
                    json_object = json.dumps(decklists, indent=4)
                    with open(f"high_tier_decklists_{name}_{str(tournament_name).replace(" ", "-").lower()}.json", "w") as outfile:
                        outfile.write(json_object)
    
    